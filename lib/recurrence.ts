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

  if (event.recurrence_type === "monthly" && event.recurrence_day_of_month) {
    const day = event.recurrence_day_of_month;
    const candidate = new Date(today.getFullYear(), today.getMonth(), day);
    if (candidate >= today) return candidate;
    return new Date(today.getFullYear(), today.getMonth() + 1, day);
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
    return event.recurrence_day_of_month
      ? `Monatlich am ${event.recurrence_day_of_month}.`
      : "Monatlich";
  }

  return "";
}
