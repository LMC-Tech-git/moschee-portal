import { NextResponse, type NextRequest } from "next/server";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { sendEmailDirect } from "@/lib/email";
import { renderFeeReminder } from "@/lib/email/templates";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/email/fee-reminders
 *
 * Automatische Gebühren-Erinnerungen (Cron-Job).
 * Prüft alle Moscheen mit aktivierter Auto-Erinnerung,
 * ob heute der konfigurierte Erinnerungstag ist,
 * und sendet E-Mails an Eltern mit offenen Gebühren.
 *
 * Auth: X-API-Secret Header (gleicher CRON_SECRET wie process-queue)
 *
 * Cron-Setup: Täglich um 08:00 POST an https://domain.de/api/email/fee-reminders
 * mit Header: X-API-Secret: <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  try {
    // Auth via API-Secret
    const apiSecret = request.headers.get("x-api-secret");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || apiSecret !== cronSecret) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const pb = await getAdminPB();
    const today = new Date();
    const todayDay = today.getDate();

    // Aktuellen Monat als YYYY-MM Key
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    // Alle Settings mit aktivierter Auto-Erinnerung laden
    let allSettings: any[] = [];
    try {
      allSettings = await pb.collection("settings").getFullList({
        filter: `fee_reminder_enabled = true && madrasa_fees_enabled = true`,
      });
    } catch {
      allSettings = [];
    }

    let processedMosques = 0;
    let totalSent = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (let si = 0; si < allSettings.length; si++) {
      const settings = allSettings[si];
      const reminderDay = settings.fee_reminder_day || 15;

      // Nur am konfigurierten Tag senden
      if (reminderDay !== todayDay) continue;

      const mosqueId = settings.mosque_id;
      processedMosques++;

      try {
        // Moschee laden
        const mosque = await pb.collection("mosques").getOne(mosqueId);

        // Base-URL für Payment-Links
        const baseUrl = mosque.slug
          ? `${process.env.NEXT_PUBLIC_BASE_URL || "https://moschee.app"}/member/profile`
          : "";

        // Offene Gebühren ohne bisherige Mahnung
        const fees = await pb.collection("student_fees").getFullList({
          filter: `mosque_id = "${mosqueId}" && month_key = "${monthKey}" && status = "open" && reminder_sent_at = ""`,
        });

        if (fees.length === 0) continue;

        // Monat formatieren
        const [year, month] = monthKey.split("-");
        const monthLabel = new Date(parseInt(year), parseInt(month) - 1, 1)
          .toLocaleDateString("de-DE", { month: "long", year: "numeric" });

        let sent = 0;
        let skipped = 0;
        let failed = 0;

        for (let i = 0; i < fees.length; i++) {
          const fee = fees[i];

          try {
            const student = await pb.collection("students").getOne(fee.student_id);
            if (!student.parent_id) {
              skipped++;
              continue;
            }

            const parent = await pb.collection("users").getOne(student.parent_id);
            if (!parent.email) {
              skipped++;
              continue;
            }

            const amountEur = ((fee.amount_cents as number) / 100).toFixed(2).replace(".", ",");

            // Deep-Link: Profil → Madrasa-Tab mit vorausgewähltem Monat
            const paymentUrl = baseUrl
              ? `${baseUrl}?tab=madrasa&month=${monthKey}`
              : undefined;

            const html = renderFeeReminder({
              mosqueName: mosque.name,
              parentName: parent.name || undefined,
              studentName: `${student.first_name} ${student.last_name}`,
              monthLabel,
              amountEur,
              paymentUrl,
              accentColor: settings.brand_primary_color || mosque.brand_primary_color || undefined,
            });

            const sendResult = await sendEmailDirect({
              to: parent.email,
              subject: `Erinnerung: Madrasa-Gebühr ${monthLabel} — ${mosque.name}`,
              html,
            });

            if (sendResult.success) {
              await pb.collection("student_fees").update(fee.id, {
                reminder_sent_at: new Date().toISOString(),
              });
              sent++;
            } else {
              failed++;
            }

            // Rate-Limit
            if (i < fees.length - 1) {
              await new Promise((r) => setTimeout(r, 200));
            }
          } catch {
            failed++;
          }
        }

        totalSent += sent;
        totalSkipped += skipped;
        totalFailed += failed;

        // Audit pro Moschee
        if (sent > 0) {
          await logAudit({
            mosqueId,
            userId: "system",
            action: "fee_reminder.auto_sent",
            entityType: "student_fees",
            entityId: "",
            details: { month_key: monthKey, sent, skipped, failed },
          });
        }
      } catch (err) {
        console.error(`[fee-reminders] Fehler bei Moschee ${mosqueId}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      today_day: todayDay,
      month_key: monthKey,
      processed_mosques: processedMosques,
      total_sent: totalSent,
      total_skipped: totalSkipped,
      total_failed: totalFailed,
    });
  } catch (error) {
    console.error("[fee-reminders] Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// Auch GET erlauben (für einfache Cron-Dienste)
export async function GET(request: NextRequest) {
  return POST(request);
}
