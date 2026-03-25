import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
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
export async function POST(_request: NextRequest) {
  // ── Auth-Check: pb_auth Cookie direkt auslesen und parsen ─────────────────
  const cookieStore = cookies();
  const pbAuthRaw = cookieStore.get("pb_auth")?.value;

  let userRole: string | undefined;
  if (pbAuthRaw) {
    try {
      const authData = JSON.parse(decodeURIComponent(pbAuthRaw));
      userRole = authData.model?.role as string | undefined;
    } catch {
      // Cookie nicht parsebar → kein Zugriff
    }
  }

  if (userRole !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
