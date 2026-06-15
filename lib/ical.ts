// =========================================
// iCal (RFC 5545) Builder für Event-Export
// Pure-Modul (kein "use server"). Erzeugt VCALENDAR mit VEVENTs.
// Wiederkehrende Events → RRULE (mappt lib/recurrence.ts-Logik).
// Zeitzone: VTIMEZONE Europe/Berlin + DTSTART;TZID=… (Wall-Clock, DST-stabil).
// =========================================

import type { Event } from "@/types";
import { getNextOccurrence } from "@/lib/recurrence";

// Voller Wochentag-Name → iCal 2-Letter-Code.
const DAY_TO_ICAL: Record<string, string> = {
  monday: "MO",
  tuesday: "TU",
  wednesday: "WE",
  thursday: "TH",
  friday: "FR",
  saturday: "SA",
  sunday: "SU",
};

// Kanonischer Europe/Berlin VTIMEZONE-Block (CET/CEST).
const VTIMEZONE_BERLIN = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Berlin",
  "X-LIC-LOCATION:Europe/Berlin",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Zerlegt ein Date in Wall-Clock-Komponenten der angegebenen IANA-TZ. */
function partsInTz(
  date: Date,
  tz: string
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
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
  const p = fmt.formatToParts(date);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value || 0);
  let hour = get("hour");
  if (hour === 24) hour = 0; // Intl liefert teils "24" für Mitternacht
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Lokaler iCal-Stamp ohne TZ-Suffix: "YYYYMMDDTHHMMSS". */
function localStamp(y: number, mo: number, d: number, h: number, mi: number, s: number): string {
  return `${y}${pad2(mo)}${pad2(d)}T${pad2(h)}${pad2(mi)}${pad2(s)}`;
}

/**
 * Addiert Minuten auf eine Wall-Clock (naiv, mit Datum-Übertrag).
 * Für DTEND ausreichend — TZID am DTSTART liefert die echte Zonenauflösung.
 */
function addMinutesToWallClock(
  y: number, mo: number, d: number, h: number, mi: number, s: number, minutes: number
): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const t = Date.UTC(y, mo - 1, d, h, mi, s) + minutes * 60_000;
  const dt = new Date(t);
  return {
    y: dt.getUTCFullYear(),
    mo: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
    h: dt.getUTCHours(),
    mi: dt.getUTCMinutes(),
    s: dt.getUTCSeconds(),
  };
}

/** UTC-Stamp mit Z-Suffix: "YYYYMMDDTHHMMSSZ". */
function toUtcStamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  );
}

/** RFC-5545 Text-Escaping. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Faltet eine Content-Line auf max. 75 Oktetts (UTF-8-Bytes, nicht JS-chars!).
 * Folgezeilen mit führendem Space. Multibyte (ü/ö/ä) wird nicht zerschnitten.
 */
function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let curBytes = 0;
  let first = true;
  for (const ch of Array.from(line)) {
    const b = enc.encode(ch).length;
    const max = first ? 75 : 74; // Folgezeile hat führenden Space (1 Oktett)
    if (curBytes + b > max) {
      out.push(cur);
      cur = "";
      curBytes = 0;
      first = false;
    }
    cur += ch;
    curBytes += b;
  }
  if (cur) out.push(cur);
  return out.join("\r\n ");
}

/** Baut die RRULE-Zeile (ohne "RRULE:"-Präfix) oder null. */
function buildRRule(event: Event): string | null {
  if (!event.is_recurring || !event.recurrence_type) return null;

  const parts: string[] = [];
  if (event.recurrence_type === "daily") {
    parts.push("FREQ=DAILY");
  } else if (event.recurrence_type === "weekly") {
    // BYDAY weglassen — DTSTART-Wochentag definiert die Wiederholung implizit.
    parts.push("FREQ=WEEKLY");
  } else if (event.recurrence_type === "monthly") {
    if (event.recurrence_month_mode === "weekday" && event.recurrence_month_weekday) {
      const wd = DAY_TO_ICAL[event.recurrence_month_weekday];
      if (!wd) return null;
      const week = event.recurrence_month_week ?? 1;
      parts.push("FREQ=MONTHLY", `BYDAY=${week}${wd}`);
    } else if (event.recurrence_day_of_month) {
      parts.push("FREQ=MONTHLY", `BYMONTHDAY=${event.recurrence_day_of_month}`);
    } else {
      return null;
    }
  } else {
    return null;
  }

  if (event.recurrence_end_date) {
    // UNTIL muss UTC sein. Tagesende des End-Datums.
    const ymd = event.recurrence_end_date.slice(0, 10).replace(/-/g, "");
    if (ymd.length === 8) parts.push(`UNTIL=${ymd}T235959Z`);
  }

  return parts.join(";");
}

