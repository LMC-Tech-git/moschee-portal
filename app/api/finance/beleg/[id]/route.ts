import { NextRequest } from "next/server";
import { getFinancePB } from "@/lib/finance-pb";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { getAuthFromCookie } from "@/lib/auth-cookie";
import { hasFinancePermission } from "@/lib/finance-permissions-shared";
import { safeAudit } from "@/lib/audit";
import type { Transaction } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Beleg-Download mit Härtung (Sprint 6).
 *
 * Liefert die hochgeladene Beleg-Datei einer manuellen Buchung aus.
 * Header `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`
 * verhindern Inline-Render hochgeladener PDF/Bild-Dateien (Stored-XSS-Schutz).
 *
 * Auth: eingeloggt + Finance-Rolle + Tenant-Match (mosque_id aus DB-Record,
 * NICHT aus Client). 401/403/404 statt Datenleck.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  const transactionId = params.id;
  if (!transactionId) return new Response("Not found", { status: 404 });

  // 1. Eingeloggt?
  const auth = getAuthFromCookie();
  if (!auth.isLoggedIn || !auth.userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Transaction laden (Admin-PB; Tenant kommt aus dem Record)
  const adminPb = await getAdminPB();
  let tx: Transaction;
  try {
    tx = (await adminPb.collection("transactions").getOne(transactionId)) as unknown as Transaction;
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!tx.mosque_id || !tx.beleg_datei) {
    return new Response("Not found", { status: 404 });
  }

  // 3. Rolle + Tenant prüfen
  let role = "";
  let userMosque = "";
  try {
    const user = (await adminPb.collection("users").getOne(auth.userId, {
      fields: "role,mosque_id",
    })) as unknown as { role?: string; mosque_id?: string };
    role = user.role ?? "";
    userMosque = user.mosque_id ?? "";
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  if (!hasFinancePermission(role, "finance_view")) {
    return new Response("Forbidden", { status: 403 });
  }
  if (role !== "super_admin" && userMosque !== tx.mosque_id) {
    return new Response("Forbidden", { status: 403 });
  }

  // 4. Datei-URL bauen (Finance-PB exponiert raw pb + Token-Mechanik)
  const fp = await getFinancePB(tx.mosque_id);
  let fileUrl = fp.pb.files.getURL(tx as unknown as { [key: string]: unknown; id: string }, tx.beleg_datei);
  try {
    const fileToken = await fp.pb.files.getToken();
    fileUrl += (fileUrl.includes("?") ? "&" : "?") + `token=${fileToken}`;
  } catch {
    /* unprotected file: kein Token nötig */
  }

  // 5. Datei holen + als attachment durchreichen
  const upstream = await fetch(fileUrl);
  if (!upstream.ok || !upstream.body) {
    return new Response("Not found", { status: 404 });
  }

  const ext = (tx.beleg_datei.split(".").pop() || "bin").toLowerCase();
  const filename = `beleg-${tx.beleg_nummer || tx.id}.${ext}`;
  const asciiName = filename.replace(/[^\x20-\x7E]/g, "_");

  await safeAudit({
    mosqueId: tx.mosque_id,
    action: "finance.beleg_download",
    entityType: "transaction",
    entityId: tx.id,
    context: { beleg_nummer: tx.beleg_nummer },
  });

  return new Response(upstream.body, {
    status: 200,
    headers: {
      // octet-stream + nosniff: Browser rendert NICHT inline (Stored-XSS-Schutz)
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${asciiName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
