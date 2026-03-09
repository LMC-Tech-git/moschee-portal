"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  ClipboardList,
  Calendar,
  Banknote,
} from "lucide-react";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import { getCoursesByMosque, deleteCourse } from "@/lib/actions/courses";
import { getAcademicYearsByMosque } from "@/lib/actions/academic-years";
import { getMadrasaFeeSettings } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  courseCategoryLabels,
  courseCategoryColors,
  courseLevelLabels,
  courseLevelColors,
  courseStatusLabels,
  courseStatusColors,
  dayOfWeekLabels,
} from "@/lib/constants";
import type { CourseWithStats, AcademicYear } from "@/types";

export default function AdminMadrasaPage() {
  const { mosqueId } = useMosque();
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseWithStats[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "paused" | "archived">("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [feesEnabled, setFeesEnabled] = useState(false);

  // Schuljahre + Fee-Settings laden
  useEffect(() => {
    if (!mosqueId) return;
    async function loadYears() {
      const [yearsResult, feeResult] = await Promise.all([
        getAcademicYearsByMosque(mosqueId),
        getMadrasaFeeSettings(mosqueId),
      ]);
      if (yearsResult.success && yearsResult.data) {
        setAcademicYears(yearsResult.data);
        const activeYear = yearsResult.data.find((y) => y.status === "active");
        if (activeYear) setSelectedYearId(activeYear.id);
      }
      if (feeResult.success && feeResult.data) {
        setFeesEnabled(feeResult.data.madrasa_fees_enabled);
      }
    }
    loadYears();
  }, [mosqueId]);

  // Kurse laden wenn Schuljahr oder Filter sich ändert
  useEffect(() => {
    if (!mosqueId) return;

    async function load() {
      setIsLoading(true);
      const statusFilter = filter === "all" ? undefined : filter;
      const result = await getCoursesByMosque(mosqueId, {
        status: statusFilter as "active" | "paused" | "archived" | undefined,
        academicYearId: selectedYearId || undefined,
        page,
      });
      if (result.success && result.data) {
        setCourses(result.data);
        setTotalPages(result.totalPages || 1);
      }
      setIsLoading(false);
    }
    load();
  }, [mosqueId, filter, page, selectedYearId]);

  function handleFilterChange(f: "all" | "active" | "paused" | "archived") {
    setFilter(f);
    setPage(1);
  }

  async function handleDelete(courseId: string) {
    if (!user) return;
    const result = await deleteCourse(courseId, mosqueId, user.id);
    if (result.success) {
      setCourses((prev) => prev.filter((c) => c.id !== courseId));
    }
    setDeletingCourseId(null);
  }

  const filterLabels = {
    all: "Alle",
    active: "Aktiv",
    paused: "Pausiert",
    archived: "Archiviert",
  } as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Madrasa</h1>
          <p className="text-sm text-gray-500">
            Verwalten Sie die Unterrichtskurse Ihrer Moschee.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {feesEnabled && (
            <Link
              href="/admin/madrasa/gebuehren"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Banknote className="h-4 w-4" />
              Gebühren
            </Link>
          )}
          <Link
            href="/admin/madrasa/schuljahre"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Calendar className="h-4 w-4" />
            Schuljahre
          </Link>
          <Link
            href="/admin/madrasa/new"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Neuer Kurs
          </Link>
        </div>
      </div>

      {/* Schuljahr-Filter */}
      {academicYears.length > 0 && (
        <div className="flex items-center gap-3">
          <label htmlFor="year_filter" className="text-sm font-medium text-gray-700">
            Schuljahr:
          </label>
          <select
            id="year_filter"
            value={selectedYearId}
            onChange={(e) => { setSelectedYearId(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Alle Schuljahre</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} {y.status === "active" ? "(aktiv)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Status-Filter */}
      <div className="flex gap-2" role="tablist" aria-label="Kurse filtern">
        {(["all", "active", "paused", "archived"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => handleFilterChange(f)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              filter === f
                ? "bg-emerald-100 text-emerald-700"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {/* Tabelle */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-0 divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-20 hidden sm:block" />
                  <Skeleton className="h-4 w-16 hidden md:block" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <BookOpen className="mb-3 h-10 w-10 text-gray-300" aria-hidden="true" />
              <p className="mb-1 text-sm font-medium text-gray-600">
                Noch keine Kurse
              </p>
              <p className="mb-4 text-xs text-gray-400">
                Erstellen Sie Ihren ersten Madrasa-Kurs.
              </p>
              <Link
                href="/admin/madrasa/new"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                Neuer Kurs
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Kurs</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Kategorie</th>
                    <th className="px-4 py-3 hidden md:table-cell">Level</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Lehrer</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Zeitplan</th>
                    <th className="px-4 py-3 hidden md:table-cell">Schüler</th>
                    <th className="px-4 py-3 text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {courses.map((course) => (
                    <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <span className="truncate max-w-[200px] lg:max-w-[300px] block">
                          {course.title}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            courseCategoryColors[course.category] || "bg-gray-100 text-gray-600"
                          )}
                        >
                          {courseCategoryLabels[course.category] || course.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            courseLevelColors[course.level] || "bg-gray-100 text-gray-600"
                          )}
                        >
                          {courseLevelLabels[course.level] || course.level}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            courseStatusColors[course.status] || "bg-gray-100 text-gray-600"
                          )}
                        >
                          {courseStatusLabels[course.status] || course.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                        {course.teacher_name || "—"}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          {dayOfWeekLabels[course.day_of_week]}{" "}
                          {course.start_time}
                          {course.end_time ? `–${course.end_time}` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                          <Users className="h-3 w-3" />
                          {course.enrolled_count}
                          {course.max_students > 0 && (
                            <span className="text-gray-400">/ {course.max_students}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {deletingCourseId === course.id ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-1 text-xs">
                              <span className="text-red-700">Löschen?</span>
                              <button
                                type="button"
                                onClick={() => handleDelete(course.id)}
                                className="font-semibold text-red-600 hover:text-red-800"
                                aria-label={`Kurs "${course.title}" endgültig löschen`}
                              >
                                Ja
                              </button>
                              <span className="text-red-300">|</span>
                              <button
                                type="button"
                                onClick={() => setDeletingCourseId(null)}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                Nein
                              </button>
                            </span>
                          ) : (
                            <>
                              <Link
                                href={`/admin/madrasa/${course.id}/attendance`}
                                className="rounded p-1.5 text-gray-600 hover:bg-gray-100"
                                title="Anwesenheit"
                                aria-label={`Anwesenheit für "${course.title}"`}
                              >
                                <ClipboardList className="h-4 w-4" />
                              </Link>
                              <Link
                                href={`/admin/madrasa/${course.id}`}
                                className="rounded p-1.5 text-gray-600 hover:bg-gray-100"
                                title="Bearbeiten"
                                aria-label={`Kurs "${course.title}" bearbeiten`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => setDeletingCourseId(course.id)}
                                className="rounded p-1.5 text-red-600 hover:bg-red-50"
                                title="Löschen"
                                aria-label={`Kurs "${course.title}" löschen`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-gray-500">
                Seite {page} von {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Vorherige Seite"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  aria-label="Nächste Seite"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
