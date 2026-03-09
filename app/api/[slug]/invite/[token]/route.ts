import { NextRequest, NextResponse } from "next/server";
import { resolveMosqueBySlug } from "@/lib/resolve-mosque";
import { validateInviteByToken } from "@/lib/actions/invites";
import { checkRateLimit, hashIP, getRateLimitHeaders } from "@/lib/rate-limit";

/**
 * GET /api/[slug]/invite/[token]
 *
 * Validiert einen Invite-Token ohne sensible Daten zurückzugeben.
 * Rate-Limit: 20 Anfragen/IP/Stunde (Schutz vor Token-Enumeration).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; token: string } }
) {
  // 1. Moschee via Slug auflösen
  const mosque = await resolveMosqueBySlug(params.slug);
  if (!mosque) {
    return NextResponse.json({ success: false, error: "Gemeinde nicht gefunden" }, { status: 404 });
  }

  // 2. Rate Limiting (20/IP/h — gegen Token-Guessing)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipHash = await hashIP(ip);
  const rl = checkRateLimit(`invite-resolve:${ipHash}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }

  // 3. Token validieren (mit Tenant-Prüfung)
  const result = await validateInviteByToken(params.token, mosque.id);

  if (!result.valid) {
    const messages: Record<string, string> = {
      not_found: "Diese Einladung existiert nicht.",
      revoked: "Diese Einladung wurde widerrufen.",
      expired: "Diese Einladung ist abgelaufen.",
      exhausted: "Diese Einladung wurde bereits vollständig genutzt.",
      error: "Fehler beim Prüfen der Einladung.",
    };
    return NextResponse.json(
      {
        success: false,
        error: messages[result.reason ?? "error"] ?? "Ungültige Einladung.",
        reason: result.reason,
      },
      { status: 410 }
    );
  }

  const invite = result.invite!;

  // 4. Nur nicht-sensitive Daten zurückgeben (kein Token!)
  return NextResponse.json({
    success: true,
    mosque_name: mosque.name,
    invite_type: invite.type,
    invite_label: invite.label || null,
    invite_role: invite.role,
  });
}
