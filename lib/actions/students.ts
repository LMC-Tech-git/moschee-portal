"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { studentSchema, memberStudentSchema, type StudentInput, type MemberStudentInput } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { applyPhoneNorm, detectCountryFromMosque } from "@/lib/phone";
import type { Student } from "@/types";
import type { RecordModel } from "pocketbase";
import { checkDemoLimit } from "@/lib/demo";

// --- Helpers ---

function mapRecord(record: RecordModel): Student {
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
    custom_discount_percent: record.custom_discount_percent ?? 0,
    created: record.created || "",
    updated: record.updated || "",
  };
}

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Alle aktiven Schüler einer Moschee laden.
 */
export async function getStudentsByMosque(
  mosqueId: string,
  includeInactive = false
): Promise<ActionResult<Student[]>> {
  try {
    const pb = await getAdminPB();
    const filter = includeInactive
      ? `mosque_id = "${mosqueId}"`
      : `mosque_id = "${mosqueId}" && status = "active"`;
    const records = await pb.collection("students").getFullList({
      filter,
      sort: "first_name,last_name",
    });
    return { success: true, data: records.map(mapRecord) };
  } catch (error) {
    console.error("[Students] Fehler beim Laden:", error);
    return { success: false, error: "Schüler konnten nicht geladen werden" };
  }
}

/**
 * Schüler eines bestimmten Elternteils laden (für Member-Profil).
 * Kombiniert Legacy-Felder (parent_id, father_user_id, mother_user_id)
 * mit der neuen parent_child_relations junction table.
 */
export async function getStudentsByParent(
  parentId: string,
  mosqueId: string
): Promise<ActionResult<Student[]>> {
  try {
    const pb = await getAdminPB();

    // TODO: Remove legacy fallback after migration cleanup (Phase 5)
    // Legacy: Kinder über alte Felder laden
    const legacyRecords = await pb.collection("students").getFullList({
      filter: `mosque_id = "${mosqueId}" && (parent_id = "${parentId}" || father_user_id = "${parentId}" || mother_user_id = "${parentId}") && status = "active"`,
      sort: "last_name,first_name",
    });
    const legacyStudents = legacyRecords.map(mapRecord);

    // Neu: Kinder über parent_child_relations laden
    const relResult = await pb.collection("parent_child_relations").getList(1, 200, {
      filter: `mosque_id = "${mosqueId}" && parent_user = "${parentId}"`,
      expand: "student",
    });
    const relStudents = relResult.items
      .filter((r) => r.expand && r.expand.student)
      .map((r) => mapRecord(r.expand!.student));

    // Deduplizieren (ein Schüler könnte in beiden Quellen vorhanden sein)
    const all = [...legacyStudents, ...relStudents];
    const seen = new Set<string>();
    const deduped = all.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });

    return { success: true, data: deduped };
  } catch (error) {
    console.error("[Students] Fehler beim Laden der Kinder:", error);
    return { success: false, error: "Kinder konnten nicht geladen werden" };
  }
}

/**
 * Einzelnen Schüler laden.
 */
export async function getStudentById(
  studentId: string,
  mosqueId: string
): Promise<ActionResult<Student>> {
  try {
    const pb = await getAdminPB();
    const record = await pb.collection("students").getOne(studentId);
    if (record.mosque_id !== mosqueId) {
      return { success: false, error: "Schüler nicht gefunden" };
    }
    return { success: true, data: mapRecord(record) };
  } catch {
    return { success: false, error: "Schüler nicht gefunden" };
  }
}

/**
 * Neuen Schüler erstellen.
 */
export async function createStudent(
  mosqueId: string,
  userId: string,
  input: StudentInput
): Promise<ActionResult<Student>> {
  try {
    const validated = studentSchema.parse(input);
    const pb = await getAdminPB();

    const demoCheck = await checkDemoLimit(mosqueId, "students");
    if (!demoCheck.allowed) return { success: false, error: demoCheck.error };

    // Moschee laden → Land für Telefonnormalisierung bestimmen
    const mosque = await pb.collection("mosques").getOne(mosqueId);
    const country = detectCountryFromMosque(mosque as { timezone?: string; address?: string; city?: string });
    const normalizedParentPhone = applyPhoneNorm(validated.parent_phone || "", country);

    const normalizedMotherPhone = applyPhoneNorm(validated.mother_phone || "", country);
    const normalizedFatherPhone = applyPhoneNorm(validated.father_phone || "", country);

    const record = await pb.collection("students").create({
      mosque_id: mosqueId,
      first_name: validated.first_name,
      last_name: validated.last_name,
      date_of_birth: validated.date_of_birth,
      gender: validated.gender || "",
      parent_id: validated.parent_id || "",
      parent_name: validated.parent_name || "",
      parent_phone: normalizedParentPhone,
      address: validated.address || "",
      school_name: validated.school_name || "",
      school_class: validated.school_class || "",
      health_notes: validated.health_notes || "",
      mother_name: validated.mother_name || "",
      mother_phone: normalizedMotherPhone,
      father_name: validated.father_name || "",
      father_phone: normalizedFatherPhone,
      membership_status: validated.membership_status || "",
      last_year_attended: validated.last_year_attended ?? false,
      last_year_teacher: validated.last_year_teacher || "",
      whatsapp_contact: validated.whatsapp_contact || "",
      parent_is_member: validated.parent_is_member ?? false,
      notes: validated.notes || "",
      status: validated.status,
      custom_discount_percent: validated.custom_discount_percent ?? 0,
    });

    await logAudit({
      mosqueId,
      userId,
      action: "student.created",
      entityType: "student",
      entityId: record.id,
      details: { name: `${validated.first_name} ${validated.last_name}` },
    });

    return { success: true, data: mapRecord(record) };
  } catch (error) {
    console.error("[Students] Fehler beim Erstellen:", error);
    return { success: false, error: "Schüler konnte nicht erstellt werden" };
  }
}

