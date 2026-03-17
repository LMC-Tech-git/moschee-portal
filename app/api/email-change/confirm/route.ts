import { NextResponse, type NextRequest } from "next/server";
import { getAdminPB } from "@/lib/pocketbase-admin";

/**
 * GET /api/email-change/confirm?token=<token>
 *
 * Bestätigt eine E-Mail-Adressänderung über den per E-Mail versendeten Token.
 * Setzt die neue E-Mail auf dem User-Record und löscht die Token-Felder.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get("token");

  const base = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  if (!token || token.length < 32) {
    return NextResponse.redirect(new URL("/member/profile?email_error=invalid", base));
  }

  try {
    const pb = await getAdminPB();

    // User mit diesem Token finden
    let user;
    try {
      user = await pb
        .collection("users")
        .getFirstListItem(`email_change_token = "${token}"`);
    } catch {
      return NextResponse.redirect(new URL("/member/profile?email_error=invalid", base));
    }

    // Token-Ablauf prüfen
    const expiresAt = user.email_change_expires_at
      ? new Date(user.email_change_expires_at)
      : null;

    if (!expiresAt || expiresAt < new Date()) {
      await pb.collection("users").update(user.id, {
        pending_email: "",
        email_change_token: "",
        email_change_expires_at: "",
      });
      return NextResponse.redirect(new URL("/member/profile?email_error=expired", base));
    }

    const newEmail = (user.pending_email as string | undefined)?.trim();
    if (!newEmail) {
      return NextResponse.redirect(new URL("/member/profile?email_error=invalid", base));
    }

    // Neue Adresse noch frei?
    try {
      await pb
        .collection("users")
        .getFirstListItem(`email = "${newEmail}" && id != "${user.id}"`);
      // Adresse vergeben — Abbruch
      await pb.collection("users").update(user.id, {
        pending_email: "",
        email_change_token: "",
        email_change_expires_at: "",
      });
      return NextResponse.redirect(new URL("/member/profile?email_error=taken", base));
    } catch {
      // Gut — nicht vergeben
    }

    // E-Mail aktualisieren + Token löschen
    await pb.collection("users").update(user.id, {
      email: newEmail,
      pending_email: "",
      email_change_token: "",
      email_change_expires_at: "",
    });

    return NextResponse.redirect(new URL("/member/profile?email_changed=true", base));
  } catch (error) {
    console.error("[email-change/confirm] Fehler:", error);
    const base = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    return NextResponse.redirect(new URL("/member/profile?email_error=server", base));
  }
}
