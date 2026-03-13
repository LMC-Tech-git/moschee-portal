"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Users,
} from "lucide-react";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import { getEventsByMosque, deleteEvent, getRegistrationCountsForEvents } from "@/lib/actions/events";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDateTime } from "@/lib/utils";
import {
  eventCategoryColors,
  eventStatusColors,
  visibilityColors,
} from "@/lib/constants";
import type { Event } from "@/types";
import { useTranslations } from "next-intl";

export default function AdminEventsPage() {
  const t = useTranslations("events");
  const tCommon = useTranslations("common");
  const tL = useTranslations("labels");
  const router = useRouter();
  const { mosqueId } = useMosque();
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [regCounts, setRegCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "published" | "draft" | "cancelled"
  >("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!mosqueId) return;

    async function load() {
      setIsLoading(true);
      const statusFilter = filter === "all" ? undefined : filter;
      const result = await getEventsByMosque(mosqueId, {
        status: statusFilter as
          | "published"
          | "draft"
          | "cancelled"
          | undefined,
        page,
      });
      if (result.success && result.data) {
        setEvents(result.data);
        setTotalPages(result.totalPages || 1);

        // Registrierungsanzahlen laden
        const ids = result.data.map((e) => e.id);
        if (ids.length > 0) {
          const counts = await getRegistrationCountsForEvents(ids);
          setRegCounts(counts);
        }
      }
      setIsLoading(false);
    }
    load();
  }, [mosqueId, filter, page]);

  function handleFilterChange(
    f: "all" | "published" | "draft" | "cancelled"
  ) {
    setFilter(f);
    setPage(1);
  }

  async function handleDelete(eventId: string, title: string) {
    if (!confirm(t("deleteConfirm", { title }))) return;
    if (!user) return;

    const result = await deleteEvent(eventId, mosqueId, user.id);
    if (result.success) {
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    }
  }

  const filterLabels = {
    all: t("filterAll"),
    published: t("filterPublished"),
    draft: t("filterDraft"),
    cancelled: t("filterCancelled"),
  } as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">
            {t("subtitle")}
          </p>
        </div>
        <Link
          href="/admin/events/new"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          {t("newEvent")}
        </Link>
      </div>

      {/* Filter */}
      <div
        className="flex gap-2"
        role="tablist"
        aria-label="Veranstaltungen filtern"
      >
        {(["all", "published", "draft", "cancelled"] as const).map((f) => (
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
                  <Skeleton className="h-4 w-28 hidden lg:block" />
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <CalendarDays
                className="mb-3 h-10 w-10 text-gray-300"
                aria-hidden="true"
              />
              <p className="mb-1 text-sm font-medium text-gray-600">
                {t("noEventsYet")}
              </p>
              <p className="mb-4 text-xs text-gray-400">
                {t("noEventsHint")}
              </p>
              <Link
                href="/admin/events/new"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                {t("newEvent")}
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">{t("colTitle")}</th>
                    <th className="px-4 py-3 hidden sm:table-cell">
                      {t("colCategory")}
                    </th>
                    <th className="px-4 py-3 hidden md:table-cell">
                      {t("colVisibility")}
                    </th>
                    <th className="px-4 py-3">{t("colStatus")}</th>
                    <th className="px-4 py-3 hidden lg:table-cell">{t("colDate")}</th>
                    <th className="px-4 py-3 hidden xl:table-cell">{t("colLocation")}</th>
                    <th className="px-4 py-3 hidden md:table-cell">{t("colRegistrations")}</th>
                    <th className="px-4 py-3 text-right">{t("colActions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {events.map((event) => (
                    <tr
                      key={event.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/admin/events/${event.id}`)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <span className="truncate max-w-[200px] lg:max-w-[300px] block">
                          {event.title}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            eventCategoryColors[event.category] ||
                              "bg-gray-100 text-gray-600"
                          )}
                        >
                          {tL(`event.category.${event.category}` as Parameters<typeof tL>[0]) || event.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            visibilityColors[event.visibility] ||
                              "bg-gray-100 text-gray-600"
                          )}
                        >
                          {tL(`visibility.${event.visibility}` as Parameters<typeof tL>[0]) || event.visibility}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            eventStatusColors[event.status] ||
                              "bg-gray-100 text-gray-600"
                          )}
                        >
                          {tL(`event.status.${event.status}` as Parameters<typeof tL>[0]) || event.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs whitespace-nowrap">
                        {event.start_at
                          ? formatDateTime(event.start_at)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-gray-500 text-xs">
                        {event.location_name ? (
                          <span className="flex items-center gap-1 truncate max-w-[150px]">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            {event.location_name}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                          <Users className="h-3 w-3" />
                          {regCounts[event.id] ?? 0}
                          {event.capacity > 0 && (
                            <span className="text-gray-400">/ {event.capacity}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/admin/events/${event.id}`}
                            className="rounded p-1.5 text-gray-600 hover:bg-gray-100"
                            title={tCommon("edit")}
                            aria-label={`Veranstaltung "${event.title}" bearbeiten`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(event.id, event.title); }}
                            className="rounded p-1.5 text-red-600 hover:bg-red-50"
                            title={tCommon("delete")}
                            aria-label={`Veranstaltung "${event.title}" löschen`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
                {tCommon("pageOf", { page, total: totalPages })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label={tCommon("prevPage")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  aria-label={tCommon("nextPage")}
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
