import { NextRequest, NextResponse } from "next/server";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { checkExpiringSponsors, markSponsorNotificationSent } from "@/lib/actions/sponsors";
import { sendSponsorExpiryReminder } from "@/lib/actions/email";

export const dynamic = "force-dynamic";

/**
 * Täglicher Cron-Job: Ablaufende Sponsoren prüfen und Erinnerungen senden.
 *
 * Aufruf per VPS-Crontab:
 *   0 8 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://moschee.app/api/cron/sponsor-reminders
 */
export async function GET(request: NextRequest) {
  // Bearer-Token prüfen
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret) {
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const pb = await getAdminPB();

    // Alle Moscheen mit sponsors_enabled = true laden
    const settingsRecords = await pb.collection("settings").getFullList({
      filter: `sponsors_enabled = true`,
      fields: "mosque_id",
    });

    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (const setting of settingsRecords) {
      const mosqueId = setting.mosque_id as string;
      processed++;

      try {
        const { expiring } = await checkExpiringSponsors(mosqueId);

        for (const sponsor of expiring) {
          const result = await sendSponsorExpiryReminder(mosqueId, sponsor.id);
          if (result.success) {
            await markSponsorNotificationSent(sponsor.id);
            sent++;
          } else {
            failed++;
            console.error(`[cron/sponsor-reminders] Fehler für Sponsor ${sponsor.id}:`, result.error);
          }
        }
      } catch (err) {
        console.error(`[cron/sponsor-reminders] Fehler für Moschee ${mosqueId}:`, err);
        failed++;
      }
    }

    return NextResponse.json({
      ok: true,
      processed,
      sent,
      failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron/sponsor-reminders]", error);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
