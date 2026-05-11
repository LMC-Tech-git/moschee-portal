import { NextResponse, type NextRequest } from "next/server";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { requireMosqueAdmin } from "@/lib/auth/api-auth";
import { createDashboardLoginLink } from "@/lib/stripe/connect";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/admin/stripe/connect/dashboard/[mosque_id]
 * Liefert einen Stripe-Dashboard-Login-Link für den Connect-Account.
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

    const url = await createDashboardLoginLink(mosque.stripe_account_id);

    logAudit({
      mosqueId,
      userId: auth.user.id,
      action: "stripe.connect.dashboard_login",
      entityType: "mosque",
      entityId: mosqueId,
    });

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[Connect/dashboard]", err);
    return NextResponse.json(
      { error: "Dashboard-Link konnte nicht erzeugt werden." },
      { status: 500 }
    );
  }
}