/**
 * Schüler aktualisieren.
 */
export async function updateStudent(
  studentId: string,
  mosqueId: string,
  userId: string,
  input: StudentInput
): Promise<ActionResult<Student>> {
  try {
    const validated = studentSchema.parse(input);
    const pb = await getAdminPB();

    const existing = await pb.collection("students").getOne(studentId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Schüler nicht gefunden" };
    }

    // Moschee laden → Land für Telefonnormalisierung bestimmen
    const mosque = await pb.collection("mosques").getOne(mosqueId);
    const country = detectCountryFromMosque(mosque as { timezone?: string; address?: string; city?: string });
    const normalizedParentPhone = applyPhoneNorm(validated.parent_phone || "", country);

    const normalizedMotherPhone = applyPhoneNorm(validated.mother_phone || "", country);
    const normalizedFatherPhone = applyPhoneNorm(validated.father_phone || "", country);

    const record = await pb.collection("students").update(studentId, {
      first_name: validated.first_name,
      last_name: validated.last_name,
      date_of_birth: validated.date_of_birth,
      gender: validated.gender || "",
      parent_id: validated.parent_id || "",
      parent_name: validated.parent_name || "",
      parent_phone: normalizedParentPhone,
      address: validated.address || "",
      school_name: validated.school_name || "",
      school_class: validated.school_class || "",
      health_notes: validated.health_notes || "",
      mother_name: validated.mother_name || "",
      mother_phone: normalizedMotherPhone,
      father_name: validated.father_name || "",
      father_phone: normalizedFatherPhone,
      membership_status: validated.membership_status || "",
      last_year_attended: validated.last_year_attended ?? false,
      last_year_teacher: validated.last_year_teacher || "",
      whatsapp_contact: validated.whatsapp_contact || "",
      parent_is_member: validated.parent_is_member ?? false,
      notes: validated.notes || "",
      status: validated.status,
      custom_discount_percent: validated.custom_discount_percent ?? 0,
    });

    await logAudit({
      mosqueId,
      userId,
      action: "student.updated",
      entityType: "student",
      entityId: studentId,
      details: { name: `${validated.first_name} ${validated.last_name}` },
    });

    return { success: true, data: mapRecord(record) };
  } catch (error) {
    console.error("[Students] Fehler beim Aktualisieren:", error);
    return { success: false, error: "Schüler konnte nicht aktualisiert werden" };
  }
}

/**
 * Kind anlegen (Eltern-Kontext): strengere Validierung, privacy_accepted_at wird gesetzt.
 */
export async function createStudentByParent(
  mosqueId: string,
  userId: string,
  input: MemberStudentInput
): Promise<ActionResult<Student>> {
  try {
    const validated = memberStudentSchema.parse(input);
    const pb = await getAdminPB();

    const demoCheck = await checkDemoLimit(mosqueId, "students");
    if (!demoCheck.allowed) return { success: false, error: demoCheck.error };

    const mosque = await pb.collection("mosques").getOne(mosqueId);
    const country = detectCountryFromMosque(mosque as { timezone?: string; address?: string; city?: string });
    const normalizedParentPhone = applyPhoneNorm(validated.parent_phone || "", country);
    const normalizedMotherPhone = applyPhoneNorm(validated.mother_phone || "", country);
    const normalizedFatherPhone = applyPhoneNorm(validated.father_phone || "", country);

    const record = await pb.collection("students").create({
      mosque_id: mosqueId,
      first_name: validated.first_name,
      last_name: validated.last_name,
      date_of_birth: validated.date_of_birth,
      gender: validated.gender,
      parent_id: userId,
      parent_name: validated.parent_name || "",
      parent_phone: normalizedParentPhone,
      address: validated.address || "",
      school_name: validated.school_name,
      school_class: validated.school_class,
      health_notes: validated.health_notes || "",
      mother_name: validated.mother_name || "",
      mother_phone: normalizedMotherPhone,
      father_name: validated.father_name || "",
      father_phone: normalizedFatherPhone,
      membership_status: "",
      last_year_attended: validated.last_year_attended,
      last_year_teacher: validated.last_year_teacher || "",
      whatsapp_contact: validated.whatsapp_contact,
      parent_is_member: validated.parent_is_member,
      privacy_accepted_at: new Date().toISOString(),
      notes: validated.notes || "",
      status: "active",
    });

    await logAudit({
      mosqueId,
      userId,
      action: "student.created_by_parent",
      entityType: "student",
      entityId: record.id,
      details: { name: `${validated.first_name} ${validated.last_name}` },
    });

    return { success: true, data: mapRecord(record) };
  } catch (error) {
    console.error("[Students] Fehler beim Anlegen (Eltern):", error);
    return { success: false, error: "Kind konnte nicht gespeichert werden" };
  }
}

