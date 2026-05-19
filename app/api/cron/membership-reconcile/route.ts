import { NextRequest, NextResponse } from "next/server";
import { reconcileMembershipFees } from "@/lib/stripe/membership-reconcile";

export const dynamic = "force-dynamic";

/**
 * Täglicher Cron: Mitgliedsbeitrags-Reconcile (verpasste invoice.paid-
 * Webhooks nachziehen, Delta-Strategie via Account-Cursor).
 *
 * Aufruf:
 *   0 4 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://moschee.app/api/cron/membership-reconcile
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret) {
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await reconcileMembershipFees();
  if (!result.success) {
    return NextResponse.json({ error: "Reconcile fehlgeschlagen" }, { status: 500 });
  }
  return NextResponse.json(result);
}
