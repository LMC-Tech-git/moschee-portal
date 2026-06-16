// =========================================
// Prayer Times - Diyanet Provider (offizielle Diyanet-Webseite)
// Quelle: https://namazvakitleri.diyanet.gov.tr/en-US/<cityId>
// Liefert die OFFIZIELLEN Diyanet-Tabellenzeiten (inkl. İmsak + Hijri) als HTML-Monatstabelle.
// Es wird NICHTS gerechnet (kein Shuruk−30 wie bei Mawaqit, keine Methoden-Approximation wie
// bei AlAdhan) → kein Drift gegen den offiziellen Aushang.
//
// Bewusst die öffentliche Webseite statt der AwqatSalah-API:
//   - KEIN Account / keine Registrierung nötig, KEIN Rate-Limit.
//   - prayer_source_id = numerische City-Id aus der Diyanet-URL
//     (z.B. Ulm = 11028 → .../en-US/11028). Stadt auf namazvakitleri.diyanet.gov.tr
//     wählen und die Zahl aus der Adresse übernehmen.
//   - Zeiten kommen bereits in lokaler Zeit (CET/CEST bei DE-Städten) → KEINE TZ-Konvertierung.
//   - Best-Effort-HTML-Parsing (kein API-Vertrag) → defensiv, nie hart brechen,
//     bei jedem Fehler Stale-Cache-Fallback (analog mawaqit.ts).
// =========================================

import type { PrayerTimes, TuneOffsets } from "./types";
import { DEFAULT_TUNE } from "./types";
import {
  getCachedMonthlyCalendar,
  setCachedMonthlyCalendar,
} from "./cache";

