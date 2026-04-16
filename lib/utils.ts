import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Hilfsfunktion zum Zusammenführen von Tailwind-Klassen.
 * Nutzt clsx + tailwind-merge für konflikfreie Klassen.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatiert einen Betrag als Euro-Währung.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/**
 * Formatiert ein Datum im deutschen Format.
 */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

/**
 * Formatiert einen Cent-Betrag als Euro-Währung.
 * z.B. 1250 → "12,50 €"
 */
export function formatCurrencyCents(amountCents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
}

/**
 * Formatiert einen ISO-Datumsstring als deutsches Datum mit Uhrzeit.
 * z.B. "2024-03-15T14:30:00Z" → "Fr., 15.03.2024, 14:30"
 */
export function formatDateTime(dateStr: string): string {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

/** Gibt Montag 00:00 und Sonntag 23:59:59 der aktuellen Kalenderwoche zurück. */
export function getCurrentWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay(); // 0=So, 1=Mo...
  const monday = new Date(now);
  monday.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

/** Gibt ersten und letzten Tag des aktuellen Monats zurück. */
export function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}
