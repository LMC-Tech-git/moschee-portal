/**
 * PII-Sanitizer für KI-Aufrufe (Sprint 6).
 *
 * KEIN "use server" — pure/sync, aus Tests + Server-Actions importierbar.
 *
 * PFLICHT vor JEDEM Anthropic-Call: niemals rohen Beschreibungstext senden.
 * Maskiert E-Mails, Telefonnummern, IBAN-artige Strings und bekannte Vornamen
 * (best-effort). Reihenfolge: spezifisch → allgemein.
 */

// Best-effort Vornamen-Liste (DE + TR). Bewusst klein — false-negative ist
// tolerierbar (KI-Vorschlag ist unkritisch), false-positive auf Kategorie-Namen
// soll vermieden werden (keine Wörter wie "Miete"/"Spende" enthalten).
const KNOWN_FIRST_NAMES = [
  "Ahmed", "Mehmet", "Mustafa", "Ali", "Hasan", "Hüseyin", "Ibrahim", "Yusuf",
  "Omar", "Fatma", "Ayse", "Emine", "Zeynep", "Hatice", "Mohammed", "Muhammed",
  "Abdullah", "Ismail", "Murat", "Kemal", "Osman", "Selim", "Bekir", "Halil",
  "Thomas", "Michael", "Andreas", "Stefan", "Markus", "Daniel", "Christian",
  "Alexander", "Maria", "Anna", "Sabine", "Julia", "Katrin",
];

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}/g;
// IBAN-artig: 2 Buchstaben Ländercode + 2 Prüfziffern + 10–30 alphanum (mit opt. Spaces)
const IBAN_RE = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){10,30}\b/g;
// Telefon: +49… oder 0… mit Ziffern/Spaces/Bindestrichen/Slashes, min. 6 Folgezeichen
const PHONE_RE = /(?:\+\d{1,3}|0)[\d\s\-/()]{6,}\d/g;

function maskNames(text: string): string {
  let out = text;
  for (const name of KNOWN_FIRST_NAMES) {
    // Wortgrenzen, case-insensitive
    const re = new RegExp(`\\b${name}\\b`, "gi");
    out = out.replace(re, "[NAME]");
  }
  return out;
}

/**
 * Maskiert PII im Text. Reihenfolge wichtig: IBAN vor Phone (IBAN enthält
 * Ziffernblöcke), Email vor allem (enthält keine Ziffern-Kollision).
 */
export function sanitizeForAI(text: string): string {
  if (!text) return "";
  let out = text;
  out = out.replace(EMAIL_RE, "[EMAIL]");
  out = out.replace(IBAN_RE, "[IBAN]");
  out = out.replace(PHONE_RE, "[PHONE]");
  out = maskNames(out);
  return out.trim();
}
