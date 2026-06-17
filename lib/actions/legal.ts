"use server";

/**
 * Server Actions für Rechtstext-Zustimmungen (Vertragsannahmen).
 *
 * Schreibt nachweisbare Datensätze in `legal_acceptances`: Wer, wann, welche
 * Version, Hash des exakten Wortlauts, gehashte IP, Name/E-Mail-Snapshot.
 * Append-only — Neu-Zustimmungen erzeugen neue Zeilen mit höherer Version.
 */

import { headers } from "next/headers";
import { getAuthFromCookie } from "@/lib/auth-cookie";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { hashIP } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import {
  LEGAL_VERSIONS,
  LEGAL_BASIS,
  MOSQUE_DOCS,
  USER_DOCS,
  docHash,
  outstandingDocs,
  type LegalDocType,
  type LegalLocale,
  type AcceptedDocRef,
} from "@/lib/legal";

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

/** PB-Filter-Injection-Schutz: IDs sind alphanumerisch. */
function safeId(id: string): string {
  return /^[a-zA-Z0-9]+$/.test(id) ? id : "";
}

function normalizeLocale(value: unknown): LegalLocale {
  return value === "tr" ? "tr" : "de";
}

/** Liest IP-Hash + User-Agent aus dem aktuellen Request-Kontext. */
async function readRequestMeta(): Promise<{ ipHash: string; userAgent: string }> {
  try {
    const h = headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const userAgent = (h.get("user-agent") || "").slice(0, 400);
    return { ipHash: await hashIP(ip), userAgent };
  } catch {
    return { ipHash: "", userAgent: "" };
  }
}

interface PbAcceptanceRow {
  doc_type: LegalDocType;
  doc_version: number;
}

async function loadAccepted(
  filter: string
): Promise<AcceptedDocRef[]> {
  const pb = await getAdminPB();
  const rows = await pb.collection("legal_acceptances").getFullList({
    filter,
    fields: "doc_type,doc_version",
  });
  return (rows as unknown as PbAcceptanceRow[]).map((r) => ({
    doc_type: r.doc_type,
    doc_version: r.doc_version,
  }));
}

/**
 * Schreibt Zustimmungs-Records für alle Endnutzer-Dokumente (AGB + Datenschutz).
 * `userId` muss serverseitig stammen (z. B. frisch erstellter User).
 */
export async function recordUserAcceptance(
  userId: string,
  locale: LegalLocale = "de"
): Promise<void> {
  if (!userId) return;
  const pb = await getAdminPB();

  let user: { mosque_id?: string; email?: string; first_name?: string; last_name?: string };
  try {
    user = await pb.collection("users").getOne(userId, {
      fields: "mosque_id,email,first_name,last_name",
    });
  } catch {
    return;
  }
  const mosqueId = user.mosque_id || "";
  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  const { ipHash, userAgent } = await readRequestMeta();
  const acceptedAt = new Date().toISOString();

  for (const docType of USER_DOCS) {
    const version = LEGAL_VERSIONS[docType];
    const hash = await docHash(docType, version, locale);
    try {
      await pb.collection("legal_acceptances").create({
        mosque_id: mosqueId,
        user_id: userId,
        scope: "user",
        legal_basis: LEGAL_BASIS[docType],
        doc_type: docType,
        doc_version: version,
        doc_hash: hash,
        doc_locale: locale,
        accepted_at: acceptedAt,
        ip_hash: ipHash,
        accepter_name: name,
        accepter_email: user.email || "",
        accepter_role: "",
        user_agent: userAgent,
      });
    } catch (e) {
      console.error("[legal] recordUserAcceptance failed", docType, e);
    }
  }

  await logAudit({
    mosqueId,
    userId,
    action: "legal_accept_user",
    entityType: "legal_acceptance",
    entityId: userId,
    details: {
      docs: USER_DOCS.map((d) => `${d}@v${LEGAL_VERSIONS[d]}`),
      locale,
    },
  });
}

/**
 * Client-aufrufbare Variante: leitet die User-ID aus dem Auth-Cookie ab
 * (nicht vom Client vertrauen). Für den Re-Zustimmungs-Gate.
 */
