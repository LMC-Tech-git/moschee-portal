import Stripe from "stripe";
import type { Mosque, Settings, StripeHealth } from "@/types";

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

/**
 * Prüft ob SEPA-Lastschrift für diese Moschee verfügbar ist.
 * Server-Seite Authority — Client-Flag ist nur UI-Hint.
 *
 * Regeln:
 * - settings.sepa_enabled muss true sein
 * - payments_mode darf nicht "disabled" sein
 * - platform_legacy: Env-Flag PLATFORM_SEPA_ENABLED steuert (DEPRECATED, nur Demo + Übergang)
 * - connect_*: Capability sepa_debit_payments muss "active" sein
 */
export function sepaAvailable(
  mosque: Pick<Mosque, "payments_mode" | "stripe_account_id" | "stripe_sepa_debit_payments_status">,
  settings: Pick<Settings, "sepa_enabled">
): boolean {
  if (!settings.sepa_enabled) return false;
  if (mosque.payments_mode === "disabled") return false;
  if (mosque.payments_mode === "platform_legacy") {
    // DEPRECATED: nur Demo + Übergangsmigration.
    // TODO: remove platform_legacy SEPA after full Connect migration.
    return process.env.PLATFORM_SEPA_ENABLED === "true";
  }
  return (
    !!mosque.stripe_account_id &&
    mosque.stripe_sepa_debit_payments_status === "active"
  );
}

/**
 * Bewertet wie veraltet der lokale Capability-Cache ist.
 * Stripe ist Source of Truth — bei stale-Status Sync empfehlen.
 */
export function capabilityStaleness(
  lastSyncedAt: string
): "fresh" | "stale" | "very_stale" {
  if (!lastSyncedAt) return "very_stale";
  const ageMs = Date.now() - new Date(lastSyncedAt).getTime();
  if (ageMs < 24 * 60 * 60 * 1000) return "fresh";
  if (ageMs < 7 * 24 * 60 * 60 * 1000) return "stale";
  return "very_stale";
}
