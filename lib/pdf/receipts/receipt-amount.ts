/**
 * Zentrale Betrags-Normalisierung für Spenden.
 *
 * PocketBase `donations` hat `amount` (EUR float, Pflichtfeld) UND `amount_cents`
 * (optional). Beide können auseinanderlaufen — hier EINE Quelle der Wahrheit.
 */
export function normalizeDonationAmountCents(record: {
  amount_cents?: number;
  amount?: number;
}): number {
  if (typeof record.amount_cents === "number" && record.amount_cents > 0) {
    return Math.round(record.amount_cents);
  }
  return Math.round((record.amount || 0) * 100);
}

/**
 * Steuerlich gültige Spenden-Status für die Zuwendungsbestätigung.
 *
 * NUR abgeschlossene, tatsächlich vereinnahmte Zahlungen dürfen bescheinigt
 * werden. Refund/Chargeback/Storno NICHT — sonst entstehen Steuerprobleme
 * (zu Unrecht bescheinigte Spende). Bewusst eng gehalten.
 *
 * Wiederverwendbar für PDF / CSV / Analytics / Admin-KPIs, damit alle
 * Auswertungen konsistent denselben Spendenbegriff verwenden.
 */
export const RECEIPT_ELIGIBLE_STATUSES = ["paid"] as const;

export function isReceiptEligible(record: {
  status?: string;
  amount_cents?: number;
  amount?: number;
}): boolean {
  if (!RECEIPT_ELIGIBLE_STATUSES.includes((record.status || "") as "paid")) {
    return false;
  }
  return normalizeDonationAmountCents(record) > 0;
}
