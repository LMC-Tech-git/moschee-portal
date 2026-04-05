"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CoursePerformanceStats, StudentPerformanceStat } from "@/lib/actions/attendance";

interface PerformanceStatsProps {
  stats: CoursePerformanceStats | null;
  isLoading: boolean;
}

function perfColor(avg?: number): string {
  if (avg == null) return "bg-gray-100 text-gray-500";
  if (avg >= 4) return "bg-emerald-100 text-emerald-700";
  if (avg >= 3) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function trendIcon(trend?: "up" | "down" | "stable"): string {
  if (trend === "up") return "↗";
  if (trend === "down") return "↘";
  if (trend === "stable") return "→";
  return "";
}

function trendColor(trend?: "up" | "down" | "stable"): string {
  if (trend === "up") return "text-emerald-600";
  if (trend === "down") return "text-red-500";
  return "text-gray-400";
}

function StudentRow({
  student,
  avgClassPerformance,
  locale,
}: {
  student: StudentPerformanceStat;
  avgClassPerformance?: number;
  locale: string;
}) {
  const t = useTranslations("lehrer");
  const [expanded, setExpanded] = useState(false);
  const intlLocale = locale === "tr" ? "tr-TR" : "de-DE";

  const diff =
    avgClassPerformance != null && student.avgPerformance != null
      ? Number((student.avgPerformance - avgClassPerformance).toFixed(1))
      : undefined;

  const isBelowAvg =
    student.avgPerformance != null &&
    avgClassPerformance != null &&
    student.avgPerformance < avgClassPerformance - 0.5;

  const hasData = student.performanceCount > 0;

  return (
    <div className={cn("border-b last:border-b-0", isBelowAvg && "bg-red-50/50")}>
      <div className="flex items-start gap-2 px-4 py-3">
        {/* Name + Diff (zweite Zeile auf Mobile) */}
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium truncate", !hasData && "text-gray-400")}>
            {student.student_name}
          </p>
          {diff != null && diff !== 0 && (
            <p className={cn("text-xs font-medium mt-0.5", diff > 0 ? "text-emerald-600" : "text-red-500")}>
              {diff > 0
                ? t("attendance.performance.aboveAvg", { diff: `+${diff}` })
                : t("attendance.performance.belowAvg", { diff: String(diff) })}
            </p>
          )}
        </div>

        {/* Rechte Seite: Badge + Trend + Anzahl + Expand */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Ø Badge */}
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", perfColor(student.avgPerformance))}>
            {student.avgPerformance != null ? `Ø ${student.avgPerformance}` : "Ø —"}
          </span>

          {/* Trend */}
          {student.trend && (
            <span className={cn("text-sm font-medium", trendColor(student.trend))}>
              {trendIcon(student.trend)}
            </span>
          )}

          {/* Anzahl */}
          {hasData && (
            <span className="text-xs text-gray-400 tabular-nums">
              ({student.performanceCount})
            </span>
          )}

          {/* Expand */}
          {hasData && student.recentSessions.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Mini-Timeline */}
      {expanded && student.recentSessions.length > 0 && (
        <div className="px-4 pb-3">
          <div className="rounded-md border border-gray-100 bg-white divide-y">
            {student.recentSessions.map((s, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-1.5 text-xs text-gray-600">
                <span className="w-24 shrink-0 text-gray-400">
                  {new Date(s.date).toLocaleDateString(intlLocale, { day: "2-digit", month: "2-digit", year: "numeric" })}
                </span>
                <span className="font-medium">{s.icon} {s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PerformanceStats({ stats, isLoading }: PerformanceStatsProps) {
  const t = useTranslations("lehrer");
  const locale = useLocale();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600 motion-reduce:animate-none" />
      </div>
    );
  }

  if (!stats || stats.totalSessions === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
        {t("attendance.stats.noSessions")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {stats.ratedSessionCount}
              <span className="text-sm font-normal text-gray-400"> / {stats.totalSessions}</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">{t("attendance.performance.ratedSessions", { rated: stats.ratedSessionCount, total: stats.totalSessions })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            {stats.avgClassPerformance != null ? (
              <>
                <p className={cn("inline-block rounded-full px-3 py-1 text-2xl font-bold", perfColor(stats.avgClassPerformance))}>
                  {stats.avgClassPerformance}
                </p>
                <p className="mt-1 text-xs text-gray-500">{t("attendance.performance.avgClass")}</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-300">—</p>
                <p className="mt-1 text-xs text-gray-500">{t("attendance.performance.avgClass")}</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {stats.ratedStudentsCount}
              <span className="text-sm font-normal text-gray-400"> / {stats.enrolledCount}</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">{t("attendance.performance.ratedStudents")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Schüler-Liste */}
      <Card>
        <CardContent className="p-0">
          {stats.studentStats.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {t("attendance.performance.notRatedYet")}
            </div>
          ) : (
            <div className="divide-y">
              {stats.studentStats.map((student) => (
                <StudentRow
                  key={student.student_id}
                  student={student}
                  avgClassPerformance={stats.avgClassPerformance}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
