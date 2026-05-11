import { NextResponse, type NextRequest } from "next/server";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { requireMosqueAdmin } from "@/lib/auth/api-auth";
import {
  createConnectAccount,
  createOnboardingLink,
} from "@/lib/stripe/connect";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/admin/stripe/connect/start
 * Startet das Stripe Connect Onboarding für eine Moschee.
 * - Race-safe Account-Create (Re-read + Reuse falls bereits angelegt)
 * - Signed state-token für return-URL
 * - Audit-Log
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mosqueId = String(body.mosque_id || "").trim();
    if (!mosqueId) {
      return NextResponse.json({ error: "mosque_id fehlt" }, { status: 400 });
    }

    const auth = await requireMosqueAdmin(request, mosqueId);
    if (auth.error) {
      return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
    }

    const pb = await getAdminPB();
    const mosque = await pb.collection("mosques").getOne(mosqueId);

    let accountId: string = mosque.stripe_account_id || "";

    if (!accountId) {
      // Race-Safe: zwischenzeitliche Anlage durch zweiten Tab abfangen
      accountId = await createConnectAccount({
        id: mosque.id,
        slug: mosque.slug,
        email: mosque.email,
      });

      const refresh = await pb.collection("mosques").getOne(mosqueId);
      if (!refresh.stripe_account_id) {
        const defaultMode = process.env.STRIPE_DEFAULT_CONNECT_MODE || "connect_test";
        await pb.collection("mosques").update(mosqueId, {
          stripe_account_id: accountId,
          payments_mode: defaultMode,
        });
        logAudit({
          mosqueId,
          userId: auth.user.id,
          action: "stripe.connect.onboarding_started",
          entityType: "mosque",
          entityId: mosqueId,
          details: {
            account_id_redacted: accountId.slice(0, 10) + "...",
            mode: defaultMode,
          },
        });
      } else {
        // Race verloren — anderen Account ignorieren (orphan in Stripe)
        accountId = refresh.stripe_account_id;
        console.warn("[Connect/start] Race condition: reusing existing account", accountId);
      }
    }

    // Origin aus Forwarded-Headers (Caddy proxiert)
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
    const origin = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : request.nextUrl.origin;

    const url = await createOnboardingLink(accountId, mosqueId, origin);

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[Connect/start]", err);
    return NextResponse.json(
      { error: "Onboarding konnte nicht gestartet werden." },
      { status: 500 }
    );
  }
}
