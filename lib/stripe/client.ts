import Stripe from "stripe";
import type { Mosque, Settings, StripeHealth } from "@/types";
import { stripeOnlineEnabled } from "./online-enabled";

// Re-Export für bestehende Importpfade (@/lib/stripe/client).
// Definition liegt dep-frei in ./online-enabled (Client-bundle-sicher).
export { stripeOnlineEnabled };

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
 * für die Demo-Moschee (platform_legacy, Plattform-Konto im Testmodus).
 *
 * Wirft, wenn die Moschee keine Stripe-Online-Zahlungen darf
 * (deaktiviert, kein/unvollständiges Connect-Onboarding, platform_legacy
 * außer Demo). Damit sind alle Charge-Flows zentral gesperrt, bis das
 * Onboarding abgeschlossen ist.
 */
export function stripeAccountFor(
  mosque: Pick<Mosque, "id" | "payments_mode" | "stripe_account_id" | "stripe_charges_enabled">
): { stripeAccount: string } | undefined {
  if (mosque.payments_mode === "disabled") {
    throw new Error("Zahlungen für diese Moschee deaktiviert");
  }
  if (!stripeOnlineEnabled(mosque)) {
    throw new Error("Stripe-Onboarding noch nicht abgeschlossen");
  }
  // Demo (platform_legacy) → Plattform-Konto; Connect → Direct Charge.
  if (mosque.payments_mode === "platform_legacy") {
    return undefined;
  }
  return { stripeAccount: mosque.stripe_account_id };
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
  mosque: Pick<Mosque, "id" | "payments_mode" | "stripe_account_id" | "stripe_sepa_debit_payments_status">,
  settings: Pick<Settings, "sepa_enabled">
): boolean {
  if (!settings.sepa_enabled) return false;
  if (mosque.payments_mode === "disabled") return false;
  if (mosque.payments_mode === "platform_legacy") {
    // DEPRECATED: nur Demo + Übergangsmigration.
    // Defense-in-depth: zusätzlich auf Demo gaten — nicht-onboardete
    // Moscheen dürfen kein SEPA aufs Plattform-Konto annehmen, auch
    // wenn PLATFORM_SEPA_ENABLED gesetzt wäre.
    // TODO: remove platform_legacy SEPA after full Connect migration.
    const isDemo =
      !!process.env.NEXT_PUBLIC_DEMO_MOSQUE_ID &&
      mosque.id === process.env.NEXT_PUBLIC_DEMO_MOSQUE_ID;
    return isDemo && process.env.PLATFORM_SEPA_ENABLED === "true";
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