/**
 * Kind bearbeiten (Eltern-Kontext): Prüft ob parent_id === userId.
 */
export async function updateStudentByParent(
  studentId: string,
  mosqueId: string,
  userId: string,
  input: MemberStudentInput
): Promise<ActionResult<Student>> {
  try {
    const validated = memberStudentSchema.parse(input);
    const pb = await getAdminPB();

    // Prüfen: Schüler gehört zu diesem Elternteil
    const existing = await pb.collection("students").getOne(studentId);

    // Mandant-Check (immer)
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Schüler nicht gefunden" };
    }

    // Eltern-Berechtigung: Legacy parent_id ODER junction table (parent_child_relations)
    let isAuthorized = existing.parent_id === userId;
    if (!isAuthorized) {
      const rel = await pb.collection("parent_child_relations").getList(1, 1, {
        filter: `parent_user = "${userId}" && student = "${studentId}"`,
      });
      isAuthorized = rel.totalItems > 0;
    }
    if (!isAuthorized) {
      return { success: false, error: "Schüler nicht gefunden" };
    }

    const mosque = await pb.collection("mosques").getOne(mosqueId);
    const country = detectCountryFromMosque(mosque as { timezone?: string; address?: string; city?: string });
    const normalizedParentPhone = applyPhoneNorm(validated.parent_phone || "", country);
    const normalizedMotherPhone = applyPhoneNorm(validated.mother_phone || "", country);
    const normalizedFatherPhone = applyPhoneNorm(validated.father_phone || "", country);

    const record = await pb.collection("students").update(studentId, {
      first_name: validated.first_name,
      last_name: validated.last_name,
      date_of_birth: validated.date_of_birth,
      gender: validated.gender,
      parent_name: validated.parent_name || "",
      parent_phone: normalizedParentPhone,
      address: validated.address || "",
      school_name: validated.school_name,
      school_class: validated.school_class,
      health_notes: validated.health_notes || "",
      mother_name: validated.mother_name || "",
      mother_phone: normalizedMotherPhone,
      father_name: validated.father_name || "",
      father_phone: normalizedFatherPhone,
      last_year_attended: validated.last_year_attended,
      last_year_teacher: validated.last_year_teacher || "",
      whatsapp_contact: validated.whatsapp_contact,
      parent_is_member: validated.parent_is_member,
      notes: validated.notes || "",
    });

    await logAudit({
      mosqueId,
      userId,
      action: "student.updated_by_parent",
      entityType: "student",
      entityId: studentId,
      details: { name: `${validated.first_name} ${validated.last_name}` },
    });

    return { success: true, data: mapRecord(record) };
  } catch (error) {
    console.error("[Students] Fehler beim Bearbeiten (Eltern):", error);
    return { success: false, error: "Kind konnte nicht gespeichert werden" };
  }
}

// ─── Bulk Import ────────────────────────────────────────────────────────────

export interface ImportStudentRow {
  first_name: string;
  last_name: string;
  date_of_birth: string; // YYYY-MM-DD
  gender?: string;
  address?: string;
  school_name?: string;
  school_class?: string;
  parent_name?: string;
  parent_phone?: string;
  mother_name?: string;
  mother_phone?: string;
  father_name?: string;
  father_phone?: string;
  health_notes?: string;
  notes?: string;
}

export interface ImportStudentsResult {
  created: number;
  enrolled: number;
  errors: string[];
}

/**
 * Mehrere Schüler auf einmal importieren (aus CSV/Excel).
 * Erstellt Schüler-Records und schreibt sie optional in einen Kurs ein.
 */
