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
