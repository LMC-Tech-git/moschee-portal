/**
 * Berechnet Millisekunden bis zum nächsten 00:00:01 in einer IANA-Zeitzone.
 * Client-Util — nutzt Intl.DateTimeFormat zur TZ-Auflösung.
 */
export function msUntilNextMidnight(tz: string, nowMs: number = Date.now()): number {
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
  const parts = fmt.formatToParts(new Date(nowMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
  const h = get("hour");
  const m = get("minute");
  const s = get("second");
  // Sekunden bis 00:00:01 morgen (in TZ-lokal)
  const secondsUntilMidnight = (24 - h) * 3600 - m * 60 - s + 1;
  return Math.max(secondsUntilMidnight, 1) * 1000;
}
