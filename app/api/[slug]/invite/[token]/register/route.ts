import { NextRequest, NextResponse } from "next/server";
import { resolveMosqueBySlug } from "@/lib/resolve-mosque";
import { validateInviteByToken } from "@/lib/actions/invites";
import { checkRateLimit, hashIP, getRateLimitHeaders } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { logAudit } from "@/lib/audit";
import { inviteRegisterSchema } from "@/lib/validations";
import { notifyAdmins } from "@/lib/email/notify-admin";

/**
 * POST /api/[slug]/invite/[token]/register
 *
 * Erstellt einen neuen User-Account über einen Invite-Link.
 * Führt Invite-Validierung, User-Erstellung und uses_count-Increment atomisch aus.
 * Rate-Limit: 5 Anfragen/IP/Stunde.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; token: string } }
) {
  // 1. Moschee via Slug auflösen (mosque_id NIEMALS vom Client)
  const mosque = await resolveMosqueBySlug(params.slug);
  if (!mosque) {
    return NextResponse.json({ success: false, error: "Gemeinde nicht gefunden" }, { status: 404 });
  }

  // 2. Rate Limiting (5/IP/h)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipHash = await hashIP(ip);
  const rl = checkRateLimit(`invite-register:${ipHash}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Zu viele Registrierungsversuche. Bitte später erneut versuchen." },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }

  // 3. Body parsen + Zod-Validierung
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Ungültiges Format" }, { status: 400 });
  }

  const parsed = inviteRegisterSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "Ungültige Eingabe";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  // 3b. CAPTCHA (Turnstile) verifizieren
  const captchaOk = await verifyTurnstileToken(String(body.turnstile_token || ""));
  if (!captchaOk) {
    return NextResponse.json(
      { success: false, error: "CAPTCHA-Überprüfung fehlgeschlagen. Bitte versuche es erneut." },
      { status: 400 }
    );
  }

  const { first_name, last_name, email, password, passwordConfirm } = parsed.data;

  // 4. Invite re-validieren (server-side, Tenant-Prüfung)
  const validationResult = await validateInviteByToken(params.token, mosque.id);
  if (!validationResult.valid) {
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
        error: messages[validationResult.reason ?? "error"] ?? "Ungültige Einladung.",
      },
      { status: 410 }
    );
  }

  const invite = validationResult.invite!;
  const pb = await getAdminPB();

  // 5. User-Account erstellen (mosque_id, role, status aus Invite — NICHT vom Client)
  let userId: string;
  try {
    const newUser = await pb.collection("users").create({
      email,
      password,
      passwordConfirm,
      first_name,
      last_name,
      full_name: `${first_name} ${last_name}`.trim(),
      membership_number: "-",
      member_no: "",
      mosque_id: mosque.id,
      role: invite.role || "member",
      status: invite.initial_status || "pending",
    });
    userId = newUser.id;
  } catch (error: unknown) {
    const pbError = error as { data?: { data?: Record<string, { message?: string }> } };
    // PocketBase gibt bei doppelter E-Mail einen Fehler zurück
    if (pbError?.data?.data?.email) {
      return NextResponse.json(
        { success: false, error: "Diese E-Mail-Adresse ist bereits registriert." },
        { status: 409 }
      );
    }
    console.error("[InviteRegister] Fehler bei User-Erstellung:", error);
    return NextResponse.json(
      { success: false, error: "Registrierung fehlgeschlagen. Bitte versuche es erneut." },
      { status: 500 }
    );
  }

  // 6. uses_count inkrementieren
  try {
    await pb.collection("invites").update(invite.id, {
      uses_count: (invite.uses_count ?? 0) + 1,
    });
  } catch (error) {
    // Nicht kritisch — User wurde erfolgreich erstellt
    console.error("[InviteRegister] Fehler beim uses_count-Increment:", error);
  }

  // 7. Audit-Log
  await logAudit({
    mosqueId: mosque.id,
    userId,
    action: "invite.consumed",
    entityType: "invite",
    entityId: invite.id,
    details: {
      invite_type: invite.type,
      assigned_role: invite.role,
      assigned_status: invite.initial_status,
    },
  });

  // 8. Admin-Benachrichtigung (asynchron, nicht blockierend)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  notifyAdmins({
    mosqueId: mosque.id,
    mosqueName: mosque.name,
    title: "Neues Mitglied registriert",
    message: `<strong>${first_name} ${last_name}</strong> (${email}) hat sich über einen Einladungslink registriert.`,
    detailsUrl: `${baseUrl}/admin/mitglieder`,
    accentColor: mosque.brand_primary_color || undefined,
  }).catch((e) => console.error("[InviteRegister] Admin-Notify Fehler:", e));

  return NextResponse.json({ success: true });
}
