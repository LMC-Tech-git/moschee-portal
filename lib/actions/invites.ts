"use server";

import { randomBytes } from "crypto";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { logAudit } from "@/lib/audit";
import type { Invite } from "@/types";
import type { RecordModel } from "pocketbase";

// --- Helpers ---

function mapRecordToInvite(record: RecordModel): Invite {
  return {
    id: record.id,
    mosque_id: record.mosque_id || "",
    created_by: record.created_by || "",
    token: record.token || "",
    type: record.type || "personal",
    label: record.label || "",
    email: record.email || "",
    role: record.role || "member",
    initial_status: record.initial_status || "pending",
    max_uses: record.max_uses ?? 1,
    uses_count: record.uses_count ?? 0,
    expires_at: record.expires_at || "",
    is_active: record.is_active ?? true,
    created: record.created || "",
    updated: record.updated || "",
  };
}

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// --- Invite-Validierungshelfer (intern, kein "use server" Export für externe Nutzung) ---

export interface InviteValidationResult {
  valid: boolean;
  invite?: Invite;
  reason?: string;
}

/**
 * Validiert ein Invite-Token für eine bestimmte Moschee.
 * Prüft: is_active, mosque_id, expires_at, uses_count vs max_uses.
 */
export async function validateInviteByToken(
  token: string,
  mosqueId: string
): Promise<InviteValidationResult> {
  try {
    const pb = await getAdminPB();

    let record: RecordModel;
    try {
      record = await pb
        .collection("invites")
        .getFirstListItem(`token = "${token.replace(/"/g, "")}"`);
    } catch {
      return { valid: false, reason: "not_found" };
    }

    const invite = mapRecordToInvite(record);

    // Tenant Safety: mosque_id muss übereinstimmen
    if (invite.mosque_id !== mosqueId) {
      return { valid: false, reason: "not_found" };
    }

    // Widerrufen?
    if (!invite.is_active) {
      return { valid: false, invite, reason: "revoked" };
    }

    // Abgelaufen?
    if (invite.expires_at) {
      const expiresAt = new Date(invite.expires_at);
      if (expiresAt < new Date()) {
        return { valid: false, invite, reason: "expired" };
      }
    }

    // Ausgeschöpft? (max_uses > 0 und uses_count >= max_uses)
    if (invite.max_uses > 0 && invite.uses_count >= invite.max_uses) {
      return { valid: false, invite, reason: "exhausted" };
    }

    return { valid: true, invite };
  } catch (error) {
    console.error("[Invites] Validierungsfehler:", error);
    return { valid: false, reason: "error" };
  }
}

// --- Server Actions ---

interface CreateInviteData {
  type: "personal" | "group";
  label?: string;
  email?: string;
  role?: "member" | "teacher" | "admin" | "imam" | "editor" | "madrasa_admin" | "treasurer" | "secretary";
  initial_status?: "pending" | "active";
  max_uses?: number;
  expires_at?: string;
}

/**
 * Erstellt einen neuen Invite-Link für eine Moschee.
 * Nur Admins dürfen Invites erstellen (Zugriffsprüfung im UI-Layer).
 */
export async function createInvite(
  mosqueId: string,
  adminUserId: string,
  data: CreateInviteData
): Promise<ActionResult<Invite>> {
  try {
    const pb = await getAdminPB();

    // 64-char hex token (256 Bit Entropie)
    const token = randomBytes(32).toString("hex");

    const isPersonal = data.type === "personal";
    const max_uses = isPersonal ? 1 : (data.max_uses ?? 0);

    const createData: Record<string, unknown> = {
      mosque_id: mosqueId,
      created_by: adminUserId,
      token,
      type: data.type,
      label: data.label || "",
      role: data.role || "member",
      initial_status: data.initial_status || "pending",
      max_uses,
      uses_count: 0,
      is_active: true,
    };
    // PocketBase lehnt leere Strings für email/date-Felder ab
    if (data.email) createData.email = data.email;
    if (data.expires_at) createData.expires_at = data.expires_at;

    const record = await pb.collection("invites").create(createData);

    const invite = mapRecordToInvite(record);

    await logAudit({
      mosqueId,
      userId: adminUserId,
      action: "invite.created",
      entityType: "invite",
      entityId: invite.id,
      details: { type: data.type, role: invite.role, max_uses },
    });

    return { success: true, data: invite };
  } catch (error: unknown) {
    const pbErr = error as { status?: number; message?: string; data?: unknown };
    console.error("[Invites] Fehler beim Erstellen:", JSON.stringify(pbErr?.data || pbErr?.message || error));
    if (pbErr?.status === 404) {
      return { success: false, error: "invites-Collection nicht gefunden — bitte Migration ausführen" };
    }
    return { success: false, error: `Einladung konnte nicht erstellt werden (${pbErr?.message || "unbekannt"})` };
  }
}

/**
 * Alle Invites einer Moschee laden (Admin, paginiert).
 */
export async function getInvites(
  mosqueId: string,
  options?: { page?: number; limit?: number }
): Promise<ActionResult<Invite[]> & { totalPages?: number; totalItems?: number; page?: number }> {
  try {
    const pb = await getAdminPB();
    const page = options?.page || 1;
    const limit = options?.limit || 25;

    const records = await pb.collection("invites").getList(page, limit, {
      filter: `mosque_id = "${mosqueId}"`,
      sort: "-created",
    });

    return {
      success: true,
      data: records.items.map(mapRecordToInvite),
      totalPages: records.totalPages,
      totalItems: records.totalItems,
      page: records.page,
    };
  } catch (error) {
    console.error("[Invites] Fehler beim Laden:", error);
    return { success: false, error: "Einladungen konnten nicht geladen werden" };
  }
}

/**
 * Invite widerrufen (is_active = false).
 */
export async function revokeInvite(
  inviteId: string,
  mosqueId: string,
  adminUserId: string
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();

    const record = await pb.collection("invites").getOne(inviteId);
    if (record.mosque_id !== mosqueId) {
      return { success: false, error: "Einladung nicht gefunden" };
    }

    await pb.collection("invites").update(inviteId, { is_active: false });

    await logAudit({
      mosqueId,
      userId: adminUserId,
      action: "invite.revoked",
      entityType: "invite",
      entityId: inviteId,
      details: { token_prefix: record.token?.slice(0, 8) },
    });

    return { success: true };
  } catch (error) {
    console.error("[Invites] Fehler beim Widerrufen:", error);
    return { success: false, error: "Einladung konnte nicht widerrufen werden" };
  }
}

/**
 * Invite löschen (nur wenn uses_count = 0).
 */
export async function deleteInvite(
  inviteId: string,
  mosqueId: string,
  adminUserId: string
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();

    const record = await pb.collection("invites").getOne(inviteId);
    if (record.mosque_id !== mosqueId) {
      return { success: false, error: "Einladung nicht gefunden" };
    }
    if ((record.uses_count ?? 0) > 0) {
      return { success: false, error: "Bereits genutzte Einladungen können nicht gelöscht werden" };
    }

    await pb.collection("invites").delete(inviteId);

    await logAudit({
      mosqueId,
      userId: adminUserId,
      action: "invite.deleted",
      entityType: "invite",
      entityId: inviteId,
      details: { type: record.type },
    });

    return { success: true };
  } catch (error) {
    console.error("[Invites] Fehler beim Löschen:", error);
    return { success: false, error: "Einladung konnte nicht gelöscht werden" };
  }
}
