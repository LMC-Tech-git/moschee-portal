// =========================================
// Prayer Times - AlAdhan Provider
// Verwendet den Monthly Calendar Endpoint.
// =========================================

import type { PrayerTimes, TuneOffsets } from "./types";
import { DEFAULT_TUNE } from "./types";
import {
  getCachedMonthlyCalendar,
  setCachedMonthlyCalendar,
} from "./cache";

const ALADHAN_BASE = "https://api.aladhan.com/v1";

interface AladhanDayEntry {
  timings: {
    Fajr: string;
    Sunrise: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
    [key: string]: string;
  };
  date: {
    gregorian: {
      day: string;
      month: { number: number };
      year: string;
    };
    hijri: {
      date: string;
      day: string;
      month: { en: string; ar: string };
      year: string;
    };
  };
}

/** Entfernt Zeitzonen-Suffixe wie "(CET)" aus Aladhan-Zeiten. */
function cleanTime(raw: string): string {
  return raw.replace(/\s*\(.*?\)/, "").trim();
}

/** Addiert Minuten-Offset auf eine HH:mm Zeit. */
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
 * Holt Gebetszeiten für ein Datum via AlAdhan Monthly Calendar.
 * Cache-Strategie: PB-Cache (24h TTL), bei API-Fehler Stale-Fallback.
 *
 * @param mosqueId  - für Cache-Schlüssel (tenant-isoliert)
 * @param date      - Datum
 * @param latitude  - Breitengrad
 * @param longitude - Längengrad
 * @param method    - Aladhan Berechnungsmethode (13 = Diyanet)
 * @param tune      - optionale Minuten-Offsets je Gebet
 */
export async function getAladhanPrayerTimes(
  mosqueId: string,
  date: Date,
  latitude: number,
  longitude: number,
  method: number,
  tune?: TuneOffsets
): Promise<PrayerTimes | null> {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  let calendarData: AladhanDayEntry[] | null = null;
  const cacheResult = await getCachedMonthlyCalendar(mosqueId, monthKey);

  if (cacheResult && !cacheResult.stale) {
    // Frischer Cache → direkt nutzen
    calendarData = cacheResult.data as AladhanDayEntry[];
  } else {
    // Cache fehlt oder veraltet → API anfragen
    const url =
      `${ALADHAN_BASE}/calendar` +
      `?latitude=${latitude}` +
      `&longitude=${longitude}` +
      `&method=${method}` +
      `&month=${month}` +
      `&year=${year}`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`AlAdhan HTTP ${res.status}`);

      const json = (await res.json()) as {
        code: number;
        data: AladhanDayEntry[];
      };
      if (json.code !== 200 || !Array.isArray(json.data)) {
        throw new Error("Ungültige API-Antwort");
      }

      calendarData = json.data;

      // Cache asynchron schreiben (blockiert nicht)
      setCachedMonthlyCalendar(mosqueId, monthKey, calendarData).catch(
        () => {}
      );
    } catch (err) {
      console.error("[aladhan] API-Fehler:", err);
      // Fallback auf veralteten Cache (stale)
      if (cacheResult) {
        calendarData = cacheResult.data as AladhanDayEntry[];
        console.warn("[aladhan] Nutze veralteten Cache als Fallback:", mosqueId, monthKey);
      }
    }
  }

  if (!calendarData) return null;

  // Tag im Monats-Array suchen
  const dayEntry = calendarData.find(
    (d) => parseInt(d.date.gregorian.day, 10) === day
  );
  if (!dayEntry) return null;

  const t = tune ?? DEFAULT_TUNE;
  const ti = dayEntry.timings;
  const hijri = dayEntry.date.hijri;
  const hijriDate = `${parseInt(hijri.day, 10)}. ${hijri.month.en} ${hijri.year}`;

  return {
    fajr:    applyTuneMinutes(cleanTime(ti.Fajr),    t.fajr),
    sunrise: applyTuneMinutes(cleanTime(ti.Sunrise), t.sunrise),
    dhuhr:   applyTuneMinutes(cleanTime(ti.Dhuhr),   t.dhuhr),
    asr:     applyTuneMinutes(cleanTime(ti.Asr),     t.asr),
    maghrib: applyTuneMinutes(cleanTime(ti.Maghrib), t.maghrib),
    isha:    applyTuneMinutes(cleanTime(ti.Isha),    t.isha),
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    hijriDate,
    provider: "aladhan",
  };
}
