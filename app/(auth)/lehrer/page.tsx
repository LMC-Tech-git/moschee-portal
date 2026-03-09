"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ClipboardList, Clock, Users, GraduationCap } from "lucide-react";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import { getCoursesByTeacher } from "@/lib/actions/courses";
import { getActiveAcademicYear } from "@/lib/actions/academic-years";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  courseCategoryLabels,
  courseCategoryColors,
  dayOfWeekLabels,
} from "@/lib/constants";
import type { CourseWithStats, AcademicYear } from "@/types";

export default function LehrerDashboard() {
  const { mosqueId } = useMosque();
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseWithStats[]>([]);
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!mosqueId || !user) return;

    async function load() {
      setIsLoading(true);

      // Aktives Schuljahr laden
      const yearResult = await getActiveAcademicYear(mosqueId);
      const year = yearResult.success && yearResult.data ? yearResult.data : null;
      setActiveYear(year);

      // Kurse des Lehrers laden
      const result = await getCoursesByTeacher(
        mosqueId,
        user!.id,
        year?.id
      );
      if (result.success && result.data) {
        setCourses(result.data);
      }
      setIsLoading(false);
    }
    load();
  }, [mosqueId, user]);

  // Heutigen Wochentag bestimmen
  const today = new Date();
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const todayDay = dayNames[today.getDay()];

  // Kurse sortieren: Heute zuerst
  const todayCourses = courses.filter((c) => c.day_of_week === todayDay);
  const otherCourses = courses.filter((c) => c.day_of_week !== todayDay);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-blue-600" />
          Meine Kurse
        </h1>
        <p className="text-sm text-gray-500">
          {activeYear
            ? `Schuljahr ${activeYear.name}`
            : "Kein aktives Schuljahr"}
          {" — "}
          {today.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">
              Keine Kurse zugewiesen
            </p>
            <p className="text-xs text-gray-400">
              Ein Admin muss Ihnen Kurse zuweisen.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Heutige Kurse */}
          {todayCourses.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-emerald-700">
                Heute — {dayOfWeekLabels[todayDay as keyof typeof dayOfWeekLabels]}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {todayCourses.map((course) => (
                  <CourseCard key={course.id} course={course} isToday />
                ))}
              </div>
            </div>
          )}

          {/* Andere Kurse */}
          {otherCourses.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
                Weitere Kurse
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {otherCourses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CourseCard({ course, isToday }: { course: CourseWithStats; isToday?: boolean }) {
  return (
    <Card className={cn(
      "transition-shadow hover:shadow-md",
      isToday && "border-emerald-200 bg-emerald-50/30"
    )}>
      <CardContent className="p-4">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{course.title}</h3>
            <span
              className={cn(
                "mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                courseCategoryColors[course.category]
              )}
            >
              {courseCategoryLabels[course.category]}
            </span>
          </div>
        </div>

        <div className="mb-4 space-y-1 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            {dayOfWeekLabels[course.day_of_week]}, {course.start_time}
            {course.end_time ? `–${course.end_time}` : ""}
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-gray-400" />
            {course.enrolled_count} Schüler
            {course.max_students > 0 && ` / ${course.max_students}`}
          </div>
        </div>

        {/* Quick Actions */}
        <Link
          href={`/lehrer/${course.id}/attendance`}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
            isToday
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "border border-gray-300 text-gray-700 hover:bg-gray-50"
          )}
        >
          <ClipboardList className="h-4 w-4" />
          Anwesenheit eintragen
        </Link>
      </CardContent>
    </Card>
  );
}
