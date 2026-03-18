"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { newsletterSchema, type NewsletterInput } from "@/lib/validations";
import { logAudit } from "@/lib/audit";

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Newsletter an Mitglieder senden.
 * Erstellt Einträge in der email_outbox Collection.
 * Der tatsächliche Versand erfolgt über einen separaten Prozess/Cron.
 */
export async function sendNewsletter(
  mosqueId: string,
  userId: string,
  input: NewsletterInput
): Promise<ActionResult<{ queued: number }>> {
  try {
    const validated = newsletterSchema.parse(input);
    const pb = await getAdminPB();

    // Empfänger laden basierend auf Segment
    let filter = `mosque_id = "${mosqueId}"`;
    if (validated.to_segment === "active") {
      filter += ` && status = "active"`;
    } else if (validated.to_segment === "admins") {
      filter += ` && role = "admin"`;
    } else if (validated.to_segment === "teachers") {
      filter += ` && role = "teacher"`;
    }

    const recipients = await pb.collection("users").getFullList({
      filter,
      fields: "id,email",
    });

    if (recipients.length === 0) {
      return { success: false, error: "Keine Empfänger gefunden" };
    }

    // E-Mail-Outbox-Einträge erstellen
    let queued = 0;
    for (const recipient of recipients) {
      if (!recipient.email) continue;

      await pb.collection("email_outbox").create({
        mosque_id: mosqueId,
        type: "newsletter",
        to_email: recipient.email,
        subject: validated.subject,
        body_html: validated.body_html,
        status: "queued",
        created_by: userId,
        meta_json: JSON.stringify({
          segment: validated.to_segment,
          recipient_user_id: recipient.id,
        }),
      });
      queued++;
    }

    await logAudit({
      mosqueId,
      userId,
      action: "newsletter.queued",
      entityType: "email_outbox",
      entityId: "",
      details: {
        subject: validated.subject,
        segment: validated.to_segment,
        recipient_count: queued,
      },
    });

    return { success: true, data: { queued } };
  } catch (error) {
    console.error("[Newsletter] Fehler:", error);
    return { success: false, error: "Newsletter konnte nicht gesendet werden" };
  }
}
