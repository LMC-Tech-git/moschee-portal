/**
 * Telefonnummern-Normalisierung (E.164)
 *
 * Unterstützte Länder: DE (Standard), AT, FR, CH, TR
 * Verwendet libphonenumber-js für zuverlässiges Parsing.
 *
 * Beispiele:
 *   "0176 12345678"        → "+4917612345678"  (DE)
 *   "+49 (176) 123-45678"  → "+4917612345678"  (DE)
 *   "0664 1234567"         → "+436641234567"   (AT)
 */

import { parsePhoneNumber, type CountryCode } from "libphonenumber-js";

/** Länder, für die eine Normalisierung unterstützt wird */
export const PHONE_COUNTRIES = ["DE", "AT", "FR", "CH", "TR"] as const;
export type PhoneCountry = (typeof PHONE_COUNTRIES)[number];

/**
 * Ermittelt das wahrscheinliche Heimatland der Moschee anhand von
 * Zeitzone und Adress-/Stadtfeld.
 *
 * Fallback: "DE"
 */
export function detectCountryFromMosque(mosque: {
  timezone?: string;
  address?: string;
  city?: string;
}): PhoneCountry {
  const tz = (mosque.timezone ?? "").toLowerCase();
  const text = `${mosque.address ?? ""} ${mosque.city ?? ""}`.toLowerCase();

  // Österreich
  if (
    tz.includes("vienna") ||
    /österreich|austria|wien|graz|linz|salzburg|innsbruck|klagenfurt|villach|wels|st\.?\s*pölten/.test(
      text
    )
  ) {
    return "AT";
  }

  // Frankreich
  if (
    tz.includes("paris") ||
    /frankreich|france|paris|lyon|marseille|toulouse|nice|nantes|strasbourg|montpellier|bordeaux/.test(
      text
    )
  ) {
    return "FR";
  }

  // Schweiz
  if (
    tz.includes("zurich") ||
    tz.includes("geneva") ||
    /schweiz|switzerland|suisse|zürich|zurich|genf|geneva|bern|basel|lausanne|winterthur|st\.?\s*gallen|luzern/.test(
      text
    )
  ) {
    return "CH";
  }

  // Türkei
  if (
    tz.includes("istanbul") ||
    /türkei|türkiye|turkey|istanbul|ankara|izmir|bursa|antalya|adana|konya/.test(
      text
    )
  ) {
    return "TR";
  }

  // Standard: Deutschland
  return "DE";
}

/**
 * Normalisiert eine Telefonnummer in E.164-Format.
 *
 * @param raw     Rohwert (z.B. "0176 12345678", "+49 176 12345678")
 * @param country ISO 3166-1 Alpha-2 Ländercode als Hinweis (z.B. "DE")
 * @returns E.164-Nummer (z.B. "+4917612345678") oder null bei ungültiger Eingabe
 */
export function normalizePhone(
  raw: string,
  country: string = "DE"
): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  try {
    const phone = parsePhoneNumber(trimmed, country as CountryCode);
    return phone?.isValid() ? phone.format("E.164") : null;
  } catch {
    return null;
  }
}

/**
 * Normalisiert eine Telefonnummer, gibt aber im Fehlerfall den getrimmten
 * Rohwert zurück (kein Datenverlust).
 *
 * Geeignet für Formularfelder, bei denen eine ungültige Eingabe
 * lieber gespeichert als verworfen werden soll.
 *
 * @param raw     Rohwert
 * @param country ISO 3166-1 Alpha-2 Ländercode
 * @returns E.164-Nummer oder unveränderter Rohwert (getrimmt)
 */
export function applyPhoneNorm(raw: string, country: string = "DE"): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  return normalizePhone(trimmed, country) ?? trimmed;
}

/**
 * Formatiert eine E.164-Nummer für die Anzeige (internationales Format).
 *
 * @param e164  E.164-Nummer (z.B. "+4917612345678")
 * @returns Anzeige-Format (z.B. "+49 176 12345678") oder ursprünglicher Wert
 */
export function formatPhoneDisplay(e164: string): string {
  if (!e164) return "";
  try {
    const phone = parsePhoneNumber(e164);
    return phone ? phone.formatInternational() : e164;
  } catch {
    return e164;
  }
}
