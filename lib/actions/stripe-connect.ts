"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { computeStripeHealth } from "@/lib/stripe/client";
import type { Mosque, StripeHealth } from "@/types";

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface StripeConnectStatus {
  mode: Mosque["payments_mode"];
  health: StripeHealth;
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  currentlyDue: string[];
  eventuallyDue: string[];
  onboardedAt: string;
  lastSyncedAt: string;
}

/**
 * Lädt den Stripe-Connect-Status einer Moschee (für Admin-UI).
 */
export async function getStripeConnectStatus(
  mosqueId: string
): Promise<ActionResult<StripeConnectStatus>> {
  try {
    const pb = await getAdminPB();
    const m = await pb.collection("mosques").getOne(mosqueId);
    const mosque = m as unknown as Mosque;

    return {
      success: true,
      data: {
        mode: mosque.payments_mode || "platform_legacy",
        health: computeStripeHealth(mosque),
        accountId: mosque.stripe_account_id || "",
        chargesEnabled: mosque.stripe_charges_enabled ?? false,
        payoutsEnabled: mosque.stripe_payouts_enabled ?? false,
        detailsSubmitted: mosque.stripe_details_submitted ?? false,
        currentlyDue: mosque.stripe_requirements_currently_due || [],
        eventuallyDue: mosque.stripe_requirements_eventually_due || [],
        onboardedAt: mosque.stripe_onboarded_at || "",
        lastSyncedAt: mosque.stripe_last_synced_at || "",
      },
    };
  } catch (err) {
    console.error("[stripe-connect] getStatus:", err);
    return { success: false, error: "Status konnte nicht geladen werden." };
  }
}
