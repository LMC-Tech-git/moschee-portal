"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Search,
  UserCheck,
  UserX,
  Pencil,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Trash2,
  TrendingUp,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useMosque } from "@/lib/mosque-context";
import { getMembersByMosque, updateMemberStatus, deleteMember, getMemberStats } from "@/lib/actions/members";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateInviteDialog } from "@/components/invites/CreateInviteDialog";
import { MemberGrowthChart } from "@/components/admin/MemberGrowthChart";
import { MemberStatusChart } from "@/components/admin/MemberStatusChart";
import { cn } from "@/lib/utils";
import type { User } from "@/types";
import { useTranslations } from "next-intl";

export default function MitgliederListePage() {
  const t = useTranslations("members");
  const tCommon = useTranslations("common");

  const ROLES = [
    { value: "", label: t("filterAllRoles") },
    { value: "member", label: t("role.member") },
    { value: "imam", label: t("role.imam") },
    { value: "teacher", label: t("role.teacher") },
    { value: "admin", label: t("role.admin") },
  ];

  const STATUSES = [
    { value: "", label: t("filterAllStatus") },
    { value: "pending", label: t("status.pending") },
    { value: "active", label: t("status.active") },
    { value: "inactive", label: t("status.inactive") },
  ];

  const STATUS_BADGES: Record<string, { label: string; className: string }> = {
    pending: { label: t("status.pending"), className: "bg-amber-100 text-amber-700" },
    active: { label: t("status.active"), className: "bg-emerald-100 text-emerald-700" },
    inactive: { label: t("status.inactive"), className: "bg-gray-100 text-gray-600" },
  };

  const ROLE_BADGES: Record<string, { label: string; className: string }> = {
    member: { label: t("role.member"), className: "bg-blue-100 text-blue-700" },
    admin: { label: t("role.admin"), className: "bg-purple-100 text-purple-700" },
    teacher: { label: t("role.teacher"), className: "bg-teal-100 text-teal-700" },
    imam: { label: t("role.imam"), className: "bg-violet-100 text-violet-700" },
  };

  const router = useRouter();
  const { user } = useAuth();
  const { mosqueId, mosque } = useMosque();
  const [members, setMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const canDelete = user?.role === "admin" || user?.role === "super_admin";

  // Stats / Charts
  const [stats, setStats] = useState<{
    byStatus: { active: number; pending: number; inactive: number; blocked: number };
    byMonth: { month: string; count: number }[];
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentMembers, setRecentMembers] = useState<User[]>([]);

  // Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const loadMembers = useCallback(async () => {
    if (!mosqueId) return;
    setIsLoading(true);
    try {
      const result = await getMembersByMosque(mosqueId, {
        status: (statusFilter || undefined) as "pending" | "active" | "inactive" | undefined,
        role: (roleFilter || undefined) as "admin" | "member" | "teacher" | undefined,
        search: searchQuery || undefined,
        page,
      });

      if (result.success && result.data) {
        setMembers(result.data);
        setTotalPages(result.totalPages || 1);
        setTotalItems(result.totalItems || 0);
      } else {
        toast.error(result.error || t("loadError"));
      }
    } catch (error) {
      console.error("Mitglieder laden Fehler:", error);
      toast.error(t("loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [mosqueId, page, searchQuery, roleFilter, statusFilter]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Bei Filter-Änderung zurück auf Seite 1
  useEffect(() => {
    setPage(1);
  }, [searchQuery, roleFilter, statusFilter]);

  // Stats laden (einmalig)
  useEffect(() => {
    if (!mosqueId) return;
    setStatsLoading(true);
    getMemberStats(mosqueId)
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [mosqueId]);

  // Neueste Mitglieder laden (einmalig, letzte 5)
  useEffect(() => {
    if (!mosqueId) return;
    getMembersByMosque(mosqueId, { page: 1, limit: 5 })
      .then((result) => {
        if (result.success && result.data) setRecentMembers(result.data);
      })
      .catch(() => {});
  }, [mosqueId]);

  async function handleDelete(memberId: string) {
    if (!user) return;
    setIsDeleting(true);
    try {
      const result = await deleteMember(memberId, mosqueId, user.id);
      if (result.success) {
        toast.success(t("deleteSuccess"));
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
        setTotalItems((prev) => prev - 1);
      } else {
        toast.error(result.error || t("deleteError"));
      }
    } catch {
      toast.error(t("deleteError"));
    } finally {
      setDeletingMemberId(null);
      setIsDeleting(false);
    }
  }

  async function handleStatusChange(memberId: string, newStatus: "pending" | "active" | "inactive") {
    if (!user) return;
    try {
      const result = await updateMemberStatus(memberId, mosqueId, user.id, newStatus as "pending" | "active" | "blocked");
      if (result.success) {
        toast.success(t("statusChanged", { status: STATUS_BADGES[newStatus]?.label }));
        loadMembers();
      } else {
        toast.error(result.error || t("statusError"));
      }
    } catch (error) {
      console.error("Status-Änderung Fehler:", error);
      toast.error(t("statusError"));
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("subtitle", { count: totalItems })}
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="sm:self-start">
          <UserPlus className="mr-2 h-4 w-4" />
          {t("invite")}
        </Button>
      </div>

      {/* KPI-Kacheln */}
      {statsLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="mb-2 h-4 w-20" />
                <Skeleton className="h-7 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: t("kpi.total"),
              value: stats.byStatus.active + stats.byStatus.pending + stats.byStatus.inactive + stats.byStatus.blocked,
              color: "text-blue-600",
              bg: "bg-blue-50",
            },
            {
              label: t("kpi.active"),
              value: stats.byStatus.active,
              color: "text-emerald-600",
              bg: "bg-emerald-50",
            },
            {
              label: t("kpi.pending"),
              value: stats.byStatus.pending,
              color: "text-amber-600",
              bg: "bg-amber-50",
            },
            {
              label: t("kpi.inactiveBlocked"),
              value: stats.byStatus.inactive + stats.byStatus.blocked,
              color: "text-gray-500",
              bg: "bg-gray-50",
            },
          ].map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-gray-500">{kpi.label}</p>
                <p className={cn("mt-1 text-2xl font-bold", kpi.color)}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Charts + Neueste Mitglieder */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Wachstum */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                {t("chart.growthTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <MemberGrowthChart data={stats.byMonth} />
            </CardContent>
          </Card>

          {/* Statusverteilung */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Users className="h-4 w-4 text-blue-500" />
                {t("chart.statusTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <MemberStatusChart byStatus={stats.byStatus} />
            </CardContent>
          </Card>

          {/* Neueste Mitglieder */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Clock className="h-4 w-4 text-purple-500" />
                {t("chart.recentTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {recentMembers.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400">{t("noFound")}</p>
              ) : (
                <ul className="divide-y">
                  {recentMembers.map((m) => (
                    <li key={m.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.full_name || "—"}</p>
                        <p className="text-xs text-gray-400">{m.email}</p>
                      </div>
                      <span
                        className={cn(
                          "ml-2 inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_BADGES[m.status]?.className || "bg-gray-100 text-gray-600"
                        )}
                      >
                        {STATUS_BADGES[m.status]?.label || m.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tabelle */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-0 divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40 hidden sm:block" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="mb-3 h-10 w-10 text-gray-300" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-600">{t("noFound")}</p>
              {(searchQuery || roleFilter || statusFilter) && (
                <p className="mt-1 text-xs text-gray-400">{t("noFoundHint")}</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">{t("colName")}</th>
                    <th className="px-4 py-3 hidden sm:table-cell">{t("colEmail")}</th>
                    <th className="px-4 py-3 hidden md:table-cell">{t("colPhone")}</th>
                    <th className="px-4 py-3">{t("colRole")}</th>
                    <th className="px-4 py-3">{t("colStatus")}</th>
                    <th className="px-4 py-3 text-right">{t("colActions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {members.map((member) => (
                    <tr
                      key={member.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/admin/mitglieder/${member.id}`)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {member.full_name || "—"}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-gray-600">
                        {member.email}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs">
                        {member.phone || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            ROLE_BADGES[member.role]?.className ||
                              "bg-gray-100 text-gray-600"
                          )}
                        >
                          {ROLE_BADGES[member.role]?.label || member.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            STATUS_BADGES[member.status]?.className ||
                              "bg-gray-100 text-gray-600"
                          )}
                        >
                          {STATUS_BADGES[member.status]?.label || member.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {member.status === "pending" && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(member.id, "active"); }}
                              className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"
                              title={t("activate")}
                              aria-label={`${member.full_name} freischalten`}
                            >
                              <UserCheck className="h-4 w-4" />
                            </button>
                          )}
                          {member.status === "active" && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(member.id, "inactive"); }}
                              className="rounded p-1.5 text-red-600 hover:bg-red-50"
                              title={t("deactivate")}
                              aria-label={`${member.full_name} deaktivieren`}
                            >
                              <UserX className="h-4 w-4" />
                            </button>
                          )}
                          {member.status === "inactive" && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(member.id, "active"); }}
                              className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"
                              title={t("reactivate")}
                              aria-label={`${member.full_name} reaktivieren`}
                            >
                              <UserCheck className="h-4 w-4" />
                            </button>
                          )}
                          <Link
                            href={`/admin/mitglieder/${member.id}`}
                            className="rounded p-1.5 text-gray-600 hover:bg-gray-100"
                            title={tCommon("edit")}
                            aria-label={`${member.full_name} bearbeiten`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          {canDelete && deletingMemberId === member.id ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-1 text-xs">
                              <span className="text-red-700">{t("deleteConfirm")}</span>
                              <button
                                type="button"
                                disabled={isDeleting}
                                onClick={(e) => { e.stopPropagation(); handleDelete(member.id); }}
                                className="font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                              >
                                {t("deleteYes")}
                              </button>
                              <span className="text-red-300">|</span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setDeletingMemberId(null); }}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                {t("deleteNo")}
                              </button>
                            </span>
                          ) : canDelete && member.id !== user?.id ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setDeletingMemberId(member.id); }}
                              className="rounded p-1.5 text-red-500 hover:bg-red-50"
                              title={t("delete")}
                              aria-label={`${member.full_name} löschen`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
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

      {/* Invite Dialog */}
      {user && mosqueId && (
        <CreateInviteDialog
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          mosqueId={mosqueId}
          mosqueSlug={mosque?.slug || ""}
          adminUserId={user.id}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
