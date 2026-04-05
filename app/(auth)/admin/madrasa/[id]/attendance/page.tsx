"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft, ClipboardList, Save, Check, X, Clock, AlertCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import { getCourseById } from "@/lib/actions/courses";
import { getEnrollmentsByCourse } from "@/lib/actions/enrollments";
import {
  getAttendanceBySession,
  saveAttendanceBulk,
  getCourseSessions,
  getCourseAttendanceStats,
  deleteAttendanceSession,
  type CourseAttendanceStats,
} from "@/lib/actions/attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  attendanceStatusLabels,
  attendanceStatusColors,
  dayOfWeekLabels,
  PERFORMANCE_LEVELS,
  getPerformanceLevel,
} from "@/lib/constants";
import type { Course, CourseEnrollment, Attendance } from "@/types";
import AttendanceStats from "@/components/madrasa/AttendanceStats";
import { DemoHint } from "@/components/demo/DemoHint";

type AttendanceStatus = "present" | "absent" | "late" | "excused";

interface StudentRow {
  student_id: string;
  student_name: string;
  status: AttendanceStatus;
  notes: string;
  performance?: number;
}

export default function AttendancePage() {
  const params = useParams();
  const courseId = params.id as string;
  const { mosqueId } = useMosque();
  const { user } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [sessionDate, setSessionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [pastSessions, setPastSessions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Statistik
  const [courseStats, setCourseStats] = useState<CourseAttendanceStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Session löschen
  const [deletingSession, setDeletingSession] = useState<string | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  // Performance-Rating Popover
  const [openRatingFor, setOpenRatingFor] = useState<string | null>(null);

  // Kurs + Sessions laden
  useEffect(() => {
    if (!mosqueId || !courseId) return;

    async function loadCourse() {
      const [result, sessionsResult] = await Promise.all([
        getCourseById(courseId, mosqueId),
        getCourseSessions(courseId, mosqueId),
      ]);
      if (result.success && result.data) {
        setCourse(result.data);
      }
      if (sessionsResult.success && sessionsResult.data) {
        setPastSessions(sessionsResult.data);
      }
      setIsLoading(false);
    }
    loadCourse();
  }, [mosqueId, courseId]);

  // Schüler + Anwesenheit für gewähltes Datum laden
  useEffect(() => {
    if (!mosqueId || !courseId || !sessionDate) return;

    async function loadAttendance() {
      const enrollResult = await getEnrollmentsByCourse(courseId, mosqueId);
      // Nur Schüler zeigen, die zum Zeitpunkt der Session bereits eingeschrieben waren
      const enrolledStudents = (enrollResult.data || []).filter(
        (e) => e.status === "enrolled" && e.enrolled_at.slice(0, 10) <= sessionDate
      ) as (CourseEnrollment & { student_name?: string })[];

      const attResult = await getAttendanceBySession(courseId, sessionDate, mosqueId);
      const existingAtt = attResult.data || [];

      const attMap: Record<string, Attendance & { student_name?: string }> = {};
      existingAtt.forEach((a) => {
        attMap[a.student_id] = a;
      });

      const rows: StudentRow[] = enrolledStudents.map((e) => {
        const existing = attMap[e.student_id];
        return {
          student_id: e.student_id,
          student_name: e.student_name || e.student_id,
          status: existing ? existing.status : "present",
          notes: existing?.notes || "",
          performance: existing?.performance ?? undefined,
        };
      });

      setStudents(rows);
    }
    loadAttendance();
  }, [mosqueId, courseId, sessionDate]);

  const loadStats = useCallback(async () => {
    if (!mosqueId || !courseId) return;
    setIsLoadingStats(true);
    const result = await getCourseAttendanceStats(courseId, mosqueId);
    if (result.success && result.data) {
      setCourseStats(result.data);
    }
    setIsLoadingStats(false);
  }, [mosqueId, courseId]);

  function handleTabChange(value: string) {
    if (value === "stats" && !courseStats && !isLoadingStats) {
      loadStats();
    }
  }

  function setStudentStatus(studentId: string, status: AttendanceStatus) {
    setStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, status } : s))
    );
  }

  function setStudentPerformance(studentId: string, value: number | undefined) {
    setStudents((prev) =>
      prev.map((s) => (s.student_id === studentId ? { ...s, performance: value } : s))
    );
    setOpenRatingFor(null);
  }

  async function handleSave() {
    if (!user) return;
    setIsSaving(true);
    setError("");
    setSuccess("");

    const entries = students.map((s) => ({
      student_id: s.student_id,
      status: s.status,
      notes: s.notes,
      performance: s.performance,
    }));

    const result = await saveAttendanceBulk(
      mosqueId,
      user.id,
      courseId,
      sessionDate,
      entries
    );

    if (result.success) {
      setSuccess("Anwesenheit gespeichert!");
      setTimeout(() => setSuccess(""), 3000);
      if (!pastSessions.includes(sessionDate)) {
        setPastSessions((prev) => [sessionDate, ...prev]);
      }
      // Statistik invalidieren, damit sie beim nächsten Tab-Wechsel neu geladen wird
      setCourseStats(null);
    } else {
      setError(result.error || "Speichern fehlgeschlagen");
    }
    setIsSaving(false);
  }

  async function handleDeleteSession(date: string) {
    if (!user) return;
    setIsDeletingSession(true);
    const result = await deleteAttendanceSession(courseId, date, mosqueId, user.id);
    if (result.success) {
      setPastSessions((prev) => prev.filter((d) => d !== date));
      if (sessionDate === date) {
        setSessionDate(new Date().toISOString().slice(0, 10));
        setStudents([]);
      }
      setCourseStats(null);
    } else {
      setError(result.error || "Session konnte nicht gelöscht werden");
    }
    setDeletingSession(null);
    setIsDeletingSession(false);
  }

  function markAllAs(status: AttendanceStatus) {
    setStudents((prev) => prev.map((s) => ({ ...s, status })));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600 motion-reduce:animate-none" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">Kurs nicht gefunden</p>
        <Link
          href="/admin/madrasa"
          className="mt-3 inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück zur Madrasa
        </Link>
      </div>
    );
  }

  const statusButtons: { status: AttendanceStatus; icon: typeof Check; label: string; color: string }[] = [
    { status: "present", icon: Check, label: "Anwesend", color: "text-emerald-600 hover:bg-emerald-50 border-emerald-200" },
    { status: "late", icon: Clock, label: "Verspätet", color: "text-amber-600 hover:bg-amber-50 border-amber-200" },
    { status: "absent", icon: X, label: "Abwesend", color: "text-red-600 hover:bg-red-50 border-red-200" },
    { status: "excused", icon: AlertCircle, label: "Entschuldigt", color: "text-blue-600 hover:bg-blue-50 border-blue-200" },
  ];

  return (
    <div className="space-y-6">
      <DemoHint
        id="madrasa-attendance"
        title="Anwesenheit erfassen"
        description="Wählen Sie ein Datum, markieren Sie für jeden Schüler den Status (Anwesend / Entschuldigt / Unentschuldigt) und klicken Sie auf ‚Speichern'."
      />
      {/* Header */}
      <div>
        <Link
          href={`/admin/madrasa/${courseId}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück zum Kurs
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <ClipboardList className="h-6 w-6 text-emerald-600" />
          Anwesenheit — {course.title}
        </h1>
        <p className="text-sm text-gray-500">
          {dayOfWeekLabels[course.day_of_week]}, {course.start_time}
          {course.end_time ? `–${course.end_time}` : ""}
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="attendance" onValueChange={handleTabChange}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="attendance" className="flex-1 sm:flex-none">Anwesenheit</TabsTrigger>
          <TabsTrigger value="stats" className="flex-1 sm:flex-none">
            Statistik
            {pastSessions.length > 0 && (
              <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                {pastSessions.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Anwesenheit ── */}
        <TabsContent value="attendance" className="mt-4 space-y-4">
          {/* Datum-Auswahl */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="session_date">Datum der Unterrichtsstunde</Label>
                  <Input
                    id="session_date"
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                  />
                </div>

                {pastSessions.length > 0 && (
                  <div className="space-y-2">
                    <Label>Vergangene Sessions</Label>
                    <div className="flex flex-wrap gap-1">
                      {pastSessions.slice(0, 10).map((date) => (
                        deletingSession === date ? (
                          <span key={date} className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-1 text-xs">
                            <span className="text-red-700">Löschen?</span>
                            <button
                              type="button"
                              disabled={isDeletingSession}
                              onClick={() => handleDeleteSession(date)}
                              className="font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              Ja
                            </button>
                            <span className="text-red-300">|</span>
                            <button
                              type="button"
                              onClick={() => setDeletingSession(null)}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              Nein
                            </button>
                          </span>
                        ) : (
                          <span key={date} className="inline-flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => setSessionDate(date)}
                              className={cn(
                                "rounded-l-full px-2.5 py-1 text-xs font-medium transition-colors",
                                sessionDate === date
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              )}
                            >
                              {new Date(date).toLocaleDateString("de-DE", {
                                day: "2-digit",
                                month: "2-digit",
                              })}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingSession(date)}
                              title="Session löschen"
                              className={cn(
                                "rounded-r-full px-1.5 py-1 text-xs transition-colors",
                                sessionDate === date
                                  ? "bg-emerald-100 text-emerald-500 hover:bg-red-100 hover:text-red-600"
                                  : "bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600"
                              )}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </span>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Schnellaktionen */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => markAllAs("present")}
              variant="outline"
              className="gap-2 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            >
              <Check className="h-4 w-4" />
              Alle anwesend
            </Button>
            <div className="h-6 w-px bg-gray-200" />
            <span className="text-xs text-gray-400">oder:</span>
            {statusButtons.filter((sb) => sb.status !== "present").map((sb) => (
              <button
                key={sb.status}
                type="button"
                onClick={() => markAllAs(sb.status)}
                className={cn("rounded-full border px-3 py-1 text-xs font-medium", sb.color)}
              >
                Alle {sb.label.toLowerCase()}
              </button>
            ))}
          </div>

          {/* Feedback */}
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          {/* Schüler-Liste */}
          <Card>
            <CardContent className="p-0">
              {students.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  Keine eingeschriebenen Schüler in diesem Kurs.
                </div>
              ) : (
                <div className="divide-y">
                  {students.map((student) => (
                    <div
                      key={student.student_id}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="text-sm font-medium text-gray-900">
                        {student.student_name}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {statusButtons.map((sb) => {
                            const Icon = sb.icon;
                            const isActive = student.status === sb.status;
                            return (
                              <button
                                key={sb.status}
                                type="button"
                                onClick={() => setStudentStatus(student.student_id, sb.status)}
                                title={sb.label}
                                aria-label={`${student.student_name} als ${sb.label} markieren`}
                                className={cn(
                                  "rounded-lg border p-2 text-xs font-medium transition-colors",
                                  isActive
                                    ? attendanceStatusColors[sb.status] + " border-current"
                                    : "border-gray-200 text-gray-400 hover:text-gray-600"
                                )}
                              >
                                <Icon className="h-4 w-4" />
                              </button>
                            );
                          })}
                        </div>
                        {(student.status === "present" || student.status === "late") && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenRatingFor(
                                  openRatingFor === student.student_id ? null : student.student_id
                                )
                              }
                              className={cn(
                                "rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors",
                                student.performance
                                  ? getPerformanceLevel(student.performance)?.color + " border-current"
                                  : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
                              )}
                            >
                              {student.performance
                                ? `${getPerformanceLevel(student.performance)?.icon} ${getPerformanceLevel(student.performance)?.shortLabel} ✎`
                                : "Bewerten"}
                            </button>
                            {openRatingFor === student.student_id && (
                              <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setOpenRatingFor(null)}
                              />
                              <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                                <p className="mb-2 text-xs font-medium text-gray-500">Leistung:</p>
                                {PERFORMANCE_LEVELS.map((level) => (
                                  <button
                                    key={level.value}
                                    type="button"
                                    onClick={() =>
                                      setStudentPerformance(student.student_id, level.value)
                                    }
                                    className={cn(
                                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-gray-50",
                                      student.performance === level.value
                                        ? level.color + " font-medium"
                                        : "text-gray-700"
                                    )}
                                  >
                                    <span className="text-base">{level.icon}</span>
                                    <span>{level.shortLabel}</span>
                                    {student.performance === level.value && (
                                      <Check className="ml-auto h-3.5 w-3.5" />
                                    )}
                                  </button>
                                ))}
                                {student.performance != null && (
                                  <>
                                    <div className="my-1.5 border-t border-gray-100" />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setStudentPerformance(student.student_id, undefined)
                                      }
                                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-50"
                                    >
                                      Nicht bewertet
                                    </button>
                                  </>
                                )}
                              </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Speichern */}
          {students.length > 0 && (
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? "Wird gespeichert…" : "Anwesenheit speichern"}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ── Statistik ── */}
        <TabsContent value="stats" className="mt-4">
          <AttendanceStats stats={courseStats} isLoading={isLoadingStats} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
