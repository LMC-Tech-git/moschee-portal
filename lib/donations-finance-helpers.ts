/**
 * Donation ↔ Finance Helpers (Plan §13.1-5, F4).
 *
 * KEIN "use server" — pure/sync Helper, damit aus Test-Skripten (tsx)
 * importierbar und in "use server"-Actions (nur async-Exports erlaubt) nutzbar.
 */

import type { RecordModel } from "pocketbase";
import type { KontoTyp, Zahlungskanal } from "@/types";

/**
 * F4: Nach `is_financially_locked` dürfen nur diese Felder editiert werden.
 * Finanzfelder (betrag/datum/status/kategorie) gesperrt. Korrektur per
 * kompensierender Buchung (Sprint 3) oder Refund (Sprint 5).
 */
export const DONATIONS_LOCKED_ALLOWLIST = new Set<string>(["interne_notiz", "tag"]);

export class DonationLockedError extends Error {
  forbiddenKeys: string[];
  constructor(forbiddenKeys: string[]) {
    super(
      `donation_financially_locked: cannot edit ${forbiddenKeys.join(",")} ` +
        `— use compensating transaction (Sprint 3) or refund flow (Sprint 5). Plan §11.`
    );
    this.name = "DonationLockedError";
    this.forbiddenKeys = forbiddenKeys;
  }
}

type DonationLike = RecordModel | Record<string, unknown>;

/** Wirft `DonationLockedError` falls Patch gesperrte Felder berührt. */
export function assertDonationEditAllowed(
  donation: DonationLike,
  patch: Record<string, unknown>
): void {
  if (!(donation as Record<string, unknown>).is_financially_locked) return;
  const forbidden = Object.keys(patch).filter((k) => !DONATIONS_LOCKED_ALLOWLIST.has(k));
  if (forbidden.length > 0) throw new DonationLockedError(forbidden);
}

/** Konto-/Kanal-Mapping aus Donation-Provider (Plan §13.1-5). */
export function donationToKontoChannel(
  d: DonationLike
): { kontoTyp: KontoTyp; zahlungskanal: Zahlungskanal } {
  const provider = String(d.provider || "");
  const pmDetail = String(d.payment_method_detail || "");
  if (provider === "stripe") return { kontoTyp: "bank", zahlungskanal: "stripe" };
  if (provider === "sepa") return { kontoTyp: "bank", zahlungskanal: "ueberweisung" };
  if (provider === "paypal_link") return { kontoTyp: "bank", zahlungskanal: "paypal" };
  if (provider === "manual") {
    if (/bar/i.test(pmDetail)) return { kontoTyp: "cash", zahlungskanal: "bar" };
    if (/überweis|ueberweis|transfer/i.test(pmDetail))
      return { kontoTyp: "bank", zahlungskanal: "ueberweisung" };
    return { kontoTyp: "bank", zahlungskanal: "sonstige" };
  }
  return { kontoTyp: "bank", zahlungskanal: "sonstige" };
}
