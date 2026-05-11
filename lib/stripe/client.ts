import Stripe from "stripe";
import type { Mosque, StripeHealth } from "@/types";

/**
 * Zentrale Stripe-Client-Factory.
 * Ersetzt 5 duplizierte `new Stripe(...)`-Aufrufe.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY fehlt");
  }
  return new Stripe(key, {
    apiVersion: (process.env.STRIPE_API_VERSION || "2024-06-20") as Stripe.LatestApiVersion,
  });
}

/**
 * Berechnet den Connect-Health-Status einer Moschee live aus den
 * persistierten Stripe-Feldern. NIEMALS persistieren — sonst stale state.
 */
export function computeStripeHealth(
  mosque: Pick<
    Mosque,
    | "payments_mode"
    | "stripe_account_id"
    | "stripe_details_submitted"
    | "stripe_charges_enabled"
    | "stripe_requirements_currently_due"
  >
): StripeHealth {
  if (mosque.payments_mode === "disabled") return "disabled";
  if (!mosque.stripe_account_id || !mosque.stripe_details_submitted) {
    return "pending";
  }
  const dueCount = (mosque.stripe_requirements_currently_due || []).length;
  if (!mosque.stripe_charges_enabled || dueCount > 0) return "restricted";
  return "healthy";
}

/**
 * Liefert StripeAccount-Option für Direct Charges, oder undefined
 * für platform_legacy (Legacy-Plattform-Konto, Übergangsphase).
 *
 * Wirft bei:
 * - payments_mode === "disabled"
 * - Connect-Modus aber Onboarding unvollständig
 */
export function stripeAccountFor(
  mosque: Pick<Mosque, "payments_mode" | "stripe_account_id" | "stripe_charges_enabled">
): { stripeAccount: string } | undefined {
  switch (mosque.payments_mode) {
    case "disabled":
      throw new Error("Zahlungen für diese Moschee deaktiviert");
    case "platform_legacy":
      return undefined;
    case "connect_test":
    case "connect_live":
      if (!mosque.stripe_account_id || !mosque.stripe_charges_enabled) {
        throw new Error("Stripe-Onboarding noch nicht abgeschlossen");
      }
      return { stripeAccount: mosque.stripe_account_id };
    default:
      // Wert nicht gesetzt → wie platform_legacy
      return undefined;
  }
}
