import { NextRequest, NextResponse } from "next/server";
import { cleanupAbandonedPendingSubscriptions } from "@/lib/actions/recurring-donations";

export const dynamic = "force-dynamic";

/**
 * Täglicher Cron: verwaiste pending-Subscriptions aufräumen.
 * Stripe-abgebrochene Checkouts → PB-Record löschen oder synchronisieren.
 *
 * Aufruf:
 *   0 3 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://moschee.app/api/cron/cleanup-pending-subscriptions
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret) {
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await cleanupAbandonedPendingSubscriptions(24);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, ...result.data });
}
