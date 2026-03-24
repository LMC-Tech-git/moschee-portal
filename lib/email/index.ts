import { Resend } from "resend";
import { getAdminPB } from "@/lib/pocketbase-admin";
import type { EmailOutbox } from "@/types";

// =========================================
// Resend Client (Singleton)
// =========================================

let _resendClient: Resend | null = null;

/**
 * Gibt den Resend-Client zurück oder null wenn RESEND_API_KEY nicht gesetzt.
 * Graceful degradation: App läuft weiter, E-Mails werden nur geloggt.
 */
export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  if (!_resendClient) {
    _resendClient = new Resend(apiKey);
  }
  return _resendClient;
}

export function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || "Moschee Portal <noreply@moschee-portal.de>";
}

// =========================================
// Low-Level Send
// =========================================

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  /** Reply-To-Adresse (optional) — z.B. E-Mail des Absenders im Kontaktformular */
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sendet eine E-Mail direkt via Resend.
 * Fehler werden zurückgegeben, nie geworfen.
 * Gibt {success: false} ohne Fehler zurück wenn Resend nicht konfiguriert ist.
 */
export async function sendEmailDirect(options: SendEmailOptions): Promise<SendEmailResult> {
  const client = getResendClient();
  if (!client) {
    console.warn("[Email] RESEND_API_KEY nicht konfiguriert — E-Mail wird nicht gesendet:", options.subject);
    return { success: false, error: "E-Mail-Service nicht konfiguriert" };
  }

  try {
    const { data, error } = await client.emails.send({
      from: options.from || getFromEmail(),
      to: options.to,
      subject: options.subject,
      html: options.html,
      ...(options.replyTo ? { reply_to: options.replyTo } : {}),
    });

    if (error) {
      console.error("[Email] Resend Fehler:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error("[Email] Unerwarteter Fehler beim Senden:", err);
    return { success: false, error: "Unbekannter Fehler beim E-Mail-Versand" };
  }
}

// =========================================
// Queue: E-Mail in email_outbox einreihen
// =========================================

export interface QueueEmailParams {
  mosqueId: string;
  type: EmailOutbox["type"];
  toEmail: string;
  subject: string;
  bodyHtml: string;
  createdBy?: string;
  metaJson?: Record<string, unknown>;
}

export async function queueEmail(params: QueueEmailParams): Promise<void> {
  try {
    const pb = await getAdminPB();
    await pb.collection("email_outbox").create({
      mosque_id: params.mosqueId,
      type: params.type,
      to_email: params.toEmail,
      subject: params.subject,
      body_html: params.bodyHtml,
      status: "queued",
      created_by: params.createdBy || "",
      meta_json: params.metaJson ? JSON.stringify(params.metaJson) : "{}",
    });
  } catch (err) {
    // Queue-Fehler nie werfen — läuft still im Hintergrund
    console.error("[Email] Fehler beim Einreihen in Queue:", err);
  }
}

// =========================================
// Queue verarbeiten
// =========================================

export interface ProcessQueueResult {
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Verarbeitet alle E-Mails mit status="queued" für eine Moschee.
 * Optional: mosqueId=undefined → alle Moscheen
 * Gibt Statistik zurück ohne zu werfen.
 */
export async function processEmailQueue(
  mosqueId?: string,
  limit = 50
): Promise<ProcessQueueResult> {
  const result: ProcessQueueResult = { sent: 0, failed: 0, skipped: 0 };

  const client = getResendClient();
  if (!client) {
    console.warn("[Email] processEmailQueue: Resend nicht konfiguriert, überspringe Queue");
    result.skipped = -1; // Sentinel: nicht konfiguriert
    return result;
  }

  try {
    const pb = await getAdminPB();

    const filter = mosqueId
      ? `status = "queued" && mosque_id = "${mosqueId}"`
      : `status = "queued"`;

    const records = await pb.collection("email_outbox").getList(1, limit, { filter });

    for (const record of records.items) {
      const sendResult = await sendEmailDirect({
        to: record.to_email,
        subject: record.subject,
        html: record.body_html,
      });

      if (sendResult.success) {
        await pb.collection("email_outbox").update(record.id, {
          status: "sent",
          sent_at: new Date().toISOString(),
        });
        result.sent++;
      } else {
        await pb.collection("email_outbox").update(record.id, {
          status: "failed",
        });
        result.failed++;
        console.error(`[Email] Queue-Item ${record.id} fehlgeschlagen:`, sendResult.error);
      }
    }
  } catch (err) {
    console.error("[Email] processEmailQueue Fehler:", err);
  }

  return result;
}

// =========================================
// Test-E-Mail (für Admin-UI)
// =========================================

export async function sendTestEmail(toEmail: string): Promise<SendEmailResult> {
  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #059669;">✅ E-Mail-Konfiguration funktioniert</h2>
      <p>Dies ist eine Test-E-Mail vom Moschee-Portal.</p>
      <p style="color: #6b7280; font-size: 14px;">Gesendet am ${new Date().toLocaleString("de-DE")}</p>
    </div>
  `;
  return sendEmailDirect({
    to: toEmail,
    subject: "Test-E-Mail — Moschee Portal",
    html,
  });
}
