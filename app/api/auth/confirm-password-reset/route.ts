import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "crypto";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { checkRateLimit, hashIP, getRateLimitHeaders } from "@/lib/rate-limit";

/**
 * POST /api/auth/confirm-password-reset
 * Validiert den Reset-Token und setzt das neue Passwort.
 */
export async function POST(request: NextRequest) {
  // Rate Limit: 10 Anfragen pro IP pro Stunde
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const ipHash = await hashIP(ip);
  const limit = checkRateLimit(`pw-reset-confirm:${ipHash}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429, headers: getRateLimitHeaders(limit) }
    );
  }

  let token: string;
  let password: string;
  try {
    const body = await request.json();
    token = (body.token || "").trim();
    password = body.password || "";
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  if (!token || !password) {
    return NextResponse.json({ error: "Token und Passwort sind erforderlich." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Das Passwort muss mindestens 8 Zeichen lang sein." }, { status: 400 });
  }

  try {
    const pb = await getAdminPB();
    const tokenHash = createHash("sha256").update(token).digest("hex");

    // Token suchen
    let resetRecord: { id: string; user_id: string; expires_at: string; used: boolean };
    try {
      resetRecord = await pb
        .collection("password_reset_tokens")
        .getFirstListItem(`token_hash = "${tokenHash}" && used = false`);
    } catch {
      return NextResponse.json(
        { error: "Der Link ist ungültig oder wurde bereits verwendet." },
        { status: 400 }
      );
    }

    // Ablauf prüfen
    if (new Date(resetRecord.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Der Link ist abgelaufen. Bitte fordere einen neuen an." },
        { status: 400 }
      );
    }

    // Passwort aktualisieren
    await pb.collection("users").update(resetRecord.user_id, {
      password,
      passwordConfirm: password,
    });

    // Token als verwendet markieren
    await pb.collection("password_reset_tokens").update(resetRecord.id, { used: true });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[confirm-password-reset]", err);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten. Bitte versuche es erneut." },
      { status: 500 }
    );
  }
}
