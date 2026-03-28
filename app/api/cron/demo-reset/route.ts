import { NextRequest, NextResponse } from "next/server";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { resetDemoData } from "@/lib/demo/seed";

export const dynamic = "force-dynamic";
// Reset kann 10–20 Sek. dauern
export const maxDuration = 60;

/**
 * Wöchentlicher Cron-Job: Demo-Daten zurücksetzen damit Events immer aktuelle Daten haben.
 *
 * Aufruf per VPS-Crontab (jeden Montag 03:00):
 *   0 3 * * 1 curl -s -H "Authorization: Bearer $CRON_SECRET" https://demo.moschee.app/api/cron/demo-reset
 */
export async function GET(request: NextRequest) {
  // Bearer-Token prüfen (gleiche Logik wie sponsor-reminders)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret) {
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const pb = await getAdminPB();
    const mosque = await pb.collection("mosques").getFirstListItem('slug = "demo"');
    const result = await resetDemoData(mosque.id);

    return NextResponse.json({
      ok: true,
      mosqueId: mosque.id,
      deletedCount: result.deletedCount,
      createdCount: result.createdCount,
      durationMs: result.durationMs,
    });
  } catch (error) {
    console.error("[cron/demo-reset]", error);
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
