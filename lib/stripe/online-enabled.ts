import type { Mosque } from "@/types";

/**
 * Reiner Bool-Check: Darf diese Moschee JETZT Stripe-Online-Zahlungen
 * (Karte/SEPA via Stripe-Checkout) entgegennehmen?
 *
 * - disabled → nein
 * - platform_legacy → nur die Demo-Moschee (Test-Karte). Reale Moscheen
 *   ohne Connect-Onboarding dürfen NICHT aufs Plattform-Konto sammeln.
 * - connect_* → nur wenn Account verknüpft UND charges_enabled
 * - leer/unbekannt → nein
 *
 * Bewusst dep-frei (kein Stripe-SDK-Import): so auch in "use client"-
 * Komponenten nutzbar, ohne das Node-Stripe-SDK ins Client-Bundle zu ziehen.
 * Liest NEXT_PUBLIC_DEMO_MOSQUE_ID — server- wie clientseitig verfügbar.
 */
export function stripeOnlineEnabled(
  mosque: Pick<Mosque, "id" | "payments_mode" | "stripe_account_id" | "stripe_charges_enabled">
): boolean {
  const isDemo =
    !!process.env.NEXT_PUBLIC_DEMO_MOSQUE_ID &&
    mosque.id === process.env.NEXT_PUBLIC_DEMO_MOSQUE_ID;
  switch (mosque.payments_mode) {
    case "disabled":
      return false;
    case "platform_legacy":
      return isDemo;
    case "connect_test":
    case "connect_live":
      return !!mosque.stripe_account_id && !!mosque.stripe_charges_enabled;
    default:
      return false;
  }
}
