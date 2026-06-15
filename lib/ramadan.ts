// =========================================
// Ramadan-Modus Helfer (pure, client + server safe)
// =========================================

import type { Settings } from "@/types";

/** "YYYY-MM-DD" in der angegebenen IANA-TZ (Default: lokale TZ). */
function ymdInTz(date: Date, tz?: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA liefert bereits "YYYY-MM-DD"
  return fmt.format(date);
}

/** Islamischer Monat (1–12) für ein Datum. Ramadan = 9. */
function islamicMonth(date: Date): number {
  try {
    const v = new Intl.DateTimeFormat("en-u-ca-islamic", { month: "numeric" }).format(date);
    return parseInt(v, 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Ist der Ramadan-Modus für das gegebene Datum aktiv?
 * - false wenn ramadan_mode aus.
 * - Wenn ramadan_start UND ramadan_end gesetzt: Datum im Fenster [start, end].
 * - Sonst Auto-Erkennung: islamischer Monat === 9 (Ramadan).
 *   Hinweis: islamic/umalqura kann ±1 Tag driften — manuelles Fenster ist exakter.
 */
export function isRamadanActive(
  settings: Pick<Settings, "ramadan_mode" | "ramadan_start" | "ramadan_end">,
  date: Date = new Date(),
  tz?: string
): boolean {
  if (!settings.ramadan_mode) return false;

  const start = (settings.ramadan_start || "").slice(0, 10);
  const end = (settings.ramadan_end || "").slice(0, 10);
  if (start && end) {
    const today = ymdInTz(date, tz);
    return today >= start && today <= end;
  }

  return islamicMonth(date) === 9;
}

/**
 * Wandelt eine Wall-Clock-Zeit ("HH:mm") an einem Datum (YMD) in der gegebenen
 * IANA-TZ in epoch ms um (TZ-sicher, DST-korrekt). Eigenständige Kopie der
 * TV-Logik (vermeidet Cross-Import aus app/).
 */
export function prayerTimeToMs(dateYmd: string, time: string, tz: string): number {
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
  let asHour = get("hour");
  if (asHour === 24) asHour = 0;
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), asHour, get("minute"), get("second"));
  // Offset zwischen "so interpretiert die TZ utcGuess" und der gewünschten Wall-Clock.
  const offset = asUtc - utcGuess;
  return utcGuess - offset;
}