export async function importStudentsBulk(
  mosqueId: string,
  userId: string,
  courseId: string | null,
  rows: ImportStudentRow[]
): Promise<ActionResult<ImportStudentsResult>> {
  try {
    const pb = await getAdminPB();

    // Moschee einmalig laden → Land für Telefonnormalisierung
    const mosque = await pb.collection("mosques").getOne(mosqueId);
    const country = detectCountryFromMosque(mosque as { timezone?: string; address?: string; city?: string });

    let created = 0;
    let enrolled = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowLabel = `${row.first_name} ${row.last_name}`.trim() || `Zeile ${i + 2}`;

      if (!row.first_name?.trim() || !row.last_name?.trim()) {
        errors.push(`Zeile ${i + 2}: Vorname und Nachname sind erforderlich`);
        continue;
      }
      if (!row.date_of_birth) {
        errors.push(`${rowLabel}: Geburtstag fehlt`);
        continue;
      }

      try {
        const normalizedParentPhone = applyPhoneNorm(row.parent_phone || "", country);

        const normalizedMotherPhone = applyPhoneNorm(row.mother_phone || "", country);
        const normalizedFatherPhone = applyPhoneNorm(row.father_phone || "", country);

        const record = await pb.collection("students").create({
          mosque_id: mosqueId,
          first_name: row.first_name.trim(),
          last_name: row.last_name.trim(),
          date_of_birth: row.date_of_birth,
          gender: row.gender || "",
          address: (row.address || "").trim(),
          school_name: (row.school_name || "").trim(),
          school_class: (row.school_class || "").trim(),
          parent_name: (row.parent_name || "").trim(),
          parent_phone: normalizedParentPhone,
          mother_name: (row.mother_name || "").trim(),
          mother_phone: normalizedMotherPhone,
          father_name: (row.father_name || "").trim(),
          father_phone: normalizedFatherPhone,
          health_notes: (row.health_notes || "").trim(),
          notes: (row.notes || "").trim(),
          status: "active",
        });
        created++;

        if (courseId) {
          try {
            await pb.collection("course_enrollments").create({
              mosque_id: mosqueId,
              course_id: courseId,
              student_id: record.id,
              status: "enrolled",
              enrolled_at: new Date().toISOString(),
            });
            enrolled++;
          } catch {
            errors.push(`${rowLabel}: Schüler erstellt, Einschreibung fehlgeschlagen`);
          }
        }
      } catch {
        errors.push(`${rowLabel}: Erstellung fehlgeschlagen`);
      }
    }

    await logAudit({
      mosqueId,
      userId,
      action: "student.imported",
      entityType: "student",
      entityId: courseId || mosqueId,
      details: { created, enrolled, error_count: errors.length, course_id: courseId },
    });

    return { success: true, data: { created, enrolled, errors } };
  } catch (error) {
    console.error("[Students] Fehler beim Import:", error);
    return { success: false, error: "Import fehlgeschlagen" };
  }
}

/**
 * Mitglieder einer Moschee als mögliche Elternteile laden.
 */
export async function getParentCandidates(
  mosqueId: string
): Promise<ActionResult<{ id: string; name: string; phone: string; address: string }[]>> {
  try {
    const pb = await getAdminPB();
    const records = await pb.collection("users").getFullList({
      filter: `mosque_id = "${mosqueId}" && status = "active"`,
      sort: "first_name",
    });
    const parents = records.map((r) => ({
      id: r.id,
      name: `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.email || r.id,
      phone: r.phone || "",
      address: r.address || "",
    }));
    return { success: true, data: parents };
  } catch (error) {
    console.error("[Students] Fehler beim Laden der Eltern:", error);
    return { success: false, error: "Eltern konnten nicht geladen werden" };
  }
}

/**
 * Aktive Schüler einer Moschee, die noch NICHT in einem bestimmten Kurs eingeschrieben sind.
 * Wird für den StudentLookup auf der Kurs-Seite verwendet.
 */
export async function getUnenrolledStudents(
  courseId: string,
  mosqueId: string
): Promise<ActionResult<Student[]>> {
  try {
    const pb = await getAdminPB();
    const [studentsResult, enrolledRecords] = await Promise.all([
      pb.collection("students").getFullList({
        filter: `mosque_id = "${mosqueId}" && status = "active"`,
        sort: "first_name,last_name",
      }),
      pb.collection("course_enrollments").getFullList({
        filter: `course_id = "${courseId}" && status != "dropped"`,
        fields: "student_id",
      }),
    ]);
    const enrolledIds = new Set(enrolledRecords.map((r) => r.student_id as string));
    const unenrolled = studentsResult
      .filter((r) => !enrolledIds.has(r.id))
      .map(mapRecord);
    return { success: true, data: unenrolled };
  } catch (error) {
    console.error("[Students] Fehler beim Laden der nicht-eingeschriebenen Schüler:", error);
    return { success: false, error: "Schüler konnten nicht geladen werden" };
  }
}
