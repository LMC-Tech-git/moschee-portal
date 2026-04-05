"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { logAudit } from "@/lib/audit";
import type { Student, User } from "@/types";
import type { RecordModel } from "pocketbase";

// --- Helpers ---

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

function mapStudent(record: RecordModel): Student {
  return {
    id: record.id,
    mosque_id: record.mosque_id || "",
    first_name: record.first_name || "",
    last_name: record.last_name || "",
    date_of_birth: record.date_of_birth || "",
    gender: record.gender || "",
    parent_id: record.parent_id || "",
    parent_name: record.parent_name || "",
    parent_phone: record.parent_phone || "",
    address: record.address || "",
    school_name: record.school_name || "",
    school_class: record.school_class || "",
    health_notes: record.health_notes || "",
    mother_name: record.mother_name || "",
    mother_phone: record.mother_phone || "",
    father_name: record.father_name || "",
    father_phone: record.father_phone || "",
    membership_status: record.membership_status || "",
    last_year_attended: record.last_year_attended ?? false,
    last_year_teacher: record.last_year_teacher || "",
    whatsapp_contact: record.whatsapp_contact || "",
    parent_is_member: record.parent_is_member ?? false,
    privacy_accepted_at: record.privacy_accepted_at || "",
    father_user_id: record.father_user_id || "",
    mother_user_id: record.mother_user_id || "",
    notes: record.notes || "",
    status: record.status || "active",
    created: record.created || "",
    updated: record.updated || "",
  };
}

function mapUser(record: RecordModel): User {
  return {
    id: record.id,
    mosque_id: record.mosque_id || "",
    email: record.email || "",
    first_name: record.first_name || "",
    last_name: record.last_name || "",
    full_name: `${record.first_name || ""} ${record.last_name || ""}`.trim(),
    phone: record.phone || "",
    address: record.address || "",
    member_no: record.member_no || "",
    membership_number: record.membership_number || "",
    status: record.status || "active",
    role: record.role || "member",
    created: record.created || "",
    updated: record.updated || "",
  };
}

// --- Actions ---

/**
 * Elternteil mit einem Schüler verknüpfen.
 * Nur Admin darf diese Action aufrufen.
 */
export async function linkParentToStudent(
  mosqueId: string,
  actorId: string,
  parentUserId: string,
  studentId: string
): Promise<ActionResult<void>> {
  try {
    // Self-link guard (unterschiedliche Collections, aber trotzdem absichern)
    if (parentUserId === studentId) {
      return { success: false, error: "Ungültige Verknüpfung" };
    }

    const pb = await getAdminPB();

    // Cross-tenant check: Student und Elternteil müssen zur selben Moschee gehören
    const [student, parent] = await Promise.all([
      pb.collection("students").getOne(studentId),
      pb.collection("users").getOne(parentUserId),
    ]);

    if (student.mosque_id !== mosqueId || parent.mosque_id !== mosqueId) {
      return { success: false, error: "Ungültige Verknüpfung" };
    }

    // Duplikat-Prüfung
    const existing = await pb.collection("parent_child_relations").getList(1, 1, {
      filter: `mosque_id="${mosqueId}" && parent_user="${parentUserId}" && student="${studentId}"`,
    });

    if (existing.items.length > 0) {
      return { success: false, error: "Relation bereits vorhanden" };
    }

    // Relation erstellen
    const relation = await pb.collection("parent_child_relations").create({
      mosque_id: mosqueId,
      parent_user: parentUserId,
      student: studentId,
    });

    await logAudit({
      mosqueId,
      userId: actorId,
      action: "parent_child.linked",
      entityType: "parent_child_relations",
      entityId: relation.id,
      details: {
        parent_user_id: parentUserId,
        student_id: studentId,
        parent_name: `${parent.first_name || ""} ${parent.last_name || ""}`.trim() || parent.email,
        student_name: `${student.first_name || ""} ${student.last_name || ""}`.trim(),
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[ParentChild] Fehler beim Verknüpfen:", error);
    return { success: false, error: "Verknüpfung konnte nicht erstellt werden" };
  }
}

/**
 * Verknüpfung zwischen Elternteil und Schüler entfernen.
 * Nur Admin darf diese Action aufrufen.
 */
export async function unlinkParentFromStudent(
  mosqueId: string,
  actorId: string,
  parentUserId: string,
  studentId: string
): Promise<ActionResult<void>> {
  try {
    const pb = await getAdminPB();

    const existing = await pb.collection("parent_child_relations").getList(1, 1, {
      filter: `mosque_id="${mosqueId}" && parent_user="${parentUserId}" && student="${studentId}"`,
    });

    if (existing.items.length === 0) {
      return { success: false, error: "Relation nicht gefunden" };
    }

    const record = existing.items[0];
    await pb.collection("parent_child_relations").delete(record.id);

    await logAudit({
      mosqueId,
      userId: actorId,
      action: "parent_child.unlinked",
      entityType: "parent_child_relations",
      entityId: record.id,
      details: { parent_user_id: parentUserId, student_id: studentId },
    });

    return { success: true };
  } catch (error) {
    console.error("[ParentChild] Fehler beim Entfernen:", error);
    return { success: false, error: "Verknüpfung konnte nicht entfernt werden" };
  }
}

/**
 * Alle Kinder eines Elternteils über die neue junction table laden.
 */
export async function getChildrenOfParent(
  mosqueId: string,
  parentUserId: string
): Promise<ActionResult<Student[]>> {
  try {
    const pb = await getAdminPB();
    const all: Student[] = [];
    let page = 1;

    while (true) {
      const res = await pb.collection("parent_child_relations").getList(page, 200, {
        filter: `mosque_id="${mosqueId}" && parent_user="${parentUserId}"`,
        expand: "student",
      });

      for (const r of res.items) {
        if (!r.expand || !r.expand.student) continue;
        all.push(mapStudent(r.expand.student));
      }

      if (res.page >= res.totalPages) break;
      page++;
    }

    return { success: true, data: all };
  } catch (error) {
    console.error("[ParentChild] Fehler beim Laden der Kinder:", error);
    return { success: false, error: "Kinder konnten nicht geladen werden" };
  }
}

/**
 * Alle Elternteile eines Schülers über die junction table laden.
 */
export async function getParentsOfStudent(
  mosqueId: string,
  studentId: string
): Promise<ActionResult<User[]>> {
  try {
    const pb = await getAdminPB();
    const all: User[] = [];
    let page = 1;

    while (true) {
      const res = await pb.collection("parent_child_relations").getList(page, 200, {
        filter: `mosque_id="${mosqueId}" && student="${studentId}"`,
        expand: "parent_user",
      });

      for (const r of res.items) {
        if (!r.expand || !r.expand.parent_user) continue;
        all.push(mapUser(r.expand.parent_user));
      }

      if (res.page >= res.totalPages) break;
      page++;
    }

    return { success: true, data: all };
  } catch (error) {
    console.error("[ParentChild] Fehler beim Laden der Eltern:", error);
    return { success: false, error: "Eltern konnten nicht geladen werden" };
  }
}
