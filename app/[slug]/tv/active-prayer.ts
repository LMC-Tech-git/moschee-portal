/**
 * Bestimmt aktuelles + nächstes Gebet in Moschee-Zeitzone.
 * Eingabe sind HH:mm-Strings aus PrayerTimes (lokale Moschee-Zeit) und IANA-TZ.
 */
import type { PrayerTimes } from "@/lib/prayer";
import type { TVPrayerName } from "@/types";

const PRAYER_ORDER: TVPrayerName[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

/**
 * Konvertiert eine Wall-Clock-Zeit in einer IANA-Zeitzone in einen UTC-Millisekunden-Wert.
 * Nutzt Intl.DateTimeFormat zur Offset-Bestimmung (kein date-fns-tz nötig).
 */
export function wallClockToUtcMs(dateYmd: string, time: string, tz: string): number {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  if ([y, m, d, h, mi].some((n) => Number.isNaN(n))) return Number.NaN;

  const utcGuess = Date.UTC(y, m - 1, d, h, mi, 0);

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(utcGuess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
  const tzAsMs = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const diff = tzAsMs - utcGuess;
  return utcGuess - diff;
}

export type ActivePrayerInfo = {
  /** Gerade laufendes Gebet (zwischen Start dieses und Start des nächsten). null vor Fajr. */
  currentPrayer: TVPrayerName | null;
  /** Start-Zeitpunkt des aktuellen Gebets (UTC ms). */
  currentPrayerStartedAtMs: number | null;
  /** Nächstes Gebet (oder erstes des nächsten Tages — Fajr — wenn nach Isha). */
  nextPrayer: TVPrayerName;
  /** Start-Zeitpunkt des nächsten Gebets (UTC ms). */
  nextPrayerAtMs: number;
};

/**
 * Berechnet aktives + nächstes Gebet relativ zu now.
 * `currentDateYmd` muss YYYY-MM-DD im mosque-tz sein (vom Server bereitgestellt).
 */
export function computeActivePrayer(
  times: PrayerTimes,
  tz: string,
  currentDateYmd: string,
  nowMs: number
): ActivePrayerInfo {
  const points = PRAYER_ORDER.map((name) => ({
    name,
    timeStr: times[name] || "",
    atMs: wallClockToUtcMs(currentDateYmd, times[name] || "00:00", tz),
  })).filter((p) => Number.isFinite(p.atMs));

  // Vor Fajr → nächstes ist Fajr (gleicher Tag)
  if (nowMs < points[0].atMs) {
    return {
      currentPrayer: null,
      currentPrayerStartedAtMs: null,
      nextPrayer: points[0].name,
      nextPrayerAtMs: points[0].atMs,
    };
  }

  // Nach Isha → nächstes ist Fajr (nächster Tag)
  const last = points[points.length - 1];
  if (nowMs >= last.atMs) {
    // Nächster Tag = currentDate + 1
    const [y, m, d] = currentDateYmd.split("-").map(Number);
    const nextDate = new Date(Date.UTC(y, m - 1, d + 1));
    const nextYmd = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}-${String(nextDate.getUTCDate()).padStart(2, "0")}`;
    const nextFajrMs = wallClockToUtcMs(nextYmd, times.fajr || "05:00", tz);
    return {
      currentPrayer: last.name,
      currentPrayerStartedAtMs: last.atMs,
      nextPrayer: "fajr",
      nextPrayerAtMs: nextFajrMs,
    };
  }

  // Dazwischen
  for (let i = 0; i < points.length - 1; i++) {
    if (nowMs >= points[i].atMs && nowMs < points[i + 1].atMs) {
      return {
        currentPrayer: points[i].name,
        currentPrayerStartedAtMs: points[i].atMs,
        nextPrayer: points[i + 1].name,
        nextPrayerAtMs: points[i + 1].atMs,
      };
    }
  }

  // Fallback (sollte nie erreicht werden)
  return {
    currentPrayer: null,
    currentPrayerStartedAtMs: null,
    nextPrayer: points[0].name,
    nextPrayerAtMs: points[0].atMs,
  };
}

export const ARABIC_PRAYER_NAMES: Record<TVPrayerName, string> = {
  fajr: "الفجر",
  sunrise: "الشروق",
  dhuhr: "الظهر",
  asr: "العصر",
  maghrib: "المغرب",
  isha: "العشاء",
};
