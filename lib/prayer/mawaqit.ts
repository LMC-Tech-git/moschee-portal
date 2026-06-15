// =========================================
// Prayer Times - Mawaqit Provider
// Quelle: öffentliche Moschee-Seite https://mawaqit.net/en/<slug>
// (offizielle API ist privat). Die Seite bettet `let confData = {…}` ein;
// confData.calendar ist ein 12-Element-Array (Index = Monat-1), jeder Monat
// ein Objekt Tag→[fajr, shuruq, dhuhr, asr, maghrib, isha].
// Best-Effort, kein API-Vertrag → defensiv parsen, nie hart brechen,
// bei jedem Fehler Stale-Cache-Fallback (analog aladhan.ts).
// =========================================

import type { PrayerTimes, TuneOffsets } from "./types";
import { DEFAULT_TUNE } from "./types";
import {
  getCachedMonthlyCalendar,
  setCachedMonthlyCalendar,
} from "./cache";

const MAWAQIT_BASE = "https://mawaqit.net/en";

// Mawaqit-Kalender: 12 Monate, je Tag [fajr, shuruq, dhuhr, asr, maghrib, isha].
type MawaqitMonth = Record<string, string[]>;
type MawaqitCalendar = MawaqitMonth[];

/** Addiert Minuten-Offset auf eine HH:mm Zeit (identisch zu aladhan.ts). */
function applyTuneMinutes(time: string, offsetMinutes: number): string {
  if (!offsetMinutes) return time;
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + offsetMinutes;
  const normalized = ((total % 1440) + 1440) % 1440;
  const nh = Math.floor(normalized / 60);
  const nm = normalized % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

/**
 * Berechnet das Hijri-Datum für ein gregorianisches Datum.
 * Mawaqit liefert kein pro-Tag-Hijri, daher via Intl.
 * Hinweis: Der islamische (umm-al-qura/civil) Kalender kann ±1 Tag vom
 * AlAdhan-Hijri abweichen — akzeptabel, da nur Anzeige.
 */
function computeHijri(date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const day = get("day");
    const month = get("month").replace(/\s*\(.*?\)\s*/, "").trim(); // "Sha'ban (AH)" → "Sha'ban"
    const year = get("year").replace(/[^\d]/g, "");
    if (!day || !month || !year) return "";
    return `${day}. ${month} ${year}`;
  } catch {
    return "";
  }
}

/**
 * Schneidet das `confData`-Objektliteral aus dem Seiten-HTML.
 * String-aware Brace-Matching (robuster als Greedy-Regex).
 */
function extractConfData(html: string): MawaqitCalendar | null {
  const k = html.indexOf("confData");
  if (k === -1) return null;
  const start = html.indexOf("{", k);
  if (start === -1) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let p = start; p < html.length; p++) {
    const c = html[p];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = p;
        break;
      }
    }
  }
  if (end === -1) return null;

  try {
    const parsed = JSON.parse(html.slice(start, end + 1)) as {
      calendar?: unknown;
    };
    if (!Array.isArray(parsed.calendar) || parsed.calendar.length !== 12) {
      throw new Error("confData ohne gültiges calendar");
    }
    return parsed.calendar as MawaqitCalendar;
  } catch (err) {
    console.error("[mawaqit] confData-Parse fehlgeschlagen:", err);
    return null;
  }
}

/**
 * Holt Gebetszeiten für ein Datum via Mawaqit-Moschee-Seite.
 * Cache-Strategie: PB-Cache (24h TTL), bei Fehler Stale-Fallback.
 * Der Cache-Key enthält den Slug → nach Slug-Wechsel sofort frische Daten.
 * Der Mawaqit-Kalender deckt das ganze Jahr ab → 1 Fetch/Tag genügt.
 *
 * @param mosqueId        - für Tenant-Isolation des Caches
 * @param date            - Datum
 * @param mawaqitMosqueId - Slug aus https://mawaqit.net/en/<slug>
 * @param tune            - optionale Minuten-Offsets je Gebet
 */
export async function getMawaqitPrayerTimes(
  mosqueId: string,
  date: Date,
  mawaqitMosqueId: string,
  tune?: TuneOffsets
): Promise<PrayerTimes | null> {
  if (!mawaqitMosqueId) return null;

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  // Slug im Key: Slug-Korrektur = neuer Key = sofort frisch, alte Keys verfallen via TTL.
  const monthKey = `mawaqit-${mawaqitMosqueId}-${year}`;

  let calendar: MawaqitCalendar | null = null;
  const cacheResult = await getCachedMonthlyCalendar(mosqueId, monthKey);

  if (cacheResult && !cacheResult.stale) {
    // Frischer Cache → direkt nutzen
    calendar = cacheResult.data as MawaqitCalendar;
  } else {
    // Cache fehlt oder veraltet → Seite anfragen
    const url = `${MAWAQIT_BASE}/${encodeURIComponent(mawaqitMosqueId)}`;
    try {
      const res = await fetch(url, {
        cache: "no-store",
        // Nackte Server-Requests werden teils mit 403 geblockt.
        headers: { "User-Agent": "Mozilla/5.0 (compatible; MoscheePortal/1.0)" },
      });
      if (!res.ok) throw new Error(`Mawaqit HTTP ${res.status}`);

      const html = await res.text();
      const parsed = extractConfData(html);
      if (!parsed) throw new Error("confData nicht gefunden");

      calendar = parsed;

      // Cache asynchron schreiben (blockiert nicht)
      setCachedMonthlyCalendar(mosqueId, monthKey, calendar).catch(() => {});
    } catch (err) {
      console.error("[mawaqit] Fehler:", err);
      // Fallback auf veralteten Cache (stale)
      if (cacheResult) {
        calendar = cacheResult.data as MawaqitCalendar;
        console.warn("[mawaqit] Nutze veralteten Cache als Fallback:", mosqueId, monthKey);
      }
    }
  }

  if (!calendar) return null;

  // Tag aus dem Monats-Array lesen, mit Guard gegen Lücken/Schaltjahr.
  const dayArr = calendar[month - 1]?.[String(day)];
  if (!Array.isArray(dayArr) || dayArr.length < 6) return null;

  // Reihenfolge: [fajr, shuruq, dhuhr, asr, maghrib, isha] (Mawaqit liefert reine "HH:mm").
  const [fajrRaw, shuruqRaw, dhuhrRaw, asrRaw, maghribRaw, ishaRaw] = dayArr.map(
    (v) => String(v).trim()
  );

  const t = tune ?? DEFAULT_TUNE;
  const sunriseTuned = applyTuneMinutes(shuruqRaw, t.sunrise);
  // Salatul Fadjr / Sabah Namazı: 30 Min vor (getuntem) Shuruk, eigener Tune-Offset.
  const sabah = applyTuneMinutes(applyTuneMinutes(sunriseTuned, -30), t.sabah);

  return {
    fajr:    applyTuneMinutes(fajrRaw,    t.fajr),
    sabah,
    sunrise: sunriseTuned,
    dhuhr:   applyTuneMinutes(dhuhrRaw,   t.dhuhr),
    asr:     applyTuneMinutes(asrRaw,     t.asr),
    maghrib: applyTuneMinutes(maghribRaw, t.maghrib),
    isha:    applyTuneMinutes(ishaRaw,    t.isha),
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    hijriDate: computeHijri(date),
    provider: "mawaqit",
  };
}
