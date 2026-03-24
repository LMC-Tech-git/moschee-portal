import type { Event } from "@/types";

const DAY_LABELS: Record<string, string> = {
  monday:    "Montag",
  tuesday:   "Dienstag",
  wednesday: "Mittwoch",
  thursday:  "Donnerstag",
  friday:    "Freitag",
  saturday:  "Samstag",
  sunday:    "Sonntag",
};

const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

/**
 * Berechnet das nächste Auftreten eines wiederkehrenden Events ab heute.
 * Gibt null zurück wenn das Event nicht wiederkehrend ist oder kein Auftreten mehr stattfindet.
 */
export function getNextOccurrence(event: Event): Date | null {
  if (!event.is_recurring || !event.recurrence_type) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (event.recurrence_end_date) {
    const endDate = new Date(event.recurrence_end_date);
    if (today > endDate) return null;
  }

  if (event.recurrence_type === "daily") {
    return today;
  }

  if (event.recurrence_type === "weekly" && event.recurrence_day_of_week) {
    const targetDay = DAY_MAP[event.recurrence_day_of_week];
    if (targetDay === undefined) return null;

    const currentDay = today.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0) daysUntil += 7;

    const next = new Date(today);
    next.setDate(today.getDate() + daysUntil);
    return next;
  }

  if (event.recurrence_type === "monthly") {
    if (event.recurrence_month_mode === "weekday" && event.recurrence_month_weekday) {
      const nth = event.recurrence_month_week ?? 1;
      const dayIndex = DAY_MAP[event.recurrence_month_weekday];
      if (dayIndex === undefined) return null;
      const candidateDay = getNthWeekdayOfMonth(today.getFullYear(), today.getMonth(), nth, dayIndex);
      if (candidateDay !== null) {
        const candidate = new Date(today.getFullYear(), today.getMonth(), candidateDay);
        if (candidate >= today) return candidate;
      }
      // nächster Monat
      const nextMonth = today.getMonth() + 1;
      const nextYear = nextMonth > 11 ? today.getFullYear() + 1 : today.getFullYear();
      const normalizedMonth = nextMonth > 11 ? 0 : nextMonth;
      const nextDay = getNthWeekdayOfMonth(nextYear, normalizedMonth, nth, dayIndex);
      if (nextDay === null) return null;
      return new Date(nextYear, normalizedMonth, nextDay);
    }
    if (event.recurrence_day_of_month) {
      const day = event.recurrence_day_of_month;
      const candidate = new Date(today.getFullYear(), today.getMonth(), day);
      if (candidate >= today) return candidate;
      return new Date(today.getFullYear(), today.getMonth() + 1, day);
    }
  }

  return null;
}

/** Gibt den Tag (1-basiert) des N. Wochentags im Monat zurück. -1 = letzter. */
function getNthWeekdayOfMonth(year: number, month: number, nth: number, dayIndex: number): number | null {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  if (nth === -1) {
    // Letzter Wochentag des Monats
    for (let d = daysInMonth; d >= 1; d--) {
      if (new Date(year, month, d).getDay() === dayIndex) return d;
    }
    return null;
  }
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month, d).getDay() === dayIndex) {
      count++;
      if (count === nth) return d;
    }
  }
  return null;
}

/**
 * Gibt einen lesbaren deutschen Label für die Wiederholungsregel zurück.
 * z.B. "Jeden Freitag", "Täglich", "Monatlich am 1."
 */
export function getRecurrenceLabel(event: Event): string {
  if (!event.is_recurring || !event.recurrence_type) return "";

  if (event.recurrence_type === "daily") return "Täglich";

  if (event.recurrence_type === "weekly") {
    const dayLabel = event.recurrence_day_of_week
      ? DAY_LABELS[event.recurrence_day_of_week] || event.recurrence_day_of_week
      : "";
    return dayLabel ? `Jeden ${dayLabel}` : "Wöchentlich";
  }

  if (event.recurrence_type === "monthly") {
    if (event.recurrence_month_mode === "weekday" && event.recurrence_month_weekday) {
      const nth = event.recurrence_month_week ?? 1;
      const weekLabel = nth === -1 ? "letzten" : `${nth}.`;
      const dayLabel = DAY_LABELS[event.recurrence_month_weekday] || event.recurrence_month_weekday;
      return `Jeden ${weekLabel} ${dayLabel} des Monats`;
    }
    return event.recurrence_day_of_month
      ? `Monatlich am ${event.recurrence_day_of_month}.`
      : "Monatlich";
  }

  return "";
}
