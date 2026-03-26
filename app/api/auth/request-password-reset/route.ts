import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomBytes } from "crypto";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { sendEmailDirect, getFromEmail } from "@/lib/email";
import { checkRateLimit, hashIP, getRateLimitHeaders } from "@/lib/rate-limit";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://moschee.app";

/**
 * POST /api/auth/request-password-reset
 * Generiert einen Passwort-Reset-Token, speichert ihn in PocketBase
 * und sendet die E-Mail via Resend HTTP-API (umgeht VPS-SMTP-Block).
 */
export async function POST(request: NextRequest) {
  // Rate Limit: 5 Anfragen pro IP pro Stunde
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  const ipHash = await hashIP(ip);
  const limit = checkRateLimit(`pw-reset-req:${ipHash}`, 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: true }, { status: 200, headers: getRateLimitHeaders(limit) });
  }

  let email: string;
  try {
    const body = await request.json();
    email = (body.email || "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ ok: true }); // Immer 200 – keine E-Mail-Enumeration
  }

  if (!email) return NextResponse.json({ ok: true });

  try {
    const pb = await getAdminPB();

    // User per E-Mail suchen
    let user: { id: string; email: string; first_name?: string };
    try {
      user = await pb
        .collection("users")
        .getFirstListItem(`email = "${email}"`, { fields: "id,email,first_name" });
    } catch {
      return NextResponse.json({ ok: true }); // User existiert nicht – kein Fehler zeigen
    }

    // Sicheren Token generieren
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 Minuten

    // Alte Tokens des Users löschen
    try {
      const old = await pb
        .collection("password_reset_tokens")
        .getFullList({ filter: `user_id = "${user.id}"` });
      for (const r of old) {
        await pb.collection("password_reset_tokens").delete(r.id);
      }
    } catch { /* ignore */ }

    // Neuen Token speichern
    await pb.collection("password_reset_tokens").create({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString().replace("T", " "),
      used: false,
    });

    // E-Mail via Resend HTTP-API senden
    const resetUrl = `${APP_URL}/passwort-zuruecksetzen?token=${rawToken}`;
    const name = user.first_name || "dort";
    await sendEmailDirect({
      to: user.email,
      from: getFromEmail(),
      subject: "Passwort zurücksetzen – moschee.app",
      html: `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <tr><td style="background:#059669;padding:24px 32px;">
          <span style="color:#fff;font-size:20px;font-weight:700;">moschee.app</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">Passwort zurücksetzen</h2>
          <p style="color:#374151;line-height:1.6;">Hallo${name !== "dort" ? " " + name : ""},</p>
          <p style="color:#374151;line-height:1.6;">du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt. Klicke auf den Button, um ein neues Passwort zu setzen:</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${resetUrl}" style="display:inline-block;padding:14px 28px;background:#059669;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">Passwort zurücksetzen</a>
          </div>
          <p style="color:#6b7280;font-size:13px;">Der Link ist <strong>30 Minuten</strong> gültig.</p>
          <p style="color:#6b7280;font-size:13px;">Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
          <p style="color:#9ca3af;font-size:12px;">Dein moschee.app-Team</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });
  } catch (err) {
    console.error("[request-password-reset]", err);
    // Auch bei serverseitigem Fehler immer 200 zurückgeben
  }

  return NextResponse.json({ ok: true });
}
