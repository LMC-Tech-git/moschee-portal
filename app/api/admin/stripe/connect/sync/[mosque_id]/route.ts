import { NextResponse, type NextRequest } from "next/server";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { requireMosqueAdmin } from "@/lib/auth/api-auth";
import { fetchAccountState } from "@/lib/stripe/connect";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/admin/stripe/connect/sync/[mosque_id]
 * Manueller Refresh des Stripe-Account-Status (für Admin-UI Button).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { mosque_id: string } }
) {
  const mosqueId = params.mosque_id;
  const auth = await requireMosqueAdmin(request, mosqueId);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const pb = await getAdminPB();
    const mosque = await pb.collection("mosques").getOne(mosqueId);

    if (!mosque.stripe_account_id) {
      return NextResponse.json(
        { error: "Kein Connect-Account vorhanden." },
        { status: 404 }
      );
    }

    const state = await fetchAccountState(mosque.stripe_account_id);

    await pb.collection("mosques").update(mosqueId, {
      stripe_charges_enabled: state.chargesEnabled,
      stripe_payouts_enabled: state.payoutsEnabled,
      stripe_details_submitted: state.detailsSubmitted,
      stripe_requirements_currently_due: state.currentlyDue,
      stripe_requirements_eventually_due: state.eventuallyDue,
      stripe_last_synced_at: new Date().toISOString(),
    });

    logAudit({
      mosqueId,
      userId: auth.user.id,
      action: "stripe.connect.synced",
      entityType: "mosque",
      entityId: mosqueId,
      details: {
        charges_enabled: state.chargesEnabled,
        payouts_enabled: state.payoutsEnabled,
        currently_due_count: state.currentlyDue.length,
      },
    });

    return NextResponse.json({ ok: true, state });
  } catch (err) {
    console.error("[Connect/sync]", err);
    return NextResponse.json({ error: "Sync fehlgeschlagen." }, { status: 500 });
  }
}
