import { NextRequest, NextResponse } from "next/server";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { contactFormSchema } from "@/lib/validations";
import { checkRateLimit, getRateLimitHeaders, hashIP } from "@/lib/rate-limit";
import { sendEmailDirect } from "@/lib/email";
import {
  renderContactNotification,
  renderContactAutoReply,
} from "@/lib/email/templates";

// ─────────────────────────────────────────────────────────
// Bekannte Wegwerf-E-Mail-Domains (einfache Blocklist)
// Verhindert Auto-Replies an Spam-Adressen.
// ─────────────────────────────────────────────────────────
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "throwam.com",
  "yopmail.com",
  "sharklasers.com",
  "guerrillamailblock.com",
  "grr.la",
  "dispostable.com",
  "maildrop.cc",
  "trashmail.com",
  "fakeinbox.com",
  "spam4.me",
  "tempr.email",
  "discard.email",
]);

function isLikelyDisposable(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? DISPOSABLE_DOMAINS.has(domain) : false;
}

/**
 * Sanitiert die replyTo-Adresse:
 * - Max. 254 Zeichen (RFC 5321)
 * - Kein Komma (keine mehrfachen Adressen)
 */
function sanitizeReplyTo(email: string): string {
  return email.split(",")[0].trim().slice(0, 254);
}

// ─────────────────────────────────────────────────────────
// POST /api/contact
// ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Honeypot — stille Erkennung (immer 200, kein DB-Eintrag, keine Mail)
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Ungültige Anfrage" }, { status: 400 });
  }

  if (body.website) {
    // Bot erkannt — stille Antwort ohne Aktion
    return NextResponse.json({ success: true });
  }

  // 2. IP-Adresse extrahieren und hashen (DSGVO: kein Klartextspeicher)
  const rawIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const ipHash = await hashIP(rawIp);

  // 3. Rate Limiting — max. 5 Anfragen pro IP pro Minute
  const rl = checkRateLimit(`contact:${ipHash}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Zu viele Anfragen. Bitte versuchen Sie es in einer Minute erneut.",
      },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }

  // 4. Server-seitige Validierung (Zod)
  const parsed = contactFormSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "Ungültige Eingabe";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const { name, email, organization, inquiry_type, message } = parsed.data;
  const replyTo = sanitizeReplyTo(email);
  const contactEmail = process.env.CONTACT_EMAIL || "kontakt@moschee.app";
  const contactFrom = `moschee.app <${contactEmail}>`;

  // 5. In PocketBase speichern
  // Lösch-Strategie: Records älter als 180 Tage sollten per Cron gelöscht werden.
  // Beispiel-Filter für einen Cron: created < "${new Date(Date.now() - 180 * 86400000).toISOString()}"
  try {
    const pb = await getAdminPB();
    await pb.collection("inquiries").create({
      name,
      email,
      organization: organization || "",
      inquiry_type,
      message,
      privacy_accepted: true,
      privacy_accepted_at: new Date().toISOString(),
      ip_address: ipHash, // SHA-256+Salt — kein Klartext
      status: "new",
    });
  } catch (err) {
    console.error("CONTACT_FORM_ERROR", { inquiry_type, error: err });
    return NextResponse.json(
      { success: false, error: "Anfrage konnte nicht gespeichert werden. Bitte versuchen Sie es erneut." },
      { status: 500 }
    );
  }

  // 6. E-Mails senden (non-blocking — Fehler unterdrücken nie die Antwort)
  Promise.allSettled([
    // Admin-Benachrichtigung
    sendEmailDirect({
      from: contactFrom,
      to: contactEmail,
      replyTo,
      subject: `[Kontakt] ${name} — ${inquiry_type}`,
      html: renderContactNotification({ name, email, organization, inquiry_type, message }),
    }),
    // Auto-Reply an Absender (nur wenn keine Wegwerf-Domain)
    ...(isLikelyDisposable(email)
      ? []
      : [
          sendEmailDirect({
            from: contactFrom,
            to: email,
            subject: "Anfrage erhalten — moschee.app",
            html: renderContactAutoReply({ name }),
          }),
        ]),
  ]).catch((err) => {
    console.error("CONTACT_FORM_ERROR email", { error: err });
  });

  return NextResponse.json({ success: true });
}
