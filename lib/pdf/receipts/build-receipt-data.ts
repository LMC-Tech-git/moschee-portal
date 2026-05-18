import { getDonationEffectiveDate } from "@/lib/utils";
import { normalizeDonationAmountCents, isReceiptEligible } from "./receipt-amount";
import { euroInWords } from "./number-to-words-de";
import {
  RECEIPT_SCHEMA_VERSION,
  type ReceiptPdfData,
  type ReceiptMode,
  type ReceiptVerein,
  type ReceiptDonor,
  type ReceiptDonationLine,
} from "./receipt-types";

/** Rohdatensatz aus der `donations`-Collection (nur benötigte Felder). */
export interface RawDonationRecord {
  status?: string;
  amount?: number;
  amount_cents?: number;
  provider?: string;
  paid_at?: string;
  created?: string;
}

/** Zahlungsart für die Bescheinigung (deutsch, lesbar). */
export function formatDonationArt(provider: string): string {
  switch (provider) {
    case "stripe":
      return "Geldzuwendung (Kreditkarte)";
    case "sepa":
      return "Geldzuwendung (SEPA-Lastschrift)";
    case "paypal_link":
      return "Geldzuwendung (PayPal)";
    case "manual":
      return "Geldzuwendung (Barzahlung)";
    case "external":
      return "Geldzuwendung (Überweisung)";
    default:
      return "Geldzuwendung";
  }
}

/**
 * Baut das reine Datenobjekt für die PDF-Bescheinigung.
 *
 * Verantwortlich für: Filterung (nur steuerlich gültige Spenden), Aggregation,
 * deterministische Sortierung (chronologisch ASC), Summe, Zahlwort, Zeitraum.
 * KEIN Rendering — wiederverwendbar für PDF / E-Mail-Anhang / Archiv.
 */
export function buildReceiptPdfData(input: {
  mode: ReceiptMode;
  verein: ReceiptVerein;
  donor: ReceiptDonor;
  year: number;
  rawDonations: RawDonationRecord[];
  /** Optional fixes Erzeugungsdatum (Tests/Reproduktion). Default: jetzt. */
  now?: Date;
}): ReceiptPdfData {
  const now = input.now ?? new Date();

  // Nur steuerlich gültige Spenden des Jahres.
  const eligible = input.rawDonations.filter((r) => {
    if (!isReceiptEligible(r)) return false;
    const d = getDonationEffectiveDate(r);
    return d !== null && d.getFullYear() === input.year;
  });

  // Deterministische Sortierung: chronologisch aufsteigend.
  const sorted = [...eligible].sort((a, b) => {
    const da = getDonationEffectiveDate(a)?.getTime() ?? 0;
    const db = getDonationEffectiveDate(b)?.getTime() ?? 0;
    return da - db;
  });

  const donations: ReceiptDonationLine[] = sorted.map((r) => ({
    date: (getDonationEffectiveDate(r) ?? now).toISOString(),
    amountCents: normalizeDonationAmountCents(r),
    art: formatDonationArt(r.provider || ""),
  }));

  const totalCents = donations.reduce((s, d) => s + d.amountCents, 0);

  const periodFrom = donations.length > 0 ? donations[0].date : null;
  const periodTo =
    donations.length > 0 ? donations[donations.length - 1].date : null;

  // issuedAt tagesgenau (ohne Zeit) → reproduzierbar am selben Tag.
  const issuedAt = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).toISOString();

  return {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    mode: input.mode,
    verein: input.verein,
    donor: input.donor,
    year: input.year,
    donations,
    totalCents,
    totalInWords: euroInWords(totalCents),
    periodFrom,
    periodTo,
    generatedAt: now.toISOString(),
    issuedAt,
  };
}