/** Dauer in Minuten: explizit, sonst aus start/end, Fallback 60. */
function durationMinutes(event: Event): number {
  if (event.duration_minutes && event.duration_minutes > 0) return event.duration_minutes;
  if (event.start_at && event.end_at) {
    const diff = (new Date(event.end_at).getTime() - new Date(event.start_at).getTime()) / 60000;
    if (diff > 0) return Math.round(diff);
  }
  return 60;
}

/** Erzeugt die VEVENT-Zeilen für ein Event. Gibt [] zurück wenn kein Startdatum. */
function buildVEvent(event: Event, opts: { tz: string; slug: string; dtstamp: string }): string[] {
  if (!event.start_at) return [];
  const { tz, slug, dtstamp } = opts;

  const startDate = new Date(event.start_at);
  if (isNaN(startDate.getTime())) return [];

  const rrule = buildRRule(event);

  // Uhrzeit immer aus start_at (Wall-Clock in tz).
  const startParts = partsInTz(startDate, tz);

  // Datum: bei recurring die nächste Occurrence, sonst start_at-Datum.
  let dy = startParts.year, dmo = startParts.month, dd = startParts.day;
  if (rrule) {
    const next = getNextOccurrence(event);
    if (next) {
      dy = next.getFullYear();
      dmo = next.getMonth() + 1;
      dd = next.getDate();
    }
  }

  const dtstart = localStamp(dy, dmo, dd, startParts.hour, startParts.minute, startParts.second);

  // DTEND: recurring IMMER DTSTART + Dauer (sonst absolutes end_at bei non-recurring).
  let dtend: string;
  if (!rrule && event.end_at) {
    const e = partsInTz(new Date(event.end_at), tz);
    dtend = localStamp(e.year, e.month, e.day, e.hour, e.minute, e.second);
  } else {
    const end = addMinutesToWallClock(
      dy, dmo, dd, startParts.hour, startParts.minute, startParts.second, durationMinutes(event)
    );
    dtend = localStamp(end.y, end.mo, end.d, end.h, end.mi, end.s);
  }

  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${event.id}@${slug}.moschee.app`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${tz}:${dtstart}`,
    `DTEND;TZID=${tz}:${dtend}`,
    `SUMMARY:${escapeText(event.title || "")}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location_name) lines.push(`LOCATION:${escapeText(event.location_name)}`);
  if (event.category) lines.push(`CATEGORIES:${escapeText(event.category)}`);
  if (rrule) lines.push(`RRULE:${rrule}`);
  if (event.status === "cancelled") lines.push("STATUS:CANCELLED");
  lines.push("END:VEVENT");
  return lines;
}

/**
 * Baut ein vollständiges VCALENDAR-Dokument (mit CRLF-Zeilen, gefaltet).
 */
export function buildEventsICS(
  events: Event[],
  opts: { tz: string; calName: string; slug: string }
): string {
  const tz = opts.tz || "Europe/Berlin";
  const dtstamp = toUtcStamp(new Date());

  const rawLines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//moschee.app//Events//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(opts.calName)}`,
    `X-WR-TIMEZONE:${tz}`,
    ...(tz === "Europe/Berlin" ? VTIMEZONE_BERLIN : []),
  ];

  for (const event of events) {
    rawLines.push(...buildVEvent(event, { tz, slug: opts.slug, dtstamp }));
  }

  rawLines.push("END:VCALENDAR");

  return rawLines.map(foldLine).join("\r\n") + "\r\n";
}
