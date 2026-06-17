/**
 * EPC069-12 ("Girocode" / GiroCode) String-Builder für SEPA-Überweisungs-QR-Codes.
 *
 * Reine Berechnung, kein I/O. Der erzeugte String wird in einen QR-Code kodiert;
 * deutsche/europäische Banking-Apps scannen ihn und füllen Empfänger, IBAN, Betrag
 * und Verwendungszweck automatisch aus.
 *
 * Format (Version 002, UTF-8) — 11 Felder, \n-getrennt:
 *   BCD | 002 | 1 | SCT | <BIC> | <Name> | <IBAN> | <Betrag> | <Purpose> | <Ref> | <Verwendungszweck>
 */

const SERVICE_TAG = "BCD";
const VERSION = "002"; // 002 = BIC optional
const CHARSET = "1"; // 1 = UTF-8
const IDENTIFICATION = "SCT"; // SEPA Credit Transfer

const MAX_NAME_BYTES = 70;
const MAX_REMITTANCE_BYTES = 140;

// Steuerzeichen (inkl. \r \n \t) — via Escapes, nicht als Literal, um sie nicht
// versehentlich roh in die Quelldatei zu schreiben.
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F]", "g");
const WHITESPACE = /\s+/g;

/**
 * Entfernt Newlines/Steuerzeichen (EPC-Felder sind \n-delimitiert — ein Newline
 * im Namen/Verwendungszweck würde alle Folgefelder verschieben und den QR korrumpieren)
 * und kollabiert Mehrfach-Whitespace.
 */
function sanitizeLine(value: string): string {
  return value.replace(CONTROL_CHARS, " ").replace(WHITESPACE, " ").trim();
}

/**
 * Kürzt einen String auf eine maximale UTF-8-Byte-Länge (nicht Zeichen!).
 * Umlaute (ä/ö/ü/ß) = 2 Bytes — das EPC-Limit ist in Bytes definiert.
 * Bricht nicht mitten in einem Mehrbyte-Zeichen ab.
 */
function truncateBytes(value: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  if (encoder.encode(value).length <= maxBytes) return value;

  let result = "";
  let bytes = 0;
  for (const char of value) {
    const charBytes = encoder.encode(char).length;
    if (bytes + charBytes > maxBytes) break;
    result += char;
    bytes += charBytes;
  }
  return result;
}

/**
 * Normalisiert eine IBAN: entfernt Whitespace, uppercase.
 */
export function normalizeIban(raw: string): string {
  return (raw || "").replace(WHITESPACE, "").toUpperCase();
}

/**
 * Validiert eine IBAN per mod-97-Prüfsumme (ISO 13616).
 * Fängt Admin-Tippfehler ab, die eine reine Längen-/Prefix-Prüfung durchließe.
 */
export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (iban.length < 15 || iban.length > 34) return false;
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) return false;

  // Ersten 4 Zeichen ans Ende, Buchstaben → Zahlen (A=10 … Z=35)
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const code = char.charCodeAt(0);
    const value = code >= 65 && code <= 90 ? code - 55 : code - 48; // A-Z : 0-9
    remainder = (remainder * (value > 9 ? 100 : 10) + value) % 97;
  }
  return remainder === 1;
}

export interface GirocodeInput {
  name: string;
  iban: string;
  bic?: string;
  amountCents?: number;
  remittance?: string;
  purposeCode?: string;
}

/**
 * Baut den EPC069-12-String. Gibt `null` zurück, wenn Name oder IBAN fehlen
 * oder die IBAN ungültig ist (→ kein QR rendern, Klartext-Fallback nutzen).
 */
export function buildGirocodeString(input: GirocodeInput): string | null {
  const name = truncateBytes(sanitizeLine(input.name || ""), MAX_NAME_BYTES);
  const iban = normalizeIban(input.iban);

  if (!name || !isValidIban(iban)) return null;

  const bic = sanitizeLine(input.bic || "").toUpperCase();

  let amount = "";
  if (typeof input.amountCents === "number" && input.amountCents > 0) {
    amount = `EUR${(input.amountCents / 100).toFixed(2)}`;
  }

  const purpose = sanitizeLine(input.purposeCode ?? "CHAR");
  const remittance = truncateBytes(
    sanitizeLine(input.remittance || ""),
    MAX_REMITTANCE_BYTES
  );

  // Genau 11 Felder — Feld 12 (Beneficiary-to-Originator) weglassen, kein trailing \n.
  const lines = [
    SERVICE_TAG,
    VERSION,
    CHARSET,
    IDENTIFICATION,
    bic,
    name,
    iban,
    amount,
    purpose,
    "", // Structured Reference (leer)
    remittance,
  ];

  return lines.join("\n");
}
