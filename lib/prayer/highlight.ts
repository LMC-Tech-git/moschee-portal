/**
 * Shared Helper für die Hervorhebung des "nächsten anstehenden" Gebets.
 * Wird von Homepage (app/[slug]/page.tsx) und TV-Display (PrayerHeader) genutzt.
 * Single source of truth — Tweaks an genau einer Stelle.
 *
 * Pure-Funktionen, client + server safe.
 */
import type { PrayerTimes } from "./types";

export const HIGHLIGHTABLE_PRAYERS = [
  "fajr",
  "sabah",
  "sunrise",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
] as const;
export type HighlightablePrayer = (typeof HIGHLIGHTABLE_PRAYERS)[number];

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Berechnet die Wall-Clock-Minuten (0–1439) der angegebenen Zeit
 * in der angegebenen IANA-Timezone. Server-TZ-unabhängig.
 */
function wallClockMinutesInTz(nowDate: Date, mosqueTz?: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: mosqueTz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(nowDate);
  const h = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return h * 60 + m;
}

/**
 * Liefert den Key des nächsten anstehenden Gebets (Wall-Clock-Vergleich in
 * der gegebenen Moschee-TZ). Falls alle Gebete des Tages vorbei sind: null.
 *
 * @param times      PrayerTimes-Objekt (HH:mm Strings in Moschee-TZ)
 * @param nowDate    Aktuelle Zeit als Date. Default: new Date()
 * @param mosqueTz   IANA-TZ der Moschee. Default: System-TZ.
 */
export function getNextPrayerKey(
  times: PrayerTimes,
  nowDate: Date = new Date(),
  mosqueTz?: string
): HighlightablePrayer | null {
  const nowMins = wallClockMinutesInTz(nowDate, mosqueTz);

  for (const key of HIGHLIGHTABLE_PRAYERS) {
    const t = times[key];
    if (typeof t !== "string" || !t) continue;
    if (timeToMinutes(t) > nowMins) return key;
  }
  return null;
}

/**
 * True wenn Gebets-Zeit bereits vergangen (Wall-Clock < now).
 * Für ausgegraute Darstellung in Listen.
 */
export function isPrayerPast(
  timeStr: string,
  nowDate: Date = new Date(),
  mosqueTz?: string
): boolean {
  if (!timeStr) return false;
  const nowMins = wallClockMinutesInTz(nowDate, mosqueTz);
  return timeToMinutes(timeStr) < nowMins;
}
