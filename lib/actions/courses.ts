"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { courseSchema, type CourseInput } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import type { Course, CourseWithStats, User } from "@/types";
import type { RecordModel } from "pocketbase";

// --- Helpers ---

function mapRecordToCourse(record: RecordModel): Course {
  return {
    id: record.id,
    mosque_id: record.mosque_id || "",
    academic_year_id: record.academic_year_id || "",
    title: record.title || "",
    description: record.description || "",
    category: record.category || "other",
    level: record.level || "mixed",
    teacher_id: record.teacher_id || "",
    day_of_week: record.day_of_week || "monday",
    start_time: record.start_time || "",
    end_time: record.end_time || "",
    location_name: record.location_name || "",
    max_students: record.max_students || 0,
    status: record.status || "active",
    created_by: record.created_by || "",
    created: record.created || "",
    updated: record.updated || "",
    expand: record.expand ? {
      teacher_id: record.expand.teacher_id || undefined,
      created_by: record.expand.created_by || undefined,
      academic_year_id: record.expand.academic_year_id || undefined,
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
 * Alle Kurse einer Moschee laden (Admin), optional gefiltert nach Schuljahr.
 */
export async function getCoursesByMosque(
  mosqueId: string,
  options?: {
    status?: "active" | "paused" | "archived";
    academicYearId?: string;
    page?: number;
    limit?: number;
  }
): Promise<ActionResult<CourseWithStats[]> & { totalPages?: number; page?: number }> {
  try {
    const pb = await getAdminPB();
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    let filter = `mosque_id = "${mosqueId}"`;
    if (options?.status) {
      filter += ` && status = "${options.status}"`;
    }
    if (options?.academicYearId) {
      filter += ` && academic_year_id = "${options.academicYearId}"`;
    }

    const records = await pb.collection("courses").getList(page, limit, {
      filter,
      sort: "-created",
      expand: "teacher_id,academic_year_id",
    });

    // Enrolled counts für alle Kurse laden
    const courses: CourseWithStats[] = [];
    for (let i = 0; i < records.items.length; i++) {
      const record = records.items[i];
      const course = mapRecordToCourse(record);

      let enrolledCount = 0;
      try {
        const enrollments = await pb.collection("course_enrollments").getList(1, 1, {
          filter: `course_id = "${record.id}" && status = "enrolled"`,
          fields: "id",
        });
        enrolledCount = enrollments.totalItems;
      } catch {
        // ignore
      }

      const teacher = record.expand?.teacher_id as RecordModel | undefined;
      courses.push({
        ...course,
        enrolled_count: enrolledCount,
        teacher_name: teacher
          ? `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim()
          : undefined,
      });
    }

    return {
      success: true,
      data: courses,
      totalPages: records.totalPages,
      page: records.page,
    };
  } catch (error) {
    console.error("[Courses] Fehler beim Laden:", error);
    return { success: false, error: "Kurse konnten nicht geladen werden" };
  }
}

/**
 * Kurse eines Lehrers laden (Lehrer-Ansicht).
 */
export async function getCoursesByTeacher(
  mosqueId: string,
  teacherId: string,
  academicYearId?: string
): Promise<ActionResult<CourseWithStats[]>> {
  try {
    const pb = await getAdminPB();

    let filter = `mosque_id = "${mosqueId}" && teacher_id = "${teacherId}" && status = "active"`;
    if (academicYearId) {
      filter += ` && academic_year_id = "${academicYearId}"`;
    }

    const records = await pb.collection("courses").getFullList({
      filter,
      sort: "day_of_week,start_time",
      expand: "academic_year_id",
    });

    const courses: CourseWithStats[] = [];
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const course = mapRecordToCourse(record);

      let enrolledCount = 0;
      try {
        const enrollments = await pb.collection("course_enrollments").getList(1, 1, {
          filter: `course_id = "${record.id}" && status = "enrolled"`,
          fields: "id",
        });
        enrolledCount = enrollments.totalItems;
      } catch {
        // ignore
      }

      courses.push({
        ...course,
        enrolled_count: enrolledCount,
        teacher_name: undefined,
      });
    }

    return { success: true, data: courses };
  } catch (error) {
    console.error("[Courses] Fehler beim Laden:", error);
    return { success: false, error: "Kurse konnten nicht geladen werden" };
  }
}

/**
 * Einzelnen Kurs laden.
 */
export async function getCourseById(
  courseId: string,
  mosqueId: string
): Promise<ActionResult<CourseWithStats>> {
  try {
    const pb = await getAdminPB();
    const record = await pb.collection("courses").getOne(courseId, {
      expand: "teacher_id,academic_year_id",
    });

    if (record.mosque_id !== mosqueId) {
      return { success: false, error: "Kurs nicht gefunden" };
    }

    const course = mapRecordToCourse(record);

    let enrolledCount = 0;
    try {
      const enrollments = await pb.collection("course_enrollments").getList(1, 1, {
        filter: `course_id = "${courseId}" && status = "enrolled"`,
        fields: "id",
      });
      enrolledCount = enrollments.totalItems;
    } catch {
      // ignore
    }

    const teacher = record.expand?.teacher_id as RecordModel | undefined;

    return {
      success: true,
      data: {
        ...course,
        enrolled_count: enrolledCount,
        teacher_name: teacher
          ? `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim()
          : undefined,
      },
    };
  } catch (error) {
    console.error("[Courses] Fehler beim Laden:", error);
    return { success: false, error: "Kurs konnte nicht geladen werden" };
  }
}

/**
 * Neuen Kurs erstellen.
 */
export async function createCourse(
  mosqueId: string,
  userId: string,
  input: CourseInput
): Promise<ActionResult<Course>> {
  try {
    const validated = courseSchema.parse(input);
    const pb = await getAdminPB();

    const record = await pb.collection("courses").create({
      ...validated,
      mosque_id: mosqueId,
      created_by: userId,
    });

    await logAudit({
      mosqueId,
      userId,
      action: "course.created",
      entityType: "course",
      entityId: record.id,
      details: { title: validated.title },
    });

    return { success: true, data: mapRecordToCourse(record) };
  } catch (error) {
    console.error("[Courses] Fehler beim Erstellen:", error);
    return { success: false, error: "Kurs konnte nicht erstellt werden" };
  }
}

/**
 * Kurs aktualisieren.
 */
export async function updateCourse(
  courseId: string,
  mosqueId: string,
  userId: string,
  input: CourseInput
): Promise<ActionResult<Course>> {
  try {
    const validated = courseSchema.parse(input);
    const pb = await getAdminPB();

    const existing = await pb.collection("courses").getOne(courseId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Kurs nicht gefunden" };
    }

    const record = await pb.collection("courses").update(courseId, validated);

    await logAudit({
      mosqueId,
      userId,
      action: "course.updated",
      entityType: "course",
      entityId: courseId,
      details: { title: validated.title },
    });

    return { success: true, data: mapRecordToCourse(record) };
  } catch (error) {
    console.error("[Courses] Fehler beim Aktualisieren:", error);
    return { success: false, error: "Kurs konnte nicht aktualisiert werden" };
  }
}

/**
 * Kurs löschen.
 */
export async function deleteCourse(
  courseId: string,
  mosqueId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();

    const existing = await pb.collection("courses").getOne(courseId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Kurs nicht gefunden" };
    }

    await pb.collection("courses").delete(courseId);

    await logAudit({
      mosqueId,
      userId,
      action: "course.deleted",
      entityType: "course",
      entityId: courseId,
      details: { title: existing.title },
    });

    return { success: true };
  } catch (error) {
    console.error("[Courses] Fehler beim Löschen:", error);
    return { success: false, error: "Kurs konnte nicht gelöscht werden" };
  }
}

/**
 * Alle Lehrer einer Moschee laden (für Dropdown).
 */
export async function getTeachersByMosque(
  mosqueId: string
): Promise<ActionResult<User[]>> {
  try {
    const pb = await getAdminPB();

    const records = await pb.collection("users").getFullList({
      filter: `mosque_id = "${mosqueId}" && role = "teacher" && status = "active"`,
      sort: "first_name",
    });

    const teachers: User[] = records.map((r) => ({
      id: r.id,
      mosque_id: r.mosque_id || "",
      email: r.email || "",
      first_name: r.first_name || "",
      last_name: r.last_name || "",
      full_name: `${r.first_name || ""} ${r.last_name || ""}`.trim(),
      phone: r.phone || "",
      member_no: r.member_no || "",
      membership_number: r.membership_number || r.member_no || "",
      status: r.status || "active",
      role: r.role || "teacher",
      created: r.created || "",
      updated: r.updated || "",
    }));

    return { success: true, data: teachers };
  } catch (error) {
    console.error("[Courses] Fehler beim Laden der Lehrer:", error);
    return { success: false, error: "Lehrer konnten nicht geladen werden" };
  }
}
