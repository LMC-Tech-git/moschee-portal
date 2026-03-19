"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { processEmailQueue, sendEmailDirect } from "@/lib/email";
import { renderFeeReminder } from "@/lib/email/templates";
import { logAudit } from "@/lib/audit";

// =========================================
// Queue verarbeiten (Newsletter + alle queued)
// =========================================

/**
 * Verarbeitet alle ausstehenden E-Mails einer Moschee.
 * Wird vom Admin über "Jetzt senden" Button ausgelöst.
 */
export async function processNewsletterQueue(
  mosqueId: string,
  userId: string
): Promise<{ success: boolean; sent?: number; failed?: number; error?: string }> {
  try {
    const result = await processEmailQueue(mosqueId);

    if (result.skipped === -1) {
      return { success: false, error: "E-Mail-Service nicht konfiguriert. Bitte RESEND_API_KEY setzen." };
    }

    await logAudit({
      mosqueId,
      userId,
      action: "newsletter.sent",
      entityType: "email_outbox",
      entityId: "",
      details: { sent: result.sent, failed: result.failed },
    });

    return { success: true, sent: result.sent, failed: result.failed };
  } catch (error) {
    console.error("[actions/email] processNewsletterQueue:", error);
    return { success: false, error: "Fehler beim Verarbeiten der E-Mail-Warteschlange" };
  }
}

// =========================================
// Queue-Statistik für Admin-UI
// =========================================

export async function getEmailQueueStats(mosqueId: string): Promise<{
  queued: number;
  sent: number;
  failed: number;
}> {
  try {
    const pb = await getAdminPB();

    const [queuedList, sentList, failedList] = await Promise.all([
      pb.collection("email_outbox").getList(1, 1, {
        filter: `mosque_id = "${mosqueId}" && status = "queued"`,
        fields: "id",
      }),
      pb.collection("email_outbox").getList(1, 1, {
        filter: `mosque_id = "${mosqueId}" && status = "sent"`,
        fields: "id",
      }),
      pb.collection("email_outbox").getList(1, 1, {
        filter: `mosque_id = "${mosqueId}" && status = "failed"`,
        fields: "id",
      }),
    ]);

    return {
      queued: queuedList.totalItems,
      sent: sentList.totalItems,
      failed: failedList.totalItems,
    };
  } catch (err) {
    console.error("[actions/email] getEmailQueueStats:", err);
    return { queued: 0, sent: 0, failed: 0 };
  }
}

// =========================================
// Gebühren-Mahnung (Madrasa)
// =========================================

/**
 * Sendet eine Mahnungs-E-Mail an die Eltern für eine offene Madrasa-Gebühr.
 */
