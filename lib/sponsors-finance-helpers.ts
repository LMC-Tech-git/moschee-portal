/**
 * Sponsor ↔ Finance Helpers (Sprint 5).
 *
 * KEIN "use server" — pure/sync, importierbar aus Tests + "use server"-Actions.
 */

import type { KontoTyp, Zahlungskanal } from "@/types";

/** Konto-/Kanal-Mapping aus Zahlungsmethode eines Förderpartners. */
export function sponsorToKontoChannel(
  method: string | undefined | null
): { kontoTyp: KontoTyp; zahlungskanal: Zahlungskanal } {
  switch (method) {
    case "cash":
      return { kontoTyp: "cash", zahlungskanal: "bar" };
    case "transfer":
      return { kontoTyp: "bank", zahlungskanal: "ueberweisung" };
    case "stripe":
      return { kontoTyp: "bank", zahlungskanal: "stripe" };
    default:
      return { kontoTyp: "bank", zahlungskanal: "sonstige" };
  }
}
