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
  // ── Auth-Check: User-ID aus Cookie → Rolle per Admin-PB prüfen ───────────
  const pbAuthRaw = request.cookies.get("pb_auth")?.value;
  let userId: string | undefined;

  if (pbAuthRaw) {
    try {
      const decoded = pbAuthRaw.startsWith("%") ? decodeURIComponent(pbAuthRaw) : pbAuthRaw;
      userId = JSON.parse(decoded)?.model?.id as string | undefined;
    } catch {
      // ignore
    }
  }

  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const adminPb = await getAdminPB();
    const user = await adminPb.collection("users").getOne(userId, { fields: "id,role" });
    if ((user as unknown as Record<string, unknown>).role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch {
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
