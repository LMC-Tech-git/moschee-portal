"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { logAudit } from "@/lib/audit";
import type { Attendance } from "@/types";
import type { RecordModel } from "pocketbase";

// --- Helpers ---

function mapRecordToAttendance(record: RecordModel): Attendance {
  return {
    id: record.id,
    mosque_id: record.mosque_id || "",
    course_id: record.course_id || "",
    student_id: record.student_id || "",
    session_date: record.session_date || "",
    status: record.status || "absent",
    notes: record.notes || "",
    marked_by: record.marked_by || "",
    performance: record.performance != null ? (record.performance as 1 | 2 | 3 | 4 | 5) : undefined,
    created: record.created || "",
    updated: record.updated || "",
  };
}

// --- Server Actions ---

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Anwesenheit für eine Unterrichtsstunde laden.
 */
export async function getAttendanceBySession(
  courseId: string,
  sessionDate: string,
  mosqueId: string
): Promise<ActionResult<(Attendance & { student_name?: string })[]>> {
  try {
    const pb = await getAdminPB();

    // Kurs-Zugehörigkeit prüfen
    const course = await pb.collection("courses").getOne(courseId);
    if (course.mosque_id !== mosqueId) {
      return { success: false, error: "Kurs nicht gefunden" };
    }

    // ~ (contains) statt = weil PocketBase date-Felder als "YYYY-MM-DD 00:00:00.000Z" speichert
    const datePrefix = sessionDate.slice(0, 10);
    const records = await pb.collection("attendance").getFullList({
      filter: `course_id = "${courseId}" && session_date ~ "${datePrefix}"`,
      expand: "student_id",
      sort: "created",
    });

    const attendances = records.map((record) => {
      const att = mapRecordToAttendance(record);
      const student = record.expand?.student_id as RecordModel | undefined;
      return {
        ...att,
        student_name: student
          ? `${student.first_name || ""} ${student.last_name || ""}`.trim()
          : undefined,
      };
    });

    return { success: true, data: attendances };
  } catch (error) {
    console.error("[Attendance] Fehler beim Laden:", error);
    return { success: false, error: "Anwesenheit konnte nicht geladen werden" };
  }
}

/**
 * Anwesenheit für eine komplette Unterrichtsstunde eintragen / aktualisieren.
 * Erwartet ein Array aus { student_id, status, notes }.
 */
export async function saveAttendanceBulk(
  mosqueId: string,
  userId: string,
  courseId: string,
  sessionDate: string,
  entries: { student_id: string; status: "present" | "absent" | "late" | "excused"; notes?: string; performance?: number }[]
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();

    // Kurs-Zugehörigkeit prüfen
    const course = await pb.collection("courses").getOne(courseId);
    if (course.mosque_id !== mosqueId) {
      return { success: false, error: "Kurs nicht gefunden" };
    }

    // Bestehende Einträge für diese Session laden
    // ~ (contains) statt = weil PocketBase date-Felder als "YYYY-MM-DD 00:00:00.000Z" speichert
    const datePrefix = sessionDate.slice(0, 10);
    const existing = await pb.collection("attendance").getFullList({
      filter: `course_id = "${courseId}" && session_date ~ "${datePrefix}"`,
    });

    const existingMap: Record<string, RecordModel> = {};
    existing.forEach((record) => {
      existingMap[record.student_id] = record;
    });

    // Einträge erstellen oder aktualisieren
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const existingRecord = existingMap[entry.student_id];

      // Performance nur bei anwesend/verspätet sinnvoll; nicht schreiben wenn absent/excused
      const canHavePerformance = entry.status === "present" || entry.status === "late";
      // Validierung: 1–5 oder undefined
      if (entry.performance != null && (entry.performance < 1 || entry.performance > 5)) {
        return { success: false, error: "Ungültiger Leistungswert" };
      }
      const performanceValue = canHavePerformance && entry.performance != null ? entry.performance : null;

      if (existingRecord) {
        // Aktualisieren
        const updateData: Record<string, unknown> = {
          status: entry.status,
          notes: entry.notes || "",
          marked_by: userId,
        };
        // Performance nur setzen wenn explizit übergeben (null = löschen bei absent/excused)
        if (canHavePerformance && entry.performance != null) {
          updateData.performance = performanceValue;
        } else if (!canHavePerformance) {
          updateData.performance = null;
        }
        await pb.collection("attendance").update(existingRecord.id, updateData);
      } else {
        // Neu erstellen
        const createData: Record<string, unknown> = {
          mosque_id: mosqueId,
          course_id: courseId,
          student_id: entry.student_id,
          session_date: sessionDate,
          status: entry.status,
          notes: entry.notes || "",
          marked_by: userId,
        };
        if (performanceValue != null) createData.performance = performanceValue;
        await pb.collection("attendance").create(createData);
      }
    }

    await logAudit({
      mosqueId,
      userId,
      action: "attendance.saved",
      entityType: "attendance",
      entityId: courseId,
      details: { session_date: sessionDate, count: entries.length },
    });

    return { success: true };
  } catch (error) {
    console.error("[Attendance] Fehler beim Speichern:", error);
    return { success: false, error: "Anwesenheit konnte nicht gespeichert werden" };
  }
}