export async function acceptUserLegal(
  locale: LegalLocale = "de"
): Promise<{ success: boolean }> {
  const { isLoggedIn, userId } = getAuthFromCookie();
  if (!isLoggedIn || !userId) return { success: false };
  await recordUserAcceptance(userId, normalizeLocale(locale));
  return { success: true };
}

/**
 * Schreibt Zustimmungs-Records für die Vorstand-/Gemeinde-Dokumente
 * (Nutzungsvereinbarung + AVV). Nur Admins dürfen für die Gemeinde annehmen.
 */
export async function recordMosqueAcceptance(input: {
  name: string;
  role: string;
  locale?: LegalLocale;
}): Promise<{ success: boolean; error?: string }> {
  const { isLoggedIn, userId } = getAuthFromCookie();
  const name = (input.name || "").trim();
  const accepterRole = (input.role || "").trim();
  const locale = normalizeLocale(input.locale);

  if (!isLoggedIn || !userId) return { success: false, error: "not_authenticated" };
  if (!name || !accepterRole) return { success: false, error: "missing_fields" };

  const pb = await getAdminPB();
  let user: { mosque_id?: string; email?: string; role?: string };
  try {
    user = await pb.collection("users").getOne(userId, {
      fields: "mosque_id,email,role",
    });
  } catch {
    return { success: false, error: "not_found" };
  }

  if (!ADMIN_ROLES.has(user.role || "")) {
    return { success: false, error: "forbidden" };
  }
  const mosqueId = user.mosque_id || "";
  if (!mosqueId) return { success: false, error: "no_mosque" };

  const { ipHash, userAgent } = await readRequestMeta();
  const acceptedAt = new Date().toISOString();

  for (const docType of MOSQUE_DOCS) {
    const version = LEGAL_VERSIONS[docType];
    const hash = await docHash(docType, version, locale);
    try {
      await pb.collection("legal_acceptances").create({
        mosque_id: mosqueId,
        user_id: userId,
        scope: "mosque",
        legal_basis: LEGAL_BASIS[docType],
        doc_type: docType,
        doc_version: version,
        doc_hash: hash,
        doc_locale: locale,
        accepted_at: acceptedAt,
        ip_hash: ipHash,
        accepter_name: name,
        accepter_email: user.email || "",
        accepter_role: accepterRole,
        user_agent: userAgent,
      });
    } catch (e) {
      console.error("[legal] recordMosqueAcceptance failed", docType, e);
      return { success: false, error: "write_failed" };
    }
  }

  await logAudit({
    mosqueId,
    userId,
    action: "legal_accept_mosque",
    entityType: "legal_acceptance",
    entityId: mosqueId,
    details: {
      docs: MOSQUE_DOCS.map((d) => `${d}@v${LEGAL_VERSIONS[d]}`),
      accepter_name: name,
      accepter_role: accepterRole,
      locale,
    },
  });

  return { success: true };
}

/** Offene (fehlende/veraltete) Vorstand-Dokumente einer Gemeinde. */
export async function getMosqueAcceptanceStatus(
  mosqueId: string
): Promise<{ outstanding: LegalDocType[] }> {
  const safe = safeId(mosqueId);
  if (!safe) return { outstanding: [] };
  try {
    const accepted = await loadAccepted(
      `mosque_id = "${safe}" && scope = "mosque"`
    );
    return { outstanding: outstandingDocs("mosque", accepted) };
  } catch {
    return { outstanding: [] };
  }
}

/** Offene (fehlende/veraltete) Endnutzer-Dokumente eines Users. */
export async function getUserAcceptanceStatus(
  userId: string
): Promise<{ outstanding: LegalDocType[] }> {
  const safe = safeId(userId);
  if (!safe) return { outstanding: [] };
  try {
    const accepted = await loadAccepted(
      `user_id = "${safe}" && scope = "user"`
    );
    return { outstanding: outstandingDocs("user", accepted) };
  } catch {
    return { outstanding: [] };
  }
}
