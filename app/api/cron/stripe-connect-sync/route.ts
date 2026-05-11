import { NextRequest, NextResponse } from "next/server";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { fetchAccountState } from "@/lib/stripe/connect";

export const dynamic = "force-dynamic";

/**
 * Täglicher Cron: synchronisiert Stripe-Account-Status aller Moscheen
 * mit Connect-Account. Fängt verpasste Webhooks, neue KYC-Anforderungen
 * und Document-Expiry ab.
 *
 * Aufruf per VPS-Crontab (täglich 4 Uhr):
 *   0 4 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://moschee.app/api/cron/stripe-connect-sync
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret) {
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const pb = await getAdminPB();
    const mosques = await pb.collection("mosques").getFullList({
      filter: `stripe_account_id != ""`,
      fields: "id,name,stripe_account_id",
    });

    let synced = 0;
    let failed = 0;
    const errors: { mosque_id: string; error: string }[] = [];

    for (const m of mosques) {
      try {
        const state = await fetchAccountState(m.stripe_account_id);
        await pb.collection("mosques").update(m.id, {
          stripe_charges_enabled: state.chargesEnabled,
          stripe_payouts_enabled: state.payoutsEnabled,
          stripe_details_submitted: state.detailsSubmitted,
          stripe_requirements_currently_due: state.currentlyDue,
          stripe_requirements_eventually_due: state.eventuallyDue,
          stripe_last_synced_at: new Date().toISOString(),
        });
        synced++;
      } catch (err) {
        failed++;
        errors.push({ mosque_id: m.id, error: String((err as Error).message) });
        console.error(`[Cron/stripe-sync] Mosque ${m.id} fehlgeschlagen:`, err);
      }
    }

    return NextResponse.json({
      ok: true,
      total: mosques.length,
      synced,
      failed,
      errors,
    });
  } catch (err) {
    console.error("[Cron/stripe-connect-sync]", err);
    return NextResponse.json(
      { error: "Sync fehlgeschlagen.", message: String((err as Error).message) },
      { status: 500 }
    );
  }
}
