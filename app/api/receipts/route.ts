import { NextRequest } from "next/server";
import { Readable } from "node:stream";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { logAudit } from "@/lib/audit";
import {
  loadVereinSettings,
  loadRawDonationsForUser,
  loadDonorMeta,
  getReceiptYearDonors,
} from "@/lib/actions/receipts";
import { buildReceiptPdfData } from "@/lib/pdf/receipts/build-receipt-data";
import { renderReceiptsToStream } from "@/lib/pdf/receipts/receipt-document";
import type {
  ReceiptPdfData,
  ReceiptVerein,
} from "@/lib/pdf/receipts/receipt-types";

// react-pdf benötigt Node-Runtime (kein Edge). runtime greift zuverlässig
// nur in Route Handlern/Pages — daher PDF-Erzeugung bewusst hier.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** ä→ae, ö→oe, ü→ue, ß→ss, Rest → '-'. Plattformunabhängiger Dateiname. */
function slugFilenamePart(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function userIdFromCookie(req: NextRequest): string {
  const raw = req.cookies.get("pb_auth")?.value;
  if (!raw) return "";
  try {
    const decoded = raw.startsWith("%") ? decodeURIComponent(raw) : raw;
    return JSON.parse(decoded)?.model?.id || "";
  } catch {
    return "";
  }
}

function pdfResponse(
  stream: Readable,
  filename: string,
  disposition: "inline" | "attachment",
  extraHeaders: Record<string, string> = {}
): Response {
  const webStream = Readable.toWeb(stream) as unknown as ReadableStream;
  const asciiName = filename.replace(/[^\x20-\x7E]/g, "_");
  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      ...extraHeaders,
    },
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");
  const yearParam = parseInt(url.searchParams.get("year") || "", 10);
  const year = Number.isFinite(yearParam)
    ? yearParam
    : new Date().getFullYear();
  const mode = url.searchParams.get("mode") || "sammel-alle";
  const donorUserId = url.searchParams.get("donorUserId") || "";
  const disposition =
    url.searchParams.get("disposition") === "inline"
      ? "inline"
      : "attachment";

  const requesterId = userIdFromCookie(req);
  if (!requesterId) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const pb = await getAdminPB();
    const requester = await pb
      .collection("users")
      .getOne(requesterId, { fields: "id,mosque_id,role,status" });

    const mosqueId = requester.mosque_id;
    if (!mosqueId) {
      return new Response("Forbidden", { status: 403 });
    }

    const { verein }: { verein: ReceiptVerein } =
      await loadVereinSettings(mosqueId);

    // ─────────────── Member-Scope (eigene Bescheinigung) ───────────────
    if (scope === "member") {
      const meta = await loadDonorMeta(mosqueId, requesterId);
      if (!meta) return new Response("Forbidden", { status: 403 });

      const raw = await loadRawDonationsForUser(mosqueId, requesterId, year);
      if (raw.length === 0) {
        return new Response("Keine Spenden für dieses Jahr", { status: 404 });
      }

      const receipt = buildReceiptPdfData({
        mode: "sammel",
        verein,
        donor: {
          name: meta.name,
          anschrift: meta.anschrift,
          membershipNumber: meta.membershipNumber,
          addressMissing: meta.addressMissing,
        },
        year,
        rawDonations: raw,
      });

      const stream = await renderReceiptsToStream(
        [receipt],
        verein.name,
        year
      );

      await logAudit({
        mosqueId,
        userId: requesterId,
        action: "receipt_pdf_generated",
        entityType: "donation",
        entityId: requesterId,
        details: { scope: "member", year },
      });

      const filename = `spendenbescheinigung-${year}-${slugFilenamePart(
        meta.name
      )}.pdf`;
      return pdfResponse(stream as unknown as Readable, filename, disposition);
    }

    // ─────────────── Admin-Scope ───────────────
    if (scope === "admin") {
      if (requester.role !== "admin" && requester.role !== "super_admin") {
        return new Response("Forbidden", { status: 403 });
      }

      const receipts: ReceiptPdfData[] = [];
      let skippedCount = 0;

      if (mode === "einzel-spender") {
        if (!donorUserId) {
          return new Response("donorUserId fehlt", { status: 400 });
        }
        const meta = await loadDonorMeta(mosqueId, donorUserId);
        if (!meta) return new Response("Spender nicht gefunden", { status: 404 });
        const raw = await loadRawDonationsForUser(
          mosqueId,
          donorUserId,
          year
        );
        if (raw.length === 0) {
          return new Response("Keine Spenden", { status: 404 });
        }
        // Je Einzelspende eine Bestätigung-Seite.
        raw.forEach((d) => {
          receipts.push(
            buildReceiptPdfData({
              mode: "einzel",
              verein,
              donor: {
                name: meta.name,
                anschrift: meta.anschrift,
                membershipNumber: meta.membershipNumber,
                addressMissing: meta.addressMissing,
              },
              year,
              rawDonations: [d],
            })
          );
        });
        if (meta.addressMissing) skippedCount = 1;

        const stream = await renderReceiptsToStream(
          receipts,
          verein.name,
          year
        );
        await logAudit({
          mosqueId,
          userId: requesterId,
          action: "receipt_pdf_generated",
          entityType: "donation",
          entityId: donorUserId,
          details: { scope: "admin", mode, year, count: receipts.length },
        });
        const filename = `spendenbescheinigung-${year}-${slugFilenamePart(
          meta.name
        )}.pdf`;
        return pdfResponse(
          stream as unknown as Readable,
          filename,
          disposition,
          {
            "X-Receipt-Generated-Count": String(receipts.length),
            "X-Receipt-Skipped-Count": String(skippedCount),
          }
        );
      }

      // mode = sammel-alle: je Spender eine Sammelbestätigung-Seite.
      const donorsResult = await getReceiptYearDonors(mosqueId, year);
      if (!donorsResult.success || !donorsResult.data) {
        return new Response("Fehler beim Laden der Spender", { status: 500 });
      }
      if (donorsResult.data.length === 0) {
        return new Response("Keine Spenden für dieses Jahr", { status: 404 });
      }

      for (const donor of donorsResult.data) {
        try {
          const meta = await loadDonorMeta(mosqueId, donor.userId);
          const raw = await loadRawDonationsForUser(
            mosqueId,
            donor.userId,
            year
          );
          if (!meta || raw.length === 0) {
            skippedCount += 1;
            continue;
          }
          if (meta.addressMissing) skippedCount += 1;
          receipts.push(
            buildReceiptPdfData({
              mode: "sammel",
              verein,
              donor: {
                name: meta.name,
                anschrift: meta.anschrift,
                membershipNumber: meta.membershipNumber,
                addressMissing: meta.addressMissing,
              },
              year,
              rawDonations: raw,
            })
          );
        } catch (e) {
          console.error("[receipts] Spender übersprungen:", donor.userId, e);
          skippedCount += 1;
        }
      }

      if (receipts.length === 0) {
        return new Response("Keine generierbaren Bescheinigungen", {
          status: 404,
        });
      }

      const stream = await renderReceiptsToStream(
        receipts,
        verein.name,
        year
      );

      await logAudit({
        mosqueId,
        userId: requesterId,
        action: "receipt_pdf_generated",
        entityType: "donation",
        entityId: mosqueId,
        details: {
          scope: "admin",
          mode,
          year,
          generated: receipts.length,
          skipped: skippedCount,
        },
      });

      const mosqueSlug = slugFilenamePart(verein.name);
      const filename = `spendenbescheinigungen-${year}-${mosqueSlug}.pdf`;
      return pdfResponse(stream as unknown as Readable, filename, disposition, {
        "X-Receipt-Generated-Count": String(receipts.length),
        "X-Receipt-Skipped-Count": String(skippedCount),
      });
    }

    return new Response("Ungültiger scope", { status: 400 });
  } catch (error) {
    console.error("[receipts] GET:", error);
    return new Response("Interner Fehler bei der PDF-Erzeugung", {
      status: 500,
    });
  }
}
