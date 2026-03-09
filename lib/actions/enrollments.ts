"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { enrollmentSchema, type EnrollmentInput } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import type { CourseEnrollment, Student } from "@/types";
import type { RecordModel } from "pocketbase";

// --- Helpers ---

function mapRecordToEnrollment(record: RecordModel): CourseEnrollment {
  return {
    id: record.id,
    mosque_id: record.mosque_id || "",
    course_id: record.course_id || "",
    student_id: record.student_id || "",
    status: record.status || "enrolled",
    enrolled_at: record.enrolled_at || record.created || "",
    completed_at: record.completed_at || "",
    notes: record.notes || "",
    created: record.created || "",
    updated: record.updated || "",
    expand: record.expand ? {
      course_id: record.expand.course_id || undefined,
      student_id: record.expand.student_id || undefined,
    } : undefined,
  };
}

// --- Server Actions ---

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Alle Einschreibungen eines Kurses laden (Admin/Lehrer).
 */
export async function getEnrollmentsByCourse(
  courseId: string,
  mosqueId: string
): Promise<ActionResult<(CourseEnrollment & {
  student_name?: string;
  student_date_of_birth?: string;
  student_parent_id?: string;
  student_parent_user_name?: string;
  student_parent_name?: string;
  student_parent_phone?: string;
  student_father_name?: string;
  student_father_phone?: string;
  student_mother_name?: string;
  student_mother_phone?: string;
})[]>> {
  try {
    const pb = await getAdminPB();

    // Kurs-Zugehörigkeit prüfen
    const course = await pb.collection("courses").getOne(courseId);
    if (course.mosque_id !== mosqueId) {
      return { success: false, error: "Kurs nicht gefunden" };
    }

    const records = await pb.collection("course_enrollments").getFullList({
      filter: `course_id = "${courseId}"`,
      sort: "-created",
      expand: "student_id,student_id.parent_id",
    });

    const enrollments = records.map((record) => {
      const enrollment = mapRecordToEnrollment(record);
      const student = record.expand?.student_id as RecordModel | undefined;
      const parentUser = student?.expand?.parent_id as RecordModel | undefined;
      return {
        ...enrollment,
        student_name: student
          ? `${student.first_name || ""} ${student.last_name || ""}`.trim()
          : undefined,
        student_date_of_birth: student?.date_of_birth || undefined,
        student_parent_id: student?.parent_id || undefined,
        student_parent_user_name: parentUser
          ? (parentUser.full_name || parentUser.name || "").trim() || undefined
          : undefined,
        student_parent_name: student?.parent_name || undefined,
        student_parent_phone: student?.parent_phone || undefined,
        student_father_name: student?.father_name || undefined,
        student_father_phone: student?.father_phone || undefined,
        student_mother_name: student?.mother_name || undefined,
        student_mother_phone: student?.mother_phone || undefined,
      };
    });

    return { success: true, data: enrollments };
  } catch (error) {
    console.error("[Enrollments] Fehler beim Laden:", error);
    return { success: false, error: "Einschreibungen konnten nicht geladen werden" };
  }
}

/**
 * Schüler in einen Kurs einschreiben.
 */
export async function enrollStudent(
  mosqueId: string,
  userId: string,
  input: EnrollmentInput
): Promise<ActionResult<CourseEnrollment>> {
  try {
    const validated = enrollmentSchema.parse(input);
    const pb = await getAdminPB();

    // Kurs-Zugehörigkeit prüfen
    const course = await pb.collection("courses").getOne(validated.course_id);
    if (course.mosque_id !== mosqueId) {
      return { success: false, error: "Kurs nicht gefunden" };
    }

    // Kapazität prüfen
    if (course.max_students > 0) {
      const enrollments = await pb.collection("course_enrollments").getList(1, 1, {
        filter: `course_id = "${validated.course_id}" && status = "enrolled"`,
        fields: "id",
      });
      if (enrollments.totalItems >= course.max_students) {
        return { success: false, error: "Kurs ist voll" };
      }
    }

    // Doppelte Einschreibung prüfen
    try {
      await pb.collection("course_enrollments").getFirstListItem(
        `course_id = "${validated.course_id}" && student_id = "${validated.student_id}" && status = "enrolled"`
      );
      return { success: false, error: "Schüler ist bereits in diesem Kurs eingeschrieben" };
    } catch {
      // Keine doppelte Einschreibung — gut
    }

    const record = await pb.collection("course_enrollments").create({
      mosque_id: mosqueId,
      course_id: validated.course_id,
      student_id: validated.student_id,
      status: "enrolled",
      enrolled_at: new Date().toISOString(),
      notes: validated.notes,
    });

    await logAudit({
      mosqueId,
      userId,
      action: "enrollment.created",
      entityType: "course_enrollment",
      entityId: record.id,
      details: { course_id: validated.course_id, student_id: validated.student_id },
    });

    return { success: true, data: mapRecordToEnrollment(record) };
  } catch (error) {
    console.error("[Enrollments] Fehler beim Einschreiben:", error);
    return { success: false, error: "Einschreibung fehlgeschlagen" };
  }
}

