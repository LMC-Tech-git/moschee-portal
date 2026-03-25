import { NextRequest, NextResponse } from "next/server";
import PocketBase from "pocketbase";
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
  // ── Auth-Check: nur super_admin ──────────────────────────────────────────
  const pbUrl =
    process.env.POCKETBASE_URL || process.env.NEXT_PUBLIC_POCKETBASE_URL;
  if (!pbUrl) {
    return NextResponse.json({ error: "Serverkonfiguration fehlt" }, { status: 500 });
  }

  const userPb = new PocketBase(pbUrl);
  const cookieHeader = request.headers.get("cookie") ?? "";
  userPb.authStore.loadFromCookie(cookieHeader);

  const userRole = (userPb.authStore.model as Record<string, unknown> | null)
    ?.role as string | undefined;

  if (!userPb.authStore.isValid || userRole !== "super_admin") {
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
