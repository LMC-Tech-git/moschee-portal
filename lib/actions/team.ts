"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { logAudit } from "@/lib/audit";
import type { TeamMember } from "@/types";
import type { RecordModel } from "pocketbase";

// --- Helper ---

function mapRecord(r: RecordModel): TeamMember {
  return {
    id: r.id,
    mosque_id: r.mosque_id || "",
    name: r.name || "",
    role: r.role || "",
    bio: r.bio || undefined,
    photo: r.photo || undefined,
    email: r.email || undefined,
    group: r.group || undefined,
    sort_order: r.sort_order ?? 0,
    is_active: r.is_active ?? true,
    created_by: r.created_by || undefined,
    created: r.created || "",
    updated: r.updated || "",
  };
}

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Admin: Alle Mitglieder einer Moschee ────────────────────────────────────

export async function getTeamMembers(
  mosqueId: string
): Promise<ActionResult<TeamMember[]>> {
  try {
    const pb = await getAdminPB();
    const records = await pb.collection("team_members").getFullList({
      filter: `mosque_id = "${mosqueId}"`,
      sort: "sort_order,name",
    });
    return { success: true, data: records.map(mapRecord) };
  } catch (error) {
    console.error("[team] getTeamMembers:", error);
    return { success: false, error: "Team-Mitglieder konnten nicht geladen werden." };
  }
}

// ─── Public: Nur aktive Mitglieder ───────────────────────────────────────────

export async function getActiveTeamMembers(
  mosqueId: string
): Promise<ActionResult<TeamMember[]>> {
  try {
    const pb = await getAdminPB();
    const records = await pb.collection("team_members").getFullList({
      filter: `mosque_id = "${mosqueId}" && is_active = true`,
      sort: "sort_order,name",
    });
    return { success: true, data: records.map(mapRecord) };
  } catch (error) {
    console.error("[team] getActiveTeamMembers:", error);
    return { success: false, error: "Team-Mitglieder konnten nicht geladen werden." };
  }
}

// ─── Admin: Mitglied erstellen ────────────────────────────────────────────────

export interface CreateTeamMemberInput {
  name: string;
  role: string;
  bio?: string;
  email?: string;
  group?: string;
  sort_order?: number;
}

export async function createTeamMember(
  mosqueId: string,
  userId: string,
  input: CreateTeamMemberInput
): Promise<ActionResult<TeamMember>> {
  try {
    if (!input.name?.trim()) {
      return { success: false, error: "Name ist erforderlich." };
    }
    if (!input.role?.trim()) {
      return { success: false, error: "Rolle ist erforderlich." };
    }
    if (input.bio && input.bio.length > 500) {
      return { success: false, error: "Beschreibung darf max. 500 Zeichen lang sein." };
    }

    const pb = await getAdminPB();
    const record = await pb.collection("team_members").create({
      mosque_id: mosqueId,
      name: input.name.trim(),
      role: input.role.trim(),
      bio: input.bio?.trim() || "",
      email: input.email?.trim() || "",
      group: input.group?.trim() || "",
      sort_order: input.sort_order ?? 0,
      is_active: true,
      created_by: userId,
    });

    const member = mapRecord(record);

    await logAudit({
      mosqueId,
      userId,
      action: "team_member.created",
      entityType: "team_members",
      entityId: record.id,
      after: { name: member.name, role: member.role, group: member.group },
    });

    return { success: true, data: member };
  } catch (error) {
    console.error("[team] createTeamMember:", error);
    return { success: false, error: "Team-Mitglied konnte nicht erstellt werden." };
  }
}

// ─── Admin: Mitglied aktualisieren ───────────────────────────────────────────

export interface UpdateTeamMemberInput {
  name?: string;
  role?: string;
  bio?: string;
  email?: string;
  group?: string;
  sort_order?: number;
  is_active?: boolean;
}

