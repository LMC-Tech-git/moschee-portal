"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Link2,
  Plus,
  Copy,
  Check,
  XCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Users,
  UserPlus,
  GraduationCap,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useMosque } from "@/lib/mosque-context";
import { getInvites, revokeInvite, deleteInvite } from "@/lib/actions/invites";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateInviteDialog } from "@/components/invites/CreateInviteDialog";
import type { Invite } from "@/types";

// --- Helpers ---

function getInviteStatus(invite: Invite): {
  label: string;
  className: string;
} {
  if (!invite.is_active) {
    return { label: "Widerrufen", className: "bg-red-100 text-red-700" };
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { label: "Abgelaufen", className: "bg-gray-100 text-gray-600" };
  }
  if (invite.max_uses > 0 && invite.uses_count >= invite.max_uses) {
    return { label: "Ausgeschöpft", className: "bg-amber-100 text-amber-700" };
  }
  return { label: "Aktiv", className: "bg-emerald-100 text-emerald-700" };
}

const ROLE_LABELS: Record<string, string> = {
  member: "Mitglied",
  teacher: "Lehrer/in",
  admin: "Admin",
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  member: Users,
  teacher: GraduationCap,
  admin: Shield,
};

function formatExpiry(expiresAt: string): string {
  if (!expiresAt) return "—";
  const d = new Date(expiresAt);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatUsage(invite: Invite): string {
  if (invite.type === "personal") return "1×";
  if (invite.max_uses === 0) return `${invite.uses_count} / ∞`;
  return `${invite.uses_count} / ${invite.max_uses}`;
}

export default function AdminInvitesPage() {
  const { user } = useAuth();
  const { mosqueId, mosque } = useMosque();

  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const mosqueSlug = mosque?.slug || "";

  const loadInvites = useCallback(async () => {
    if (!mosqueId) return;
    setIsLoading(true);
    try {
      const result = await getInvites(mosqueId, { page });
      if (result.success && result.data) {
        setInvites(result.data);
        setTotalPages(result.totalPages ?? 1);
        setTotalItems(result.totalItems ?? 0);
      }
    } finally {
      setIsLoading(false);
    }
  }, [mosqueId, page]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  async function copyInviteLink(invite: Invite) {
    const link = `${window.location.origin}/${mosqueSlug}/invite/${invite.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(invite.id);
      toast.success("Link kopiert!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Kopieren fehlgeschlagen.");
    }
  }

  async function handleRevoke(invite: Invite) {
    if (!mosqueId || !user?.id) return;
    if (!confirm(`Einladung "${invite.label || invite.token.slice(0, 12) + "…"}" widerrufen?`)) return;

    const result = await revokeInvite(invite.id, mosqueId, user.id);
    if (result.success) {
      toast.success("Einladung widerrufen.");
      loadInvites();
    } else {
      toast.error(result.error || "Fehler beim Widerrufen.");
    }
  }

  async function handleDelete(invite: Invite) {
    if (!mosqueId || !user?.id) return;
    if (!confirm("Einladung endgültig löschen?")) return;

    const result = await deleteInvite(invite.id, mosqueId, user.id);
    if (result.success) {
      toast.success("Einladung gelöscht.");
      loadInvites();
    } else {
      toast.error(result.error || "Fehler beim Löschen.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Einladungen</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isLoading ? "Laden…" : `${totalItems} Einladung${totalItems !== 1 ? "en" : ""}`}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="sm:self-start">
          <Plus className="mr-2 h-4 w-4" />
          Neue Einladung
        </Button>
      </div>

      {/* Tabelle */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-8 w-20 rounded" />
                </div>
              ))}
            </div>
          ) : invites.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <Link2 className="h-6 w-6 text-gray-400" />
              </div>
              <div>
                <p className="font-medium text-gray-700">Noch keine Einladungen</p>
                <p className="mt-1 text-sm text-gray-500">
                  Erstelle deinen ersten Einladungslink, um Mitglieder einzuladen.
                </p>
              </div>
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Erste Einladung erstellen
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Typ / Bezeichnung</th>
                    <th className="px-4 py-3">Rolle</th>
                    <th className="px-4 py-3 text-center">Nutzungen</th>
                    <th className="px-4 py-3">Gültig bis</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invites.map((invite) => {
                    const status = getInviteStatus(invite);
                    const RoleIcon = ROLE_ICONS[invite.role] || Users;
                    const isInactive = !invite.is_active ||
                      (invite.expires_at !== "" && new Date(invite.expires_at) < new Date()) ||
                      (invite.max_uses > 0 && invite.uses_count >= invite.max_uses);

                    return (
                      <tr
                        key={invite.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        {/* Typ / Bezeichnung */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                              {invite.type === "personal" ? (
                                <UserPlus className="h-3.5 w-3.5 text-gray-500" />
                              ) : (
                                <Users className="h-3.5 w-3.5 text-gray-500" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">
                                {invite.label || (invite.type === "personal" ? "Persönlich" : "Gruppeneinladung")}
                              </p>
                              <p className="text-xs text-gray-400">
                                {invite.type === "personal" ? "Persönlich · Einmalig" : "Gruppe · Mehrfach"}
                                {invite.email && ` · ${invite.email}`}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Rolle */}
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                            <RoleIcon className="h-3.5 w-3.5" />
                            {ROLE_LABELS[invite.role] || invite.role}
                          </span>
                        </td>

                        {/* Nutzungen */}
                        <td className="px-4 py-3 text-center">
                          <span className="font-mono text-xs text-gray-700">
                            {formatUsage(invite)}
                          </span>
                        </td>

                        {/* Gültig bis */}
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {formatExpiry(invite.expires_at)}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </td>

                        {/* Aktionen */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {/* Link kopieren */}
                            <button
                              type="button"
                              onClick={() => copyInviteLink(invite)}
                              disabled={isInactive}
                              className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                              title="Link kopieren"
                            >
                              {copiedId === invite.id ? (
                                <Check className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>

                            {/* Widerrufen */}
                            {invite.is_active && (
                              <button
                                type="button"
                                onClick={() => handleRevoke(invite)}
                                className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                title="Einladung widerrufen"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            )}

                            {/* Löschen (nur wenn noch nicht genutzt) */}
                            {invite.uses_count === 0 && (
                              <button
                                type="button"
                                onClick={() => handleDelete(invite)}
                                className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                title="Einladung löschen"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Seite {page} von {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
              Zurück
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
            >
              Weiter
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      {user && mosqueId && (
        <CreateInviteDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          mosqueId={mosqueId}
          mosqueSlug={mosqueSlug}
          adminUserId={user.id}
          onSuccess={loadInvites}
        />
      )}
    </div>
  );
}