const DIYANET_BASE = "https://namazvakitleri.diyanet.gov.tr/en-US";
// Offizielle Tabelle ändert sich nicht täglich → 7 Tage TTL (1 Fetch/Woche je Stadt).
const DIYANET_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Ein geparster Tageseintrag der Diyanet-Monatstabelle.
interface DiyanetDayEntry {
  date: string;   // "DD.MM.YYYY"
  hijri: string;  // z.B. "1 Muharrem 1448"
  fajr: string;   // "HH:mm"  (İmsak)
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

/** Addiert Minuten-Offset auf eine HH:mm Zeit (additiv, kein impliziter Versatz). */
function applyTuneMinutes(time: string, offsetMinutes: number): string {
  if (!offsetMinutes) return time;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const total = h * 60 + m + offsetMinutes;
  const normalized = ((total % 1440) + 1440) % 1440;
  const nh = Math.floor(normalized / 60);
  const nm = normalized % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

/** Entfernt HTML-Tags und normalisiert Whitespace einer Tabellenzelle. */
function cellText(raw: string): string {
  return raw.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Parst die Diyanet-Monatstabelle aus dem Seiten-HTML.
 * Strategie: alle <td>-Zellen in Reihenfolge einlesen; trifft eine Zelle auf ein
 * Datum "DD.MM.YYYY", bilden die folgenden 7 Zellen (Hijri + 6 Zeiten) den Tageseintrag.
 * Robust gegen Tabellen-Attribute/Position (kein id/class am <table>).
 */
function parseDiyanetCalendar(html: string): DiyanetDayEntry[] {
  const cells: string[] = [];
  const re = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) cells.push(cellText(m[1]));

  const out: DiyanetDayEntry[] = [];
  const dateRe = /^\d{2}\.\d{2}\.\d{4}$/;
  const timeRe = /^\d{1,2}:\d{2}$/;
  for (let i = 0; i + 7 < cells.length; i++) {
    if (!dateRe.test(cells[i])) continue;
    const slice = cells.slice(i + 2, i + 8); // 6 Zeit-Zellen nach Datum + Hijri
    if (slice.length === 6 && slice.every((c) => timeRe.test(c))) {
      const norm = (t: string) => {
        const [h, mm] = t.split(":");
        return `${h.padStart(2, "0")}:${mm}`;
      };
      out.push({
        date: cells[i],
        hijri: cells[i + 1],
        fajr: norm(slice[0]),
        sunrise: norm(slice[1]),
        dhuhr: norm(slice[2]),
        asr: norm(slice[3]),
        maghrib: norm(slice[4]),
        isha: norm(slice[5]),
      });
      i += 7; // Zellen dieses Eintrags überspringen
    }
  }
  return out;
}

/**
 * Holt Gebetszeiten für ein Datum via offizieller Diyanet-Webseite.
 * Cache-Strategie: PB-Cache (7 Tage TTL), bei Fehler Stale-Fallback (analog mawaqit.ts).
 *
 * @param mosqueId - für Tenant-Isolation des Caches
 * @param date     - Datum
 * @param sourceId - Diyanet City-Id (numerisch, als String; aus der Diyanet-URL)
 * @param tune     - optionale additive Minuten-Offsets je Gebet
 */
export async function getDiyanetPrayerTimes(
  mosqueId: string,
  date: Date,
  sourceId: string,
  tune?: TuneOffsets
): Promise<PrayerTimes | null> {
  if (!sourceId) return null;

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  // City-Id + Monat im Key → ID-Wechsel = neuer Key = sofort frisch; alte Keys verfallen via TTL.
  const monthKey = `diyanet-${sourceId}-${year}-${String(month).padStart(2, "0")}`;
  const dateStr = `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;

  let calendar: DiyanetDayEntry[] | null = null;
  const cacheResult = await getCachedMonthlyCalendar(mosqueId, monthKey, DIYANET_CACHE_TTL_MS);

  if (cacheResult && !cacheResult.stale) {
    calendar = cacheResult.data as DiyanetDayEntry[];
  } else {
    const url = `${DIYANET_BASE}/${encodeURIComponent(sourceId)}`;
    try {
      const res = await fetch(url, {
        cache: "no-store",
        // Nackte Server-Requests werden teils mit 403 geblockt.
        headers: { "User-Agent": "Mozilla/5.0 (compatible; MoscheePortal/1.0)" },
      });
      if (!res.ok) throw new Error(`Diyanet HTTP ${res.status}`);

      const parsed = parseDiyanetCalendar(await res.text());
      if (parsed.length === 0) throw new Error("Diyanet-Tabelle nicht gefunden/leer");

      calendar = parsed;
      setCachedMonthlyCalendar(mosqueId, monthKey, calendar).catch(() => {});
    } catch (err) {
      console.error("[diyanet] Fehler:", err);
      if (cacheResult) {
        calendar = cacheResult.data as DiyanetDayEntry[];
        console.warn("[diyanet] Nutze veralteten Cache als Fallback:", mosqueId, monthKey);
      }
    }
  }

  if (!calendar) return null;

  const dayEntry = calendar.find((d) => d.date === dateStr);
  if (!dayEntry) return null;

  const t = tune ?? DEFAULT_TUNE;

  // ALLE Zeiten 1:1 aus der offiziellen Tabelle — Diyanet `fajr` IST der offizielle İmsak.
  // Kein Shuruk−30, keine Berechnung. Tune nur als additiver Feinschliff je Gebet.
  const fajr = applyTuneMinutes(dayEntry.fajr, t.fajr);
  const sunrise = applyTuneMinutes(dayEntry.sunrise, t.sunrise);
  const dhuhr = applyTuneMinutes(dayEntry.dhuhr, t.dhuhr);
  const asr = applyTuneMinutes(dayEntry.asr, t.asr);
  const maghrib = applyTuneMinutes(dayEntry.maghrib, t.maghrib);
  const isha = applyTuneMinutes(dayEntry.isha, t.isha);

  if (!fajr || !sunrise || !dhuhr || !asr || !maghrib || !isha) return null;

  return {
    fajr,
    imsak: fajr, // offizieller İmsak == Fajr-Wert
    // sabah (Sabah-Namazı-Gemeindezeit) liefert Diyanet NICHT → nicht fabrizieren (kein Shuruk−30).
    sunrise,
    dhuhr,
    asr,
    maghrib,
    isha,
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    hijriDate: dayEntry.hijri,
    provider: "diyanet",
  };
}
