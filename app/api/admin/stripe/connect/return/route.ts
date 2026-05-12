import { NextResponse, type NextRequest } from "next/server";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { fetchAccountState, verifyOnboardingState } from "@/lib/stripe/connect";
import { logAudit } from "@/lib/audit";

/**
 * GET /api/admin/stripe/connect/return?state=<signed-token>
 *
 * Stripe redirected hierher nach abgeschlossenem Onboarding.
 * mosque_id kommt ausschließlich aus dem verified state-token —
 * NIEMALS aus Query/Body (Cross-Tenant-Schutz).
 */
export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state") || "";
  const payload = verifyOnboardingState(state);

  if (!payload) {
    return NextResponse.json(
      { error: "Ungültiger oder abgelaufener Link." },
      { status: 400 }
    );
  }

  try {
    const pb = await getAdminPB();
    const mosque = await pb.collection("mosques").getOne(payload.mosque_id);

    if (!mosque.stripe_account_id) {
      return NextResponse.json(
        { error: "Kein Connect-Account gefunden." },
        { status: 404 }
      );
    }

    const state = await fetchAccountState(mosque.stripe_account_id);

    const updateData: Record<string, unknown> = {
      stripe_charges_enabled: state.chargesEnabled,
      stripe_payouts_enabled: state.payoutsEnabled,
      stripe_details_submitted: state.detailsSubmitted,
      stripe_requirements_currently_due: state.currentlyDue,
      stripe_requirements_eventually_due: state.eventuallyDue,
      stripe_card_payments_status: state.cardPaymentsStatus,
      stripe_sepa_debit_payments_status: state.sepaDebitPaymentsStatus,
      stripe_last_synced_at: new Date().toISOString(),
    };

    // Erstmaliger Abschluss: onboarded_at setzen
    if (state.detailsSubmitted && !mosque.stripe_onboarded_at) {
      updateData.stripe_onboarded_at = new Date().toISOString();
    }

    await pb.collection("mosques").update(mosque.id, updateData);

    logAudit({
      mosqueId: mosque.id,
      action: "stripe.connect.onboarding_returned",
      entityType: "mosque",
      entityId: mosque.id,
      details: {
        charges_enabled: state.chargesEnabled,
        payouts_enabled: state.payoutsEnabled,
        details_submitted: state.detailsSubmitted,
        currently_due_count: state.currentlyDue.length,
      },
    });

    // Zurück zum Admin-Settings (Tab "Auszahlungen")
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
    const origin = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : request.nextUrl.origin;

    return NextResponse.redirect(`${origin}/admin/settings?tab=payouts&onboarded=1`, 302);
  } catch (err) {
    console.error("[Connect/return]", err);
    return NextResponse.json({ error: "Verarbeitung fehlgeschlagen." }, { status: 500 });
  }
}
