import { NextResponse, type NextRequest } from "next/server";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { createOnboardingLink } from "@/lib/stripe/connect";

/**
 * GET /api/admin/stripe/connect/refresh/[mosque_id]
 * Stripe ruft diese URL auf, wenn ein AccountLink expired ist.
 * Erzeugt einen neuen Link und redirected darauf.
 *
 * Hinweis: kein Auth-Check — Stripe ruft direkt, ohne unsere Session.
 * mosque_id wird gegen DB validiert; falls Connect-Account existiert,
 * neuer Link erzeugt, sonst 404.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { mosque_id: string } }
) {
  try {
    const mosqueId = params.mosque_id;
    const pb = await getAdminPB();
    const mosque = await pb.collection("mosques").getOne(mosqueId);

    if (!mosque.stripe_account_id) {
      return NextResponse.json(
        { error: "Kein Connect-Account angelegt." },
        { status: 404 }
      );
    }

    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
    const origin = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : request.nextUrl.origin;

    const url = await createOnboardingLink(mosque.stripe_account_id, mosqueId, origin);
    return NextResponse.redirect(url, 302);
  } catch (err) {
    console.error("[Connect/refresh]", err);
    return NextResponse.json({ error: "Refresh fehlgeschlagen." }, { status: 500 });
  }
}
