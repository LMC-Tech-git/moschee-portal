import { NextResponse, type NextRequest } from "next/server";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { processEmailQueue } from "@/lib/email";

/**
 * POST /api/email/process-queue
 *
 * Verarbeitet die E-Mail-Warteschlange.
 * Kann manuell (Admin-UI) oder als Cron-Job (z.B. cron-job.org) aufgerufen werden.
 *
 * Auth: Bearer-Token (User-JWT) ODER API-Secret-Header für Cron-Jobs.
 *
 * Cron-Setup: Alle 5 Minuten POST an https://deine-domain.de/api/email/process-queue
 * mit Header: X-API-Secret: <CRON_SECRET>
 *
 * Optional: ?mosque_id=xxx → nur eine Moschee verarbeiten
 */
export async function POST(request: NextRequest) {
  try {
    // Auth-Prüfung: API-Secret (für Cron) ODER Admin-User-Token
    const apiSecret = request.headers.get("x-api-secret");
    const cronSecret = process.env.CRON_SECRET;

    let authorized = false;

    if (cronSecret && apiSecret === cronSecret) {
      authorized = true;
    } else {
      // Alternativ: Admin-Auth via Bearer-Token
      const authHeader = request.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        try {
          const pb = await getAdminPB();
          // Token validieren durch Versuch, ein geschütztes Objekt abzurufen
          const userData = await pb.collection("users").authRefresh({ headers: { Authorization: `Bearer ${token}` } });
          if (userData.record?.role === "admin") {
            authorized = true;
          }
        } catch {
          // Token ungültig
        }
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const mosqueId = request.nextUrl.searchParams.get("mosque_id") || undefined;

    const result = await processEmailQueue(mosqueId);

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
      mosque_id: mosqueId || "all",
    });
  } catch (error) {
    console.error("[process-queue] Fehler:", error);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}

// Auch GET erlauben (z.B. für einfache Cron-Dienste die nur GET unterstützen)
export async function GET(request: NextRequest) {
  return POST(request);
}