/**
 * Einschreibungsstatus ändern (z.B. abmelden, pausieren).
 */
export async function updateEnrollmentStatus(
  enrollmentId: string,
  mosqueId: string,
  userId: string,
  newStatus: "enrolled" | "completed" | "dropped" | "on_hold"
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();

    const existing = await pb.collection("course_enrollments").getOne(enrollmentId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Einschreibung nicht gefunden" };
    }

    const updateData: Record<string, string> = { status: newStatus };
    if (newStatus === "completed") {
      updateData.completed_at = new Date().toISOString();
    }

    await pb.collection("course_enrollments").update(enrollmentId, updateData);

    await logAudit({
      mosqueId,
      userId,
      action: `enrollment.${newStatus}`,
      entityType: "course_enrollment",
      entityId: enrollmentId,
      details: { course_id: existing.course_id, student_id: existing.student_id },
    });

    return { success: true };
  } catch (error) {
    console.error("[Enrollments] Fehler beim Aktualisieren:", error);
    return { success: false, error: "Status konnte nicht aktualisiert werden" };
  }
}

/**
 * Liefert alle Student-IDs die in einem Kurs eingeschrieben sind (Status: enrolled).
 * Wird für den Kurs-Filter auf der Gebühren-Seite verwendet.
 */
export async function getEnrolledStudentIds(
  courseId: string,
  mosqueId: string
): Promise<ActionResult<string[]>> {
  try {
    const pb = await getAdminPB();
    const course = await pb.collection("courses").getOne(courseId);
    if (course.mosque_id !== mosqueId) {
      return { success: false, error: "Kurs nicht gefunden" };
    }
    const records = await pb.collection("course_enrollments").getFullList({
      filter: `course_id = "${courseId}" && status = "enrolled"`,
      fields: "student_id",
    });
    return { success: true, data: records.map((r) => r.student_id as string) };
  } catch (error) {
    console.error("[Enrollments] Fehler beim Laden der Student-IDs:", error);
    return { success: false, error: "Student-IDs konnten nicht geladen werden" };
  }
}

/**
 * Alle verfügbaren Schüler einer Moschee laden (aus students Collection).
 */
export async function getStudentCandidates(
  mosqueId: string
): Promise<ActionResult<Student[]>> {
  try {
    const pb = await getAdminPB();

    const records = await pb.collection("students").getFullList({
      filter: `mosque_id = "${mosqueId}" && status = "active"`,
      sort: "first_name,last_name",
    });

    const students: Student[] = records.map((r) => ({
      id: r.id,
      mosque_id: r.mosque_id || "",
      first_name: r.first_name || "",
      last_name: r.last_name || "",
      date_of_birth: r.date_of_birth || "",
      gender: r.gender || "",
      parent_id: r.parent_id || "",
      parent_name: r.parent_name || "",
      parent_phone: r.parent_phone || "",
      address: r.address || "",
      school_name: r.school_name || "",
      school_class: r.school_class || "",
      health_notes: r.health_notes || "",
      mother_name: r.mother_name || "",
      mother_phone: r.mother_phone || "",
      father_name: r.father_name || "",
      father_phone: r.father_phone || "",
      membership_status: r.membership_status || "",
      notes: r.notes || "",
      status: r.status || "active",
      created: r.created || "",
      updated: r.updated || "",
    }));

    return { success: true, data: students };
  } catch (error) {
    console.error("[Enrollments] Fehler beim Laden der Schüler:", error);
    return { success: false, error: "Schüler konnten nicht geladen werden" };
  }
}
