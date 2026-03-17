"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, TrendingUp, Users, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CourseAttendanceStats } from "@/lib/actions/attendance";

interface AttendanceStatsProps {
  stats: CourseAttendanceStats | null;
  isLoading: boolean;
}

function getRateColors(rate: number): { badge: string; bar: string; text: string } {
  if (rate >= 75) return { badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500", text: "text-emerald-600" };
  if (rate >= 50) return { badge: "bg-amber-100 text-amber-700", bar: "bg-amber-500", text: "text-amber-600" };
  return { badge: "bg-red-100 text-red-700", bar: "bg-red-500", text: "text-red-600" };
}

export default function AttendanceStats({ stats, isLoading }: AttendanceStatsProps) {
  const t = useTranslations("lehrer.attendance.stats");
  const [showSessions, setShowSessions] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600 motion-reduce:animate-none" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 py-12 text-center text-sm text-gray-400">
        {t("noData")}
      </div>
    );
  }

  if (stats.totalSessions === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 py-12 text-center text-sm text-gray-400">
        {t("noSessions")}
      </div>
    );
  }

  const rateColors = getRateColors(stats.avgClassRate);

  return (
    <div className="space-y-5">
      {/* Klassen-KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <CalendarDays className="mx-auto mb-1.5 h-5 w-5 text-gray-400" aria-hidden="true" />
            <p className="tabular-nums text-2xl font-bold text-gray-900">{stats.totalSessions}</p>
            <p className="text-xs text-gray-500">{t("sessions")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="mx-auto mb-1.5 h-5 w-5 text-gray-400" aria-hidden="true" />
            <p className={cn("tabular-nums text-2xl font-bold", rateColors.text)}>{stats.avgClassRate}%</p>
            <p className="text-xs text-gray-500">{t("avgAttendance")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="mx-auto mb-1.5 h-5 w-5 text-gray-400" aria-hidden="true" />
            <p className="tabular-nums text-2xl font-bold text-gray-900">{stats.enrolledCount}</p>
            <p className="text-xs text-gray-500">{t("students")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Schüler-Statistik */}
      <Card>
        <CardHeader className="px-4 pb-2 pt-4">
          <CardTitle className="text-sm font-semibold text-gray-700">{t("studentStats")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {stats.studentStats.map((s) => {
              const colors = getRateColors(s.rate);
              const isAuffaellig = s.total > 0 && s.rate < 50;
              return (
                <div
                  key={s.student_id}
                  className={cn("px-4 py-3", isAuffaellig ? "bg-red-50" : "")}
                >
                  {/* Name + Rate-Badge */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {isAuffaellig && (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                      )}
                      <span className="truncate text-sm font-medium text-gray-900">
                        {s.student_name}
                      </span>
                    </div>
                    <Badge className={cn("shrink-0 tabular-nums text-xs font-semibold", colors.badge)}>
                      {s.present + s.late} / {s.total}
                    </Badge>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className={cn("h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none", colors.bar)}
                        style={{ width: `${s.rate}%` }}
                      />
                    </div>
                    <span className={cn("w-8 shrink-0 tabular-nums text-right text-xs font-semibold", colors.text)}>
                      {s.rate}%
                    </span>
                  </div>

                  {/* Detail-Counts */}
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    <span className="text-emerald-600">{t("presentCount", { n: s.present })}</span>
                    {s.late > 0 && <span className="text-amber-600">{t("lateCount", { n: s.late })}</span>}
                    {s.absent > 0 && <span className="text-red-600">{t("absentCount", { n: s.absent })}</span>}
                    {s.excused > 0 && <span className="text-blue-600">{t("excusedCount", { n: s.excused })}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sessions-Übersicht (einklappbar) */}
      <Card>
        <button
          type="button"
          onClick={() => setShowSessions((p) => !p)}
          aria-expanded={showSessions}
          className="flex w-full items-center justify-between px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t-xl"
        >
          <span className="text-sm font-semibold text-gray-700">
            {t("sessionsOverview", { count: stats.sessionStats.length })}
          </span>
          {showSessions ? (
            <ChevronUp className="h-4 w-4 text-gray-400" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
          )}
        </button>
        {showSessions && (
          <CardContent className="p-0">
            <div className="divide-y">
              {stats.sessionStats.map((s) => {
                const colors = getRateColors(s.rate);
                return (
                  <div key={s.date} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-700">
                      {new Date(s.date).toLocaleDateString("de-DE", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        {t("sessionPresent", { present: s.present + s.late, total: s.total })}
                      </span>
                      <Badge className={cn("tabular-nums text-xs", colors.badge)}>{s.rate}%</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