export async function sendFeeReminderEmail(
  mosqueId: string,
  userId: string,
  feeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const pb = await getAdminPB();

    // Gebühr laden
    const fee = await pb.collection("student_fees").getOne(feeId);
    if (fee.mosque_id !== mosqueId) {
      return { success: false, error: "Ungültige Gebühr" };
    }
    if (fee.status !== "open") {
      return { success: false, error: "Nur offene Gebühren können gemahnt werden" };
    }

    // Schüler laden
    const student = await pb.collection("students").getOne(fee.student_id);
    if (!student.parent_id) {
      return { success: false, error: "Kein Elternteil dem Schüler zugeordnet" };
    }

    // Elternteil laden
    const parent = await pb.collection("users").getOne(student.parent_id);
    if (!parent.email) {
      return { success: false, error: "Elternteil hat keine E-Mail-Adresse" };
    }

    // Moschee für Namen laden
    const mosque = await pb.collection("mosques").getOne(mosqueId);

    // Monat formatieren: "2025-07" → "Juli 2025"
    const [year, month] = (fee.month_key as string).split("-");
    const monthLabel = new Date(parseInt(year), parseInt(month) - 1, 1)
      .toLocaleDateString("de-DE", { month: "long", year: "numeric" });

    const amountEur = ((fee.amount_cents as number) / 100).toFixed(2).replace(".", ",");

    // Deep-Link: Profil → Madrasa-Tab mit vorausgewähltem Monat
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://moschee.app";
    const paymentUrl = `${baseUrl}/member/profile?tab=madrasa&month=${fee.month_key}`;

    const html = renderFeeReminder({
      mosqueName: mosque.name,
      parentName: parent.name || undefined,
      studentName: `${student.first_name} ${student.last_name}`,
      monthLabel,
      amountEur,
      paymentUrl,
      accentColor: mosque.brand_primary_color || undefined,
    });

    const sendResult = await sendEmailDirect({
      to: parent.email,
      subject: `Erinnerung: Madrasa-Gebühr ${monthLabel} — ${mosque.name}`,
      html,
    });

    if (!sendResult.success) {
      return { success: false, error: sendResult.error || "E-Mail konnte nicht gesendet werden" };
    }

    // reminder_sent_at setzen
    await pb.collection("student_fees").update(feeId, {
      reminder_sent_at: new Date().toISOString(),
    });

    // Audit-Log
    await logAudit({
      mosqueId,
      userId,
      action: "fee_reminder.sent",
      entityType: "student_fees",
      entityId: feeId,
      details: {
        student: `${student.first_name} ${student.last_name}`,
        parent_email: parent.email,
        month_key: fee.month_key,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[actions/email] sendFeeReminderEmail:", error);
    return { success: false, error: "Fehler beim Senden der Mahnung" };
  }
}

// =========================================
// Massen-Gebühren-Mahnung (Madrasa)
// =========================================

/**
 * Sendet Mahnungs-E-Mails an alle Eltern mit offenen Madrasa-Gebühren
 * für einen bestimmten Monat.
 */
export async function sendBulkFeeReminders(
  mosqueId: string,
  userId: string,
  monthKey: string
): Promise<{ success: boolean; sent: number; skipped: number; failed: number; error?: string }> {
  try {
    const pb = await getAdminPB();

    // Moschee laden
    const mosque = await pb.collection("mosques").getOne(mosqueId);

    // Alle offenen Gebühren ohne bisherige Mahnung
    const fees = await pb.collection("student_fees").getFullList({
      filter: `mosque_id = "${mosqueId}" && month_key = "${monthKey}" && status = "open" && reminder_sent_at = ""`,
    });

    if (fees.length === 0) {
      return { success: true, sent: 0, skipped: 0, failed: 0 };
    }

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
        // Schüler laden
        const student = await pb.collection("students").getOne(fee.student_id);
        if (!student.parent_id) {
          skipped++;
          continue;
        }

        // Elternteil laden
        const parent = await pb.collection("users").getOne(student.parent_id);
        if (!parent.email) {
          skipped++;
          continue;
        }

        const amountEur = ((fee.amount_cents as number) / 100).toFixed(2).replace(".", ",");

        // Deep-Link: Profil → Madrasa-Tab mit vorausgewähltem Monat
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://moschee.app";
        const paymentUrl = `${baseUrl}/member/profile?tab=madrasa&month=${monthKey}`;

        const html = renderFeeReminder({
          mosqueName: mosque.name,
          parentName: parent.name || undefined,
          studentName: `${student.first_name} ${student.last_name}`,
          monthLabel,
          amountEur,
          paymentUrl,
          accentColor: mosque.brand_primary_color || undefined,
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

        // Rate-Limit: 200ms zwischen Sends
        if (i < fees.length - 1) {
          await new Promise((r) => setTimeout(r, 200));
        }
      } catch {
        failed++;
      }
    }

    // Audit-Log
    await logAudit({
      mosqueId,
      userId,
      action: "fee_reminder.bulk_sent",
      entityType: "student_fees",
      entityId: "",
      details: { month_key: monthKey, sent, skipped, failed },
    });

    return { success: true, sent, skipped, failed };
  } catch (error) {
    console.error("[actions/email] sendBulkFeeReminders:", error);
    return { success: false, sent: 0, skipped: 0, failed: 0, error: "Fehler beim Massen-Versand" };
  }
}

// =========================================
// Test-E-Mail
// =========================================

export async function sendTestEmailAction(
  toEmail: string
): Promise<{ success: boolean; error?: string }> {
  const { sendTestEmail } = await import("@/lib/email");
  const result = await sendTestEmail(toEmail);
  return result;
}
