"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Search, Plus, Upload, UserCheck, UserX, Baby, CheckSquare, Square, X, ChevronLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import { getStudentsByMosque, updateStudent } from "@/lib/actions/students";
import { getStudentEnrollmentsMap, enrollStudent } from "@/lib/actions/enrollments";
import { getCoursesByMosque } from "@/lib/actions/courses";
import { AdminStudentDialog } from "@/components/madrasa/AdminStudentDialog";
import { StudentImportDialog } from "@/components/madrasa/StudentImportDialog";
import type { Student } from "@/types";
import type { StudentInput } from "@/lib/validations";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Course {
  id: string;
  title: string;
}

export default function AdminStudentsPage() {
  const t = useTranslations("adminStudents");
  const tAdmin = useTranslations("adminStudent");
  const tL = useTranslations("labels");
  const locale = useLocale();
  const { mosqueId } = useMosque();
  const { user } = useAuth();

  const [students, setStudents] = useState<Student[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [enrollmentMap, setEnrollmentMap] = useState<Record<string, { courseId: string; courseName: string }[]>>({});
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [classFilter, setClassFilter] = useState("all");
  const [noEnrollmentFilter, setNoEnrollmentFilter] = useState(false);

  // Selection + bulk enrollment
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCourseId, setBulkCourseId] = useState("");
  const [bulkEnrolling, setBulkEnrolling] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  // Dialogs
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const intlLocale = locale === "tr" ? "tr-TR" : "de-DE";

  async function loadAll() {
    if (!mosqueId) return;
    setIsLoading(true);
    const [studentsRes, enrollmentsRes, coursesRes] = await Promise.all([
      getStudentsByMosque(mosqueId, true), // load all to handle inactive toggle client-side
      getStudentEnrollmentsMap(mosqueId),
      getCoursesByMosque(mosqueId, { status: "active", limit: 200 }),
    ]);
    if (studentsRes.success && studentsRes.data) setStudents(studentsRes.data);
    if (enrollmentsRes.success && enrollmentsRes.data) {
      setEnrollmentMap(enrollmentsRes.data);
      setEnrolledIds(new Set(Object.keys(enrollmentsRes.data)));
    }
    if (coursesRes.success && coursesRes.data) {
      setCourses(coursesRes.data.map((c) => ({ id: c.id, title: c.title })));
    }
    setIsLoading(false);
  }

  useEffect(() => {
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mosqueId]);

  // Unique class values from students
  const classOptions = useMemo(() => {
    const classes = new Set(students.map((s) => s.school_class).filter(Boolean));
    return Array.from(classes).sort();
  }, [students]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = students;

    if (statusFilter !== "all") list = list.filter((s) => s.status === statusFilter);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.first_name.toLowerCase().includes(q) ||
          s.last_name.toLowerCase().includes(q) ||
          (s.parent_name || "").toLowerCase().includes(q) ||
          (s.mother_name || "").toLowerCase().includes(q) ||
          (s.father_name || "").toLowerCase().includes(q)
      );
    }

    if (classFilter !== "all") {
      list = list.filter((s) => s.school_class === classFilter);
    }

    if (noEnrollmentFilter) {
      list = list.filter((s) => !enrolledIds.has(s.id));
    }

    return list;
  }, [students, statusFilter, search, classFilter, noEnrollmentFilter, enrolledIds]);

  // Selection helpers
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((s) => s.id)));
    }
  }

  async function handleBulkEnroll() {
    if (!bulkCourseId || !user || selectedIds.size === 0) return;
    setBulkEnrolling(true);
    setBulkResult(null);
    let enrolled = 0;
    let skipped = 0;
    const ids = Array.from(selectedIds);
    await Promise.all(
      ids.map(async (studentId) => {
        const res = await enrollStudent(mosqueId, user.id, {
          course_id: bulkCourseId,
          student_id: studentId,
          status: "enrolled",
          notes: "",
        });
        if (res.success) enrolled++;
        else skipped++; // already enrolled or error
      })
    );
    setBulkEnrolling(false);
    setSelectedIds(new Set());
    setBulkCourseId("");
    setBulkResult(t("bulkPartial", { enrolled, skipped }));
    await loadAll();
    setTimeout(() => setBulkResult(null), 4000);
  }

  async function handleToggleStatus(student: Student) {
    if (!mosqueId || !user) return;
    const newStatus = student.status === "active" ? "inactive" : "active";
    const input: StudentInput = {
      first_name: student.first_name,
      last_name: student.last_name,
      date_of_birth: student.date_of_birth,
      gender: (student.gender as "male" | "female" | "") || "",
      parent_id: student.parent_id || "",
      parent_name: student.parent_name || "",
      parent_phone: student.parent_phone || "",
      address: student.address || "",
      school_name: student.school_name || "",
      school_class: student.school_class || "",
      health_notes: student.health_notes || "",
      mother_name: student.mother_name || "",
      mother_phone: student.mother_phone || "",
      father_name: student.father_name || "",
      father_phone: student.father_phone || "",
      membership_status: (student.membership_status as "active" | "none" | "planned" | "") || "",
      last_year_attended: student.last_year_attended ?? false,
      last_year_teacher: student.last_year_teacher || "",
      whatsapp_contact: (student.whatsapp_contact as "mother" | "father" | "both" | "") || "",
      parent_is_member: student.parent_is_member ?? false,
      father_user_id: student.father_user_id || "",
      mother_user_id: student.mother_user_id || "",
      notes: student.notes || "",
      status: newStatus,
    };
    await updateStudent(student.id, mosqueId, user.id, input);
    await loadAll();
  }

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setImportDialogOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Upload className="h-4 w-4" />
            <span>{t("importButton")}</span>
          </button>
          <button
            onClick={() => setCreateDialogOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>{t("addButton")}</span>
          </button>
          <Link
            href="/admin/madrasa"
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("backLink")}
          </Link>
        </div>
      </div>

      {/* Filter-Bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Class filter */}
        <select
          className="rounded-lg border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="all">{t("allClasses")}</option>
          {classOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
          <input
            type="checkbox"
            checked={noEnrollmentFilter}
            onChange={(e) => setNoEnrollmentFilter(e.target.checked)}
            className="accent-emerald-600"
          />
          {t("noEnrollment")}
        </label>

        <select
          className="rounded-lg border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "active" | "inactive" | "all")}
        >
          <option value="active">{t("statusActive")}</option>
          <option value="inactive">{t("statusInactive")}</option>
          <option value="all">{t("statusAll")}</option>
        </select>

        <span className="text-sm text-gray-400 whitespace-nowrap">
          {filtered.length} / {statusFilter === "all" ? students.length : students.filter((s) => s.status === statusFilter).length}
        </span>
      </div>

      {/* Bulk result */}
      {bulkResult && (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 flex items-center justify-between">
          {bulkResult}
          <button onClick={() => setBulkResult(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Bulk enrollment action bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <span className="text-sm font-medium text-emerald-800">
            {t("bulkSelected", { count: selectedIds.size })}
          </span>
          <div className="flex flex-1 gap-2 flex-wrap">
            <select
              className="flex-1 min-w-40 rounded-lg border border-emerald-300 bg-white py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={bulkCourseId}
              onChange={(e) => setBulkCourseId(e.target.value)}
            >
              <option value="">{t("bulkCourseSelect")}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <button
              disabled={!bulkCourseId || bulkEnrolling}
              onClick={handleBulkEnroll}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {bulkEnrolling ? "..." : t("bulkEnrollButton")}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tabelle */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          <Baby className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          {t("noStudents")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-3 py-3 text-center w-10">
                  <button
                    onClick={toggleSelectAll}
                    className="text-gray-400 hover:text-gray-600"
                    title={allSelected ? t("deselectAll") : t("selectAll")}
                  >
                    {allSelected ? (
                      <CheckSquare className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">{t("columns.name")}</th>
                <th className="hidden px-4 py-3 text-left sm:table-cell">{t("columns.school")}</th>
                <th className="hidden px-4 py-3 text-left lg:table-cell">{t("columns.course")}</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">{t("columns.parent")}</th>
                <th className="px-4 py-3 text-left">{t("columns.status")}</th>
                <th className="px-4 py-3 text-right">{t("columns.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((student) => {
                const isSelected = selectedIds.has(student.id);
                const hasEnrollment = enrolledIds.has(student.id);
                const parentDisplay = student.mother_name && student.father_name
                  ? `${student.mother_name} / ${student.father_name}`
                  : student.mother_name || student.father_name || student.parent_name || "—";
                return (
                  <tr
                    key={student.id}
                    onClick={() => { setEditStudent(student); setEditDialogOpen(true); }}
                    className={cn(
                      "hover:bg-gray-50 transition-colors cursor-pointer",
                      isSelected && "bg-emerald-50"
                    )}
                  >
                    <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleSelect(student.id)}
                        className="text-gray-400 hover:text-emerald-600"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {student.first_name} {student.last_name}
                      </div>
                      {student.date_of_birth && (
                        <div className="text-xs text-gray-400">
                          {new Date(student.date_of_birth).toLocaleDateString(intlLocale)}
                        </div>
                      )}
                      {!hasEnrollment && student.status === "active" && (
                        <div className="text-xs text-amber-500">{t("noEnrollment")}</div>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <div className="text-gray-700">{student.school_name || "—"}</div>
                      {student.school_class && (
                        <div className="text-xs text-gray-400">{student.school_class}</div>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {(enrollmentMap[student.id] || []).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {(enrollmentMap[student.id] || []).map((e) => (
                            <Badge key={e.courseId} className="bg-blue-100 text-blue-700 border-0 text-xs">
                              {e.courseName}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {student.parent_id ? (
                        <div className="text-emerald-700 font-medium">{student.parent_name || parentDisplay}</div>
                      ) : (
                        <div className="text-gray-700">{parentDisplay}</div>
                      )}
                      {student.parent_id && (
                        <div className="text-xs text-emerald-500">{t("portalUser")}</div>
                      )}
                      {student.parent_is_member && (
                        <div className="text-xs text-emerald-600">{t("parentIsMember")}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          student.status === "active"
                            ? "bg-emerald-100 text-emerald-700 border-0"
                            : "bg-gray-100 text-gray-500 border-0"
                        }
                      >
                        {tL(`student.status.${student.status}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/madrasa/schueler/${student.id}`}
                          title="Details / Eltern verwalten"
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors inline-flex"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                        <button
                          title={t("editTitle")}
                          onClick={() => { setEditStudent(student); setEditDialogOpen(true); }}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button
                          title={student.status === "active" ? t("deactivate") : t("activate")}
                          onClick={() => handleToggleStatus(student)}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                        >
                          {student.status === "active" ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialogs */}
      {user && mosqueId && (
        <>
          <AdminStudentDialog
            open={createDialogOpen}
            mosqueId={mosqueId}
            userId={user.id}
            onClose={() => setCreateDialogOpen(false)}
            onSuccess={() => { loadAll(); }}
          />
          <AdminStudentDialog
            open={editDialogOpen}
            mosqueId={mosqueId}
            userId={user.id}
            student={editStudent}
            onClose={() => { setEditDialogOpen(false); setEditStudent(null); }}
            onSuccess={() => { loadAll(); }}
          />
          <StudentImportDialog
            open={importDialogOpen}
            onClose={() => setImportDialogOpen(false)}
            mosqueId={mosqueId}
            onSuccess={() => { loadAll(); }}
          />
        </>
      )}
    </div>
  );
}