/**
 * Anwesenheitsstatistik eines Schülers für einen Kurs.
 */
export async function getStudentAttendanceStats(
  courseId: string,
  studentId: string,
  mosqueId: string
): Promise<ActionResult<{ total: number; present: number; absent: number; late: number; excused: number; rate: number }>> {
  try {
    const pb = await getAdminPB();

    const course = await pb.collection("courses").getOne(courseId);
    if (course.mosque_id !== mosqueId) {
      return { success: false, error: "Kurs nicht gefunden" };
    }

    const records = await pb.collection("attendance").getFullList({
      filter: `course_id = "${courseId}" && student_id = "${studentId}"`,
    });

    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    records.forEach((r) => {
      if (r.status === "present") present++;
      else if (r.status === "absent") absent++;
      else if (r.status === "late") late++;
      else if (r.status === "excused") excused++;
    });

    const total = records.length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return {
      success: true,
      data: { total, present, absent, late, excused, rate },
    };
  } catch (error) {
    console.error("[Attendance] Fehler bei Statistik:", error);
    return { success: false, error: "Statistik konnte nicht geladen werden" };
  }
}

// ─── Statistik-Typen (exportiert für Client-Components) ───────────────────────

export interface StudentAttendanceStat {
  student_id: string;
  student_name: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number; // (present + late) / total * 100
}

export interface SessionAttendanceStat {
  date: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number;
}

export interface CourseAttendanceStats {
  studentStats: StudentAttendanceStat[];
  sessionStats: SessionAttendanceStat[];
  totalSessions: number;
  enrolledCount: number;
  avgClassRate: number;
}

/**
 * Vollständige Anwesenheitsstatistik eines Kurses.
 * Aggregiert alle Einträge nach Schüler und nach Session.
 */
