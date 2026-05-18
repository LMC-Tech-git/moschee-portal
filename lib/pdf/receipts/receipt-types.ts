/**
 * Reines Datenmodell für die Spendenbescheinigung — getrennt vom Rendering.
 *
 * `schemaVersion` macht erzeugte PDFs reproduzierbar und erlaubt spätere
 * Migrationen / Snapshot-Persistenz (Renderer kann versionsabhängig bauen).
 */
export const RECEIPT_SCHEMA_VERSION = 1 as const;

export type ReceiptMode = "einzel" | "sammel";

export interface ReceiptVerein {
  name: string;
  /** Mehrzeilige Anschrift (settings.verein_anschrift, Fallback Moschee-Adresse). */
  anschrift: string;
  steuernummer: string;
  /** Frei konfigurierbarer Freistellungsbescheid-Satz inkl. Finanzamt/Datum. */
  freistellungsbescheidText: string;
  /** Konfigurierbarer Förderzweck (nicht hardcoden). */
  foerderzweck: string;
}

export interface ReceiptDonor {
  name: string;
  /** Mehrzeilige Anschrift; leer wenn nicht hinterlegt. */
  anschrift: string;
  membershipNumber: string;
  /** true wenn keine Adresse hinterlegt — steuerlich unvollständig. */
  addressMissing: boolean;
}

export interface ReceiptDonationLine {
  date: string; // ISO
  amountCents: number;
  /** Art/Zahlungsart, z.B. "Kreditkarte (Stripe)". */
  art: string;
}

export interface ReceiptPdfData {
  schemaVersion: typeof RECEIPT_SCHEMA_VERSION;
  mode: ReceiptMode;
  verein: ReceiptVerein;
  donor: ReceiptDonor;
  year: number;
  donations: ReceiptDonationLine[];
  totalCents: number;
  totalInWords: string;
  /** Erster/letzter Spendentermin (für Sammelbestätigung-Zeitraum). */
  periodFrom: string | null;
  periodTo: string | null;
  /** Technischer Erzeugungszeitpunkt (ISO). */
  generatedAt: string;
  /**
   * Offizielles Ausstellungsdatum (ISO, tagesgenau).
   * MVP ohne Snapshot-Persistenz: = generatedAt-Datum → gleiche Daten am
   * selben Tag ergeben identisches Dokument.
   */
  issuedAt: string;
}

/** Mehrere Spender → ein mehrseitiges PDF (1 Seite pro Spender). */
export interface ReceiptCollectionData {
  schemaVersion: typeof RECEIPT_SCHEMA_VERSION;
  receipts: ReceiptPdfData[];
}
