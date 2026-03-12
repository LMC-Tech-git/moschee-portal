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
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useMosque } from "@/lib/mosque-context";
import { getMembersByMosque, updateMemberStatus } from "@/lib/actions/members";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateInviteDialog } from "@/components/invites/CreateInviteDialog";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

const ROLES = [
  { value: "", label: "Alle Rollen" },
  { value: "member", label: "Mitglied" },
  { value: "imam", label: "Imam" },
  { value: "teacher", label: "Lehrer" },
  { value: "admin", label: "Admin" },
];

const STATUSES = [
  { value: "", label: "Alle Status" },
  { value: "pending", label: "Ausstehend" },
  { value: "active", label: "Aktiv" },
  { value: "inactive", label: "Inaktiv" },
];

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Ausstehend",
    className: "bg-amber-100 text-amber-700",
  },
  active: {
    label: "Aktiv",
    className: "bg-emerald-100 text-emerald-700",
  },
  inactive: {
    label: "Inaktiv",
    className: "bg-gray-100 text-gray-600",
  },
};

const ROLE_BADGES: Record<string, { label: string; className: string }> = {
  member: {
    label: "Mitglied",
    className: "bg-blue-100 text-blue-700",
  },
  admin: {
    label: "Admin",
    className: "bg-purple-100 text-purple-700",
  },
  teacher: {
    label: "Lehrer",
    className: "bg-teal-100 text-teal-700",
  },
  imam: {
    label: "Imam",
    className: "bg-violet-100 text-violet-700",
  },
};

export default function MitgliederListePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { mosqueId, mosque } = useMosque();
  const [members, setMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);

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
        toast.error(result.error || "Fehler beim Laden der Mitglieder");
      }
    } catch (error) {
      console.error("Mitglieder laden Fehler:", error);
      toast.error("Fehler beim Laden der Mitglieder");
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

  async function handleStatusChange(memberId: string, newStatus: "pending" | "active" | "inactive") {
    if (!user) return;
    try {
      const result = await updateMemberStatus(memberId, mosqueId, user.id, newStatus as "pending" | "active" | "blocked");
      if (result.success) {
        toast.success(`Status auf "${STATUS_BADGES[newStatus]?.label}" geändert`);
        loadMembers();
      } else {
        toast.error(result.error || "Fehler beim Ändern des Status");
      }
    } catch (error) {
      console.error("Status-Änderung Fehler:", error);
      toast.error("Fehler beim Ändern des Status");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Mitgliederverwaltung
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {totalItems} Mitglieder insgesamt
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="sm:self-start">
          <UserPlus className="mr-2 h-4 w-4" />
          Mitglied einladen
        </Button>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Name, E-Mail oder Mitgliedsnr. suchen..."
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
              <p className="text-sm font-medium text-gray-600">Keine Mitglieder gefunden.</p>
              {(searchQuery || roleFilter || statusFilter) && (
                <p className="mt-1 text-xs text-gray-400">Versuchen Sie andere Filterkriterien.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3 hidden sm:table-cell">E-Mail</th>
                    <th className="px-4 py-3 hidden md:table-cell">Nr.</th>
                    <th className="px-4 py-3">Rolle</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aktionen</th>
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
                      <td className="px-4 py-3 hidden md:table-cell text-gray-500 font-mono text-xs">
                        {member.membership_number || member.member_no || "—"}
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
                              title="Freischalten"
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
                              title="Deaktivieren"
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
                              title="Reaktivieren"
                              aria-label={`${member.full_name} reaktivieren`}
                            >
                              <UserCheck className="h-4 w-4" />
                            </button>
                          )}
                          <Link
                            href={`/admin/mitglieder/${member.id}`}
                            className="rounded p-1.5 text-gray-600 hover:bg-gray-100"
                            title="Bearbeiten"
                            aria-label={`${member.full_name} bearbeiten`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
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