export async function getCourseAttendanceStats(
  courseId: string,
  mosqueId: string
): Promise<ActionResult<CourseAttendanceStats>> {
  try {
    const pb = await getAdminPB();

    const course = await pb.collection("courses").getOne(courseId);
    if (course.mosque_id !== mosqueId) {
      return { success: false, error: "Kurs nicht gefunden" };
    }

    // Aktuell eingeschriebene Schüler + deren Einschreibedatum laden
    const enrollments = await pb.collection("course_enrollments").getFullList({
      filter: `course_id = "${courseId}" && status = "enrolled"`,
      fields: "student_id,enrolled_at,created",
    });
    // Map: student_id → enrolled_at (normalisiert auf YYYY-MM-DD)
    const enrolledDateMap: Record<string, string> = {};
    enrollments.forEach((e) => {
      const enrolledAt = ((e.enrolled_at || e.created) as string).slice(0, 10);
      enrolledDateMap[e.student_id as string] = enrolledAt;
    });

    const allRecords = await pb.collection("attendance").getFullList({
      filter: `course_id = "${courseId}"`,
      expand: "student_id",
      sort: "session_date",
    });

    // Nur Records zählen, die NACH dem Einschreibedatum des jeweiligen Schülers liegen
    const records = allRecords.filter((r) => {
      const studentId = r.student_id as string;
      const enrolledDate = enrolledDateMap[studentId];
      if (!enrolledDate) return false; // Schüler nicht (mehr) eingeschrieben
      const sessionDate = (r.session_date as string).slice(0, 10);
      return sessionDate >= enrolledDate;
    });

    const studentMap: Record<string, StudentAttendanceStat> = {};
    const sessionMap: Record<string, SessionAttendanceStat> = {};

    records.forEach((record) => {
      const studentId = record.student_id as string;
      const sessionDate = record.session_date as string;
      const status = record.status as string;
      const student = record.expand?.student_id as RecordModel | undefined;
      const studentName = student
        ? `${student.first_name || ""} ${student.last_name || ""}`.trim()
        : studentId;

      // Per-Schüler aggregieren
      if (!studentMap[studentId]) {
        studentMap[studentId] = {
          student_id: studentId,
          student_name: studentName,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          rate: 0,
        };
      }
      const sStat = studentMap[studentId];
      sStat.total++;
      if (status === "present") sStat.present++;
      else if (status === "absent") sStat.absent++;
      else if (status === "late") sStat.late++;
      else if (status === "excused") sStat.excused++;

      // Per-Session aggregieren
      if (!sessionMap[sessionDate]) {
        sessionMap[sessionDate] = {
          date: sessionDate,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          rate: 0,
        };
      }
      const sessStat = sessionMap[sessionDate];
      sessStat.total++;
      if (status === "present") sessStat.present++;
      else if (status === "absent") sessStat.absent++;
      else if (status === "late") sessStat.late++;
      else if (status === "excused") sessStat.excused++;
    });

    // Raten berechnen
    const studentStats = Object.values(studentMap);
    studentStats.forEach((s) => {
      s.rate = s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 100) : 0;
    });
    studentStats.sort((a, b) => a.student_name.localeCompare(b.student_name, "de"));

    const sessionStats = Object.values(sessionMap);
    sessionStats.forEach((s) => {
      s.rate = s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 100) : 0;
    });
    sessionStats.sort((a, b) => b.date.localeCompare(a.date));

    const totalSessions = sessionStats.length;
    const avgClassRate =
      totalSessions > 0
        ? Math.round(
            sessionStats.reduce((sum, s) => sum + s.rate, 0) / totalSessions
          )
        : 0;

    return {
      success: true,
      data: {
        studentStats,
        sessionStats,
        totalSessions,
        enrolledCount: studentStats.length,
        avgClassRate,
      },
    };
  } catch (error) {
    console.error("[Attendance] Fehler bei Kurs-Statistik:", error);
    return { success: false, error: "Statistik konnte nicht geladen werden" };
  }
}

/**
 * Alle Anwesenheitseinträge einer Session löschen.
 */
export async function deleteAttendanceSession(
  courseId: string,
  sessionDate: string,
  mosqueId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();

    const course = await pb.collection("courses").getOne(courseId);
    if (course.mosque_id !== mosqueId) {
      return { success: false, error: "Kurs nicht gefunden" };
    }

    const datePrefix = sessionDate.slice(0, 10);
    const records = await pb.collection("attendance").getFullList({
      filter: `course_id = "${courseId}" && session_date ~ "${datePrefix}"`,
      fields: "id",
    });

    for (let i = 0; i < records.length; i++) {
      await pb.collection("attendance").delete(records[i].id);
    }

    await logAudit({
      mosqueId,
      userId,
      action: "attendance.session_deleted",
      entityType: "attendance",
      entityId: courseId,
      details: { session_date: datePrefix, deleted_count: records.length },
    });

    return { success: true };
  } catch (error) {
    console.error("[Attendance] Fehler beim Löschen der Session:", error);
    return { success: false, error: "Session konnte nicht gelöscht werden" };
  }
}

// ─── Eltern-Anwesenheitsübersicht ─────────────────────────────────────────────

export interface ChildCourseAttendanceSummary {
  courseId: string;
  courseName: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number; // (present + late) / total * 100
  todayStatus: "present" | "absent" | "late" | "excused" | null;
  lastPerformance?: number;
  avgPerformance?: number;
  performanceCount: number;
  trend?: "up" | "down" | "stable";
}