export async function updateTeamMember(
  mosqueId: string,
  userId: string,
  memberId: string,
  input: UpdateTeamMemberInput
): Promise<ActionResult<TeamMember>> {
  try {
    if (input.bio && input.bio.length > 500) {
      return { success: false, error: "Beschreibung darf max. 500 Zeichen lang sein." };
    }

    const pb = await getAdminPB();

    const existing = await pb.collection("team_members").getOne(memberId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Nicht gefunden." };
    }

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.role !== undefined) updateData.role = input.role.trim();
    if (input.bio !== undefined) updateData.bio = input.bio.trim();
    if (input.email !== undefined) updateData.email = input.email.trim();
    if (input.group !== undefined) updateData.group = input.group.trim();
    if (input.sort_order !== undefined) updateData.sort_order = input.sort_order;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    const record = await pb.collection("team_members").update(memberId, updateData);

    await logAudit({
      mosqueId,
      userId,
      action: "team_member.updated",
      entityType: "team_members",
      entityId: memberId,
      before: { name: existing.name },
      after: { name: record.name, role: record.role },
    });

    return { success: true, data: mapRecord(record) };
  } catch (error) {
    console.error("[team] updateTeamMember:", error);
    return { success: false, error: "Team-Mitglied konnte nicht aktualisiert werden." };
  }
}

// ─── Admin: Mitglied löschen ──────────────────────────────────────────────────

export async function deleteTeamMember(
  mosqueId: string,
  userId: string,
  memberId: string
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();

    const existing = await pb.collection("team_members").getOne(memberId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Nicht gefunden." };
    }

    await pb.collection("team_members").delete(memberId);

    await logAudit({
      mosqueId,
      userId,
      action: "team_member.deleted",
      entityType: "team_members",
      entityId: memberId,
      before: { name: existing.name },
    });

    return { success: true };
  } catch (error) {
    console.error("[team] deleteTeamMember:", error);
    return { success: false, error: "Team-Mitglied konnte nicht gelöscht werden." };
  }
}

// ─── Admin: Aktivieren / Deaktivieren ────────────────────────────────────────

export async function toggleTeamMemberActive(
  mosqueId: string,
  userId: string,
  memberId: string,
  active: boolean
): Promise<ActionResult<TeamMember>> {
  try {
    const pb = await getAdminPB();

    const existing = await pb.collection("team_members").getOne(memberId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Nicht gefunden." };
    }

    const record = await pb.collection("team_members").update(memberId, {
      is_active: active,
    });

    await logAudit({
      mosqueId,
      userId,
      action: active ? "team_member.activated" : "team_member.deactivated",
      entityType: "team_members",
      entityId: memberId,
      after: { name: existing.name, is_active: active },
    });

    return { success: true, data: mapRecord(record) };
  } catch (error) {
    console.error("[team] toggleTeamMemberActive:", error);
    return { success: false, error: "Status konnte nicht geändert werden." };
  }
}

// ─── Admin: Foto hochladen ────────────────────────────────────────────────────

export async function uploadTeamMemberPhoto(
  mosqueId: string,
  userId: string,
  memberId: string,
  formData: FormData
): Promise<ActionResult<TeamMember>> {
  try {
    const pb = await getAdminPB();

    const existing = await pb.collection("team_members").getOne(memberId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Nicht gefunden." };
    }

    const record = await pb.collection("team_members").update(memberId, formData);

    return { success: true, data: mapRecord(record) };
  } catch (error) {
    console.error("[team] uploadTeamMemberPhoto:", error);
    return { success: false, error: "Foto konnte nicht hochgeladen werden." };
  }
}

// ─── Admin: Reihenfolge speichern ────────────────────────────────────────────

export async function updateTeamMemberOrder(
  mosqueId: string,
  userId: string,
  orderedIds: string[]
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();

    const updates: Promise<unknown>[] = [];
    orderedIds.forEach((id, index) => {
      updates.push(
        pb.collection("team_members").update(id, { sort_order: index })
      );
    });
    await Promise.all(updates);

    await logAudit({
      mosqueId,
      userId,
      action: "team_members.reordered",
      entityType: "team_members",
      entityId: mosqueId,
      after: { count: orderedIds.length },
    });

    return { success: true };
  } catch (error) {
    console.error("[team] updateTeamMemberOrder:", error);
    return { success: false, error: "Reihenfolge konnte nicht gespeichert werden." };
  }
}
