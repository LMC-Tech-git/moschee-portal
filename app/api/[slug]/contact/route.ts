import { NextRequest, NextResponse } from "next/server";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { resolveMosqueWithSettings } from "@/lib/resolve-mosque";
import { contactFormSchema } from "@/lib/validations";
import { checkRateLimit, getRateLimitHeaders, hashIP } from "@/lib/rate-limit";
import { sendEmailDirect } from "@/lib/email";
import {
  renderContactNotification,
  renderContactAutoReply,
} from "@/lib/email/templates";

// ─────────────────────────────────────────────────────────
// Bekannte Wegwerf-E-Mail-Domains (einfache Blocklist)
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

function sanitizeReplyTo(email: string): string {
  return email.split(",")[0].trim().slice(0, 254);
}

// ─────────────────────────────────────────────────────────
// POST /api/[slug]/contact
// ─────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  // 1. Moschee + Settings laden
  const result = await resolveMosqueWithSettings(slug);
  if (!result) {
    return NextResponse.json({ success: false, error: "Moschee nicht gefunden" }, { status: 404 });
  }

  const { mosque, settings } = result;

  // 2. Feature-Guard
  if (!settings.contact_enabled) {
    return NextResponse.json(
      { success: false, error: "Kontaktformular ist für diese Gemeinde nicht aktiviert" },
      { status: 404 }
    );
  }

  // 3. Honeypot — stille Erkennung
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Ungültige Anfrage" }, { status: 400 });
  }

  if (body.website) {
    return NextResponse.json({ success: true });
  }

  // 4. IP-Adresse extrahieren und hashen (DSGVO: kein Klartextspeicher)
  const rawIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const ipHash = await hashIP(rawIp);

  // 5. Rate Limiting — max. 5 Anfragen pro IP+Slug pro Minute (pro Moschee separat)
  const rl = checkRateLimit(`contact:${slug}:${ipHash}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Zu viele Anfragen. Bitte versuchen Sie es in einer Minute erneut.",
      },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }

  // 6. Server-seitige Validierung (Zod)
  const parsed = contactFormSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "Ungültige Eingabe";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const { name, email, organization, inquiry_type, message } = parsed.data;
  const replyTo = sanitizeReplyTo(email);

  // 7. Ziel-E-Mail bestimmen
  // Demo-Sonderfall: Mails immer an Platform-Email, nicht an Demo-Daten
  let targetEmail: string;
  if (mosque.slug === "demo") {
    targetEmail = process.env.CONTACT_EMAIL || "kontakt@moschee.app";
  } else {
    targetEmail = settings.contact_email || mosque.email || process.env.CONTACT_EMAIL || "";
  }

  if (!targetEmail) {
    // Kein Fallback konfiguriert — warnen und mit Platform-Email weitermachen
    console.warn("CONTACT_EMAIL_FALLBACK_USED", { mosqueId: mosque.id, slug });
    targetEmail = "kontakt@moschee.app";
  }

  const contactFrom = `${mosque.name} <${targetEmail}>`;

  // 8. In PocketBase speichern (contact_messages — per-Moschee)
  // Lösch-Strategie: Records älter als 180 Tage sollten per Cron gelöscht werden.
  try {
    const pb = await getAdminPB();
    await pb.collection("contact_messages").create({
      mosque_id: mosque.id,
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
    console.error("CONTACT_FORM_ERROR", { slug, inquiry_type, error: err });
    return NextResponse.json(
      { success: false, error: "Anfrage konnte nicht gespeichert werden. Bitte versuchen Sie es erneut." },
      { status: 500 }
    );
  }

  // 9. E-Mails senden (non-blocking — Fehler unterdrücken nie die Antwort)
  const shouldNotifyAdmin = settings.contact_notify_admin !== false;
  const shouldAutoReply = settings.contact_auto_reply !== false;

  Promise.allSettled([
    // Admin-Benachrichtigung
    ...(shouldNotifyAdmin
      ? [
          sendEmailDirect({
            from: contactFrom,
            to: targetEmail,
            replyTo,
            subject: `[Kontakt] ${mosque.name}: ${name} — ${inquiry_type}`,
            html: renderContactNotification({
              name,
              email,
              organization,
              inquiry_type,
              message,
              mosqueName: mosque.name,
            }),
          }),
        ]
      : []),
    // Auto-Reply an Absender (nur wenn keine Wegwerf-Domain)
    ...(shouldAutoReply && !isLikelyDisposable(email)
      ? [
          sendEmailDirect({
            from: contactFrom,
            to: email,
            subject: `Anfrage erhalten — ${mosque.name}`,
            html: renderContactAutoReply({ name, mosqueName: mosque.name }),
          }),
        ]
      : []),
  ]).catch((err) => {
    console.error("CONTACT_FORM_EMAIL_ERROR", { slug, error: err });
  });

  return NextResponse.json({ success: true });
}