export interface ChildAttendanceOverview {
  studentId: string;
  studentName: string;
  courses: ChildCourseAttendanceSummary[]; // sortiert nach rate desc
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// Sortierung: session_date desc, dann created desc (neueste zuerst)
function sortByDateDesc(a: RecordModel, b: RecordModel): number {
  const dateA = (a.session_date as string) || "";
  const dateB = (b.session_date as string) || "";
  if (dateA !== dateB) return dateA > dateB ? -1 : 1;
  const creA = (a.created as string) || "";
  const creB = (b.created as string) || "";
  return creA > creB ? -1 : 1;
}

/**
 * Anwesenheitsübersicht aller Kinder eines Elternteils.
 * Liefert pro Kind eine Liste der eingeschriebenen Kurse mit aggregierten Stats
 * (letzte 6 Monate) sowie dem heutigen Anwesenheitsstatus und Leistungsdaten.
 */
export async function getParentAttendanceOverview(
  mosqueId: string,
  parentUserId: string
): Promise<ActionResult<ChildAttendanceOverview[]>> {
  try {
    const pb = await getAdminPB();

    // 1. Kinder des Elternteils — nutzt korrekte Dual-Source-Abfrage (Legacy + Junction Table)
    const { getChildrenOfParent } = await import("@/lib/actions/parent-child");
    const childrenResult = await getChildrenOfParent(mosqueId, parentUserId);
    if (!childrenResult.success) {
      return { success: false, error: childrenResult.error };
    }
    const studentsRecords = childrenResult.data ?? [];
    if (studentsRecords.length === 0) {
      return { success: true, data: [] };
    }

    const studentIds = studentsRecords.map((s) => s.id);
    const nameMap: Record<string, string> = {};
    studentsRecords.forEach((s) => {
      nameMap[s.id] = [s.first_name, s.last_name].filter(Boolean).join(" ") || "Unbekannt";
    });

    const buildOrFilter = (field: string, ids: string[]) =>
      ids.map((id) => `${field} = "${id}"`).join(" || ");

    // 2. Aktive Einschreibungen (mit Kursname)
    const enrollmentRecords = (
      await Promise.all(
        chunkArray(studentIds, 10).map((chunk) =>
          pb.collection("course_enrollments").getFullList({
            filter: `(${buildOrFilter("student_id", chunk)}) && status = "enrolled" && mosque_id = "${mosqueId}"`,
            expand: "course_id",
          })
        )
      )
    ).flat();

    // enrollmentMap: studentId → [{courseId, courseName}]
    const enrollmentMap: Record<string, { courseId: string; courseName: string }[]> = {};
    const enrolledSet = new Set<string>();
    enrollmentRecords.forEach((r) => {
      const sid = r.student_id as string;
      const cid = r.course_id as string;
      const course = r.expand?.course_id as RecordModel | undefined;
      const courseName = (course?.title as string) || cid;
      if (!enrollmentMap[sid]) enrollmentMap[sid] = [];
      enrollmentMap[sid].push({ courseId: cid, courseName });
      enrolledSet.add(`${sid}:${cid}`);
    });

    // 3. Attendance Stats + Performance (letzte 6 Monate, stabiles ISO-Datum)
    const fromDateStr = new Date(Date.now() - 1000 * 60 * 60 * 24 * 180)
      .toISOString()
      .slice(0, 10);

    const statsRecords = (
      await Promise.all(
        chunkArray(studentIds, 10).map((chunk) =>
          pb.collection("attendance").getFullList({
            filter: `mosque_id = "${mosqueId}" && (${buildOrFilter("student_id", chunk)}) && session_date >= "${fromDateStr}"`,
            fields: "id,student_id,course_id,status,performance,session_date,created",
          })
        )
      )
    ).flat();

    // 4. Heute-Status
    const today = new Date().toISOString().slice(0, 10);
    const todayRecords = (
      await Promise.all(
        chunkArray(studentIds, 10).map((chunk) =>
          pb.collection("attendance").getFullList({
            filter: `mosque_id = "${mosqueId}" && (${buildOrFilter("student_id", chunk)}) && session_date ~ "${today}"`,
            fields: "student_id,course_id,status,performance,session_date,created",
          })
        )
      )
    ).flat();

    // Gruppierung: "studentId:courseId" → Records (sortiert desc)
    const grouped = new Map<string, RecordModel[]>();
    statsRecords.forEach((r) => {
      const key = `${r.student_id}:${r.course_id}`;
      if (!enrolledSet.has(key)) return;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    });
    grouped.forEach((recs) => recs.sort(sortByDateDesc));

    // Today-Records nach (studentId, courseId) gruppieren, neueste zuerst
    const todayGrouped = new Map<string, RecordModel[]>();
    todayRecords.forEach((r) => {
      const key = `${r.student_id}:${r.course_id}`;
      if (!todayGrouped.has(key)) todayGrouped.set(key, []);
      todayGrouped.get(key)!.push(r);
    });
    todayGrouped.forEach((recs) => recs.sort(sortByDateDesc));

    // Ergebnis zusammenstellen
    const result: ChildAttendanceOverview[] = studentIds.map((sid) => {
      const courses = (enrollmentMap[sid] || []).map(({ courseId, courseName }) => {
        const key = `${sid}:${courseId}`;
        const recs = grouped.get(key) ?? [];

        // Anwesenheits-Aggregation
        let present = 0, absent = 0, late = 0, excused = 0;
        recs.forEach((r) => {
          if (r.status === "present") present++;
          else if (r.status === "absent") absent++;
          else if (r.status === "late") late++;
          else if (r.status === "excused") excused++;
        });
        const total = present + absent + late + excused;
        const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

        // Heute-Status (neueste Session des Tages)
        const todayRec = (todayGrouped.get(key) ?? [])[0];
        const todayStatusRaw = todayRec?.status as string | undefined;
        const todayStatus: "present" | "absent" | "late" | "excused" | null =
          todayStatusRaw === "present" || todayStatusRaw === "absent" ||
          todayStatusRaw === "late" || todayStatusRaw === "excused"
            ? (todayStatusRaw as "present" | "absent" | "late" | "excused")
            : null;

        // Performance-Aggregation (nur Records mit Wert)
        const withPerf = recs.filter((r) => r.performance != null);
        const lastPerformance = withPerf[0]?.performance as number | undefined;
        const performanceCount = withPerf.length;
        const avgPerformance =
          performanceCount > 0
            ? Number(
                (withPerf.reduce((s, r) => s + (r.performance as number), 0) / performanceCount).toFixed(1)
              )
            : undefined;
        // Trend: letzte 3 Bewertungen (DESC → slice(0,3) = neueste 3)
        const last3 = withPerf.slice(0, 3).map((r) => r.performance as number);
        const trend: "up" | "down" | "stable" | undefined =
          last3.length >= 2
            ? last3[0] > last3[last3.length - 1]
              ? "up"
              : last3[0] < last3[last3.length - 1]
              ? "down"
              : "stable"
            : undefined;

        return {
          courseId,
          courseName,
          total, present, absent, late, excused,
          rate,
          todayStatus,
          lastPerformance,
          avgPerformance,
          performanceCount,
          trend,
        };
      });
      // Kurse nach Rate absteigend sortieren
      courses.sort((a, b) => b.rate - a.rate);
      return {
        studentId: sid,
        studentName: nameMap[sid] || sid,
        courses,
      };
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("[Attendance] Fehler bei Eltern-Übersicht:", error);
    return { success: false, error: "Anwesenheitsübersicht konnte nicht geladen werden" };
  }
}

/**
 * Alle Sessions (Daten) eines Kurses laden.
 */
export async function getCourseSessions(
  courseId: string,
  mosqueId: string
): Promise<ActionResult<string[]>> {
  try {
    const pb = await getAdminPB();

    const course = await pb.collection("courses").getOne(courseId);
    if (course.mosque_id !== mosqueId) {
      return { success: false, error: "Kurs nicht gefunden" };
    }

    const records = await pb.collection("attendance").getFullList({
      filter: `course_id = "${courseId}"`,
      fields: "session_date",
      sort: "-session_date",
    });

    // Unique session dates — nur die ersten 10 Zeichen (YYYY-MM-DD), da PocketBase
    // date-Felder als "YYYY-MM-DD 00:00:00.000Z" zurückgeben kann
    const dateSet = new Set<string>();
    records.forEach((r) => {
      if (r.session_date) dateSet.add((r.session_date as string).slice(0, 10));
    });

    return { success: true, data: Array.from(dateSet) };
  } catch (error) {
    console.error("[Attendance] Fehler beim Laden:", error);
    return { success: false, error: "Sessions konnten nicht geladen werden" };
  }
}
