"use server";

import type { RecordModel } from "pocketbase";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { processEmailQueue, sendEmailDirect } from "@/lib/email";
import { renderFeeReminder, renderSponsorExpiryReminder } from "@/lib/email/templates";
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
 * Sucht das Elternteil eines Schülers über alle bekannten Verknüpfungs-Mechanismen:
 * 1. parent_child_relations (neue Junction-Tabelle, höchste Priorität)
 * 2. father_user_id (deprecated v4-Feld)
 * 3. mother_user_id (deprecated v4-Feld)
 * 4. parent_id (Legacy-Feld)
 * Gibt den ersten User zurück, der eine E-Mail-Adresse hat, oder null.
 */
async function resolveParentForStudent(
  pb: Awaited<ReturnType<typeof getAdminPB>>,
  student: RecordModel
): Promise<RecordModel | null> {
  // 1. parent_child_relations (neue Tabelle)
  try {
    const rels = await pb.collection("parent_child_relations").getList(1, 10, {
      filter: `student = "${student.id}"`,
      expand: "parent_user",
    });
    for (let i = 0; i < rels.items.length; i++) {
      const u = rels.items[i].expand?.parent_user as RecordModel | undefined;
      if (u?.email) return u;
    }
  } catch {
    // Collection existiert möglicherweise nicht auf älteren Instanzen
  }

  // 2. father_user_id (deprecated)
  if (student.father_user_id) {
    try {
      const u = await pb.collection("users").getOne(student.father_user_id);
      if (u?.email) return u;
    } catch { /* ignorieren */ }
  }

  // 3. mother_user_id (deprecated)
  if (student.mother_user_id) {
    try {
      const u = await pb.collection("users").getOne(student.mother_user_id);
      if (u?.email) return u;
    } catch { /* ignorieren */ }
  }

  // 4. parent_id (Legacy)
  if (student.parent_id) {
    try {
      const u = await pb.collection("users").getOne(student.parent_id);
      if (u?.email) return u;
    } catch { /* ignorieren */ }
  }

  return null;
}

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

    // Elternteil über alle Verknüpfungs-Mechanismen suchen
    const parent = await resolveParentForStudent(pb, student);
    if (!parent) {
      return { success: false, error: "Kein Elternteil dem Schüler zugeordnet" };
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
): Promise<{ success: boolean; sent: number; skippedNoContact: number; skippedAlreadyReminded: number; failed: number; error?: string }> {
  try {
    const pb = await getAdminPB();

    // Moschee laden
    const mosque = await pb.collection("mosques").getOne(mosqueId);

    // Alle offenen Gebühren für diesen Monat
    const fees = await pb.collection("student_fees").getFullList({
      filter: `mosque_id = "${mosqueId}" && month_key = "${monthKey}" && status = "open"`,
    });

    if (fees.length === 0) {
      return { success: true, sent: 0, skippedNoContact: 0, skippedAlreadyReminded: 0, failed: 0 };
    }

    // Monat formatieren
    const [year, month] = monthKey.split("-");
    const monthLabel = new Date(parseInt(year), parseInt(month) - 1, 1)
      .toLocaleDateString("de-DE", { month: "long", year: "numeric" });

    let sent = 0;
    let skippedNoContact = 0;    // kein Elternteil / keine E-Mail
    let skippedAlreadyReminded = 0; // bereits gemahnt
    let failed = 0;

    for (let i = 0; i < fees.length; i++) {
      const fee = fees[i];

      try {
        // Bereits gemahnt → überspringen
        if (fee.reminder_sent_at) {
          skippedAlreadyReminded++;
          continue;
        }

        // Schüler laden
        const student = await pb.collection("students").getOne(fee.student_id);

        // Elternteil über alle Verknüpfungs-Mechanismen suchen
        const parent = await resolveParentForStudent(pb, student);
        if (!parent) {
          skippedNoContact++;
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
      details: { month_key: monthKey, sent, skippedNoContact, skippedAlreadyReminded, failed },
    });

    return { success: true, sent, skippedNoContact, skippedAlreadyReminded, failed };
  } catch (error) {
    console.error("[actions/email] sendBulkFeeReminders:", error);
    return { success: false, sent: 0, skippedNoContact: 0, skippedAlreadyReminded: 0, failed: 0, error: "Fehler beim Massen-Versand" };
  }
}

// =========================================
// Förderpartner: Ablauf-Erinnerung
// =========================================

export async function sendSponsorExpiryReminder(
  mosqueId: string,
  sponsorId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const pb = await getAdminPB();
    const sponsor = await pb.collection("sponsors").getOne(sponsorId);
    const mosque = await pb.collection("mosques").getOne(mosqueId);

    if (sponsor.mosque_id !== mosqueId) {
      return { success: false, error: "Nicht gefunden." };
    }

    // Kontakt-E-Mail ermitteln: contact_user_id → user.email hat Vorrang, sonst contact_email
    let toEmail: string | null = null;
    if (sponsor.contact_user_id) {
      try {
        const user = await pb.collection("users").getOne(sponsor.contact_user_id, { fields: "email" });
        toEmail = user.email || null;
      } catch { /* User nicht gefunden */ }
    }
    if (!toEmail && sponsor.contact_email) {
      toEmail = sponsor.contact_email;
    }
    if (!toEmail) {
      return { success: false, error: "Sponsor hat keine Kontakt-E-Mail hinterlegt." };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://moschee.app";
    const manageUrl = `${baseUrl}/admin/foerderpartner`;

    const endDateFormatted = sponsor.end_date
      ? new Date(sponsor.end_date).toLocaleDateString("de-DE", {
          day: "2-digit", month: "long", year: "numeric",
        })
      : "—";

    const html = renderSponsorExpiryReminder({
      mosqueName: mosque.name,
      sponsorName: sponsor.name,
      endDate: endDateFormatted,
      manageUrl,
      accentColor: mosque.brand_primary_color || undefined,
    });

    const result = await sendEmailDirect({
      to: toEmail,
      subject: `Ihre Förderpartnerschaft läuft bald ab – ${mosque.name}`,
      html,
    });

    return result;
  } catch (error) {
    console.error("[actions/email] sendSponsorExpiryReminder:", error);
    return { success: false, error: "E-Mail konnte nicht gesendet werden." };
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
