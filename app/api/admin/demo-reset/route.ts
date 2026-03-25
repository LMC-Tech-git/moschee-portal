import { NextRequest, NextResponse } from "next/server";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { resetDemoData } from "@/lib/demo/seed";

export const dynamic = "force-dynamic";
// Demo-Reset kann 10–20 Sek. dauern
export const maxDuration = 60;

/**
 * POST /api/admin/demo-reset
 *
 * Löscht alle Inhalts-Records der Demo-Moschee und erstellt sie neu.
 * Nur für Super-Admins zugänglich.
 */
export async function POST(request: NextRequest) {
  // ── Auth-Check: pb_auth Cookie über request.cookies auslesen ─────────────
  const pbAuthRaw = request.cookies.get("pb_auth")?.value;

  let userRole: string | undefined;
  let debugInfo: Record<string, unknown> = { cookieFound: !!pbAuthRaw };

  if (pbAuthRaw) {
    try {
      const decoded = pbAuthRaw.startsWith("%") ? decodeURIComponent(pbAuthRaw) : pbAuthRaw;
      const authData = JSON.parse(decoded);
      userRole = authData.model?.role as string | undefined;
      debugInfo = { ...debugInfo, parsedOk: true, role: userRole, modelKeys: Object.keys(authData.model ?? {}) };
    } catch (e) {
      debugInfo = { ...debugInfo, parsedOk: false, parseError: String(e), rawPreview: pbAuthRaw.substring(0, 80) };
    }
  }

  console.log("[demo-reset] auth debug:", JSON.stringify(debugInfo));

  if (userRole !== "super_admin") {
    return NextResponse.json({ error: "Forbidden", debug: debugInfo }, { status: 403 });
  }

  // ── Demo-Moschee ermitteln ────────────────────────────────────────────────
  try {
    const adminPb = await getAdminPB();
    const mosque = await adminPb
      .collection("mosques")
      .getFirstListItem('slug = "demo"');

    // ── Reset ausführen ────────────────────────────────────────────────────
    const result = await resetDemoData(mosque.id);

    return NextResponse.json({
      ok: true,
      mosqueId: mosque.id,
      deletedCount: result.deletedCount,
      createdCount: result.createdCount,
      durationMs: result.durationMs,
    });
  } catch (error) {
    console.error("[demo-reset]", error);
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
