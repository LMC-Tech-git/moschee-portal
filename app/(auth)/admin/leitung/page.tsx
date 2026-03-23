"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useMosque } from "@/lib/mosque-context";
import {
  getTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  toggleTeamMemberActive,
  uploadTeamMemberPhoto,
  updateTeamMemberOrder,
} from "@/lib/actions/team";
import type { TeamMember } from "@/types";
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  X,
  ChevronUp,
  ChevronDown,
  Users,
  Camera,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TeamMemberForm from "@/components/team/TeamMemberForm";
import type { CreateTeamMemberInput, UpdateTeamMemberInput } from "@/lib/actions/team";

const pbUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "";

function getPhotoUrl(member: TeamMember): string | null {
  if (!member.photo) return null;
  return `${pbUrl}/api/files/team_members/${member.id}/${member.photo}?thumb=80x80`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AdminLeitungPage() {
  const { user } = useAuth();
  const { mosqueId } = useMosque();
  const t = useTranslations("team.admin");

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Photo upload refs per member
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function loadMembers() {
    if (!mosqueId) return;
    const result = await getTeamMembers(mosqueId);
    if (result.success && result.data) {
      setMembers(result.data);
    } else {
      setError(result.error ?? "Fehler beim Laden.");
    }
    setIsLoading(false);
  }

  useEffect(() => {
    loadMembers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mosqueId]);

  function openCreate() {
    setEditingMember(null);
    setDialogOpen(true);
  }

  function openEdit(member: TeamMember) {
    setEditingMember(member);
    setDialogOpen(true);
  }

  async function handleFormSubmit(input: CreateTeamMemberInput | UpdateTeamMemberInput) {
    if (!mosqueId || !user?.id) return;
    setFormLoading(true);

    let result;
    if (editingMember) {
      result = await updateTeamMember(mosqueId, user.id, editingMember.id, input);
    } else {
      result = await createTeamMember(mosqueId, user.id, input as CreateTeamMemberInput);
    }

    if (result.success) {
      setDialogOpen(false);
      await loadMembers();
    } else {
      alert(result.error ?? t("saveError"));
    }
    setFormLoading(false);
  }

  async function handleDelete(memberId: string) {
    if (!mosqueId || !user?.id) return;
    const result = await deleteTeamMember(mosqueId, user.id, memberId);
    if (result.success) {
      setDeletingId(null);
      await loadMembers();
    } else {
      alert(result.error ?? t("deleteError"));
    }
  }

  async function handleToggleActive(member: TeamMember) {
    if (!mosqueId || !user?.id) return;
    await toggleTeamMemberActive(mosqueId, user.id, member.id, !member.is_active);
    await loadMembers();
  }

  async function handlePhotoUpload(member: TeamMember, file: File) {
    if (!mosqueId || !user?.id) return;
    const fd = new FormData();
    fd.append("photo", file);
    await uploadTeamMemberPhoto(mosqueId, user.id, member.id, fd);
    await loadMembers();
  }

  async function moveUp(index: number) {
    if (index === 0) return;
    const newOrder = [...members];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setMembers(newOrder);
    if (mosqueId && user?.id) {
      await updateTeamMemberOrder(mosqueId, user.id, newOrder.map((m) => m.id));
    }
  }

  async function moveDown(index: number) {
    if (index === members.length - 1) return;
    const newOrder = [...members];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setMembers(newOrder);
    if (mosqueId && user?.id) {
      await updateTeamMemberOrder(mosqueId, user.id, newOrder.map((m) => m.id));
    }
  }

  // Group members for display
  const groups: { name: string; items: { member: TeamMember; index: number }[] }[] = [];
  const groupMap: Record<string, { member: TeamMember; index: number }[]> = {};
  members.forEach((member, index) => {
    const key = member.group?.trim() || t("noGroup");
    if (!groupMap[key]) groupMap[key] = [];
    groupMap[key].push({ member, index });
  });
  Object.keys(groupMap).forEach((name) => {
    groups.push({ name, items: groupMap[name] });
  });

  const existingGroups = Array.from(
    new Set(members.map((m) => m.group).filter((g): g is string => Boolean(g)))
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
            <Users className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-sm text-gray-500">{t("subtitle")}</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          {t("add")}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Member list */}
      {members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-16 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">{t("empty")}</p>
          <button
            onClick={openCreate}
            className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 mx-auto"
          >
            <Plus className="h-4 w-4" />
            {t("add")}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ name, items }) => (
            <div key={name}>
              {groups.length > 1 && (
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {name}
                </h2>
              )}
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
                {items.map(({ member, index }) => {
                  const photoUrl = getPhotoUrl(member);
                  return (
                    <div
                      key={member.id}
                      className={`flex items-center gap-4 px-4 py-3 ${!member.is_active ? "opacity-50" : ""}`}
                    >
                      {/* Photo / Avatar */}
                      <div className="relative flex-shrink-0">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-emerald-100">
                          {photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photoUrl}
                              alt={member.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-semibold text-emerald-700">
                              {getInitials(member.name)}
                            </span>
                          )}
                        </div>
                        {/* Photo upload button */}
                        <button
                          type="button"
                          title={t("uploadPhoto")}
                          onClick={() => photoInputRefs.current[member.id]?.click()}
                          className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow border border-gray-200 hover:bg-emerald-50"
                        >
                          <Camera className="h-3 w-3 text-gray-500" />
                        </button>
                        <input
                          ref={(el) => { photoInputRefs.current[member.id] = el; }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoUpload(member, file);
                          }}
                        />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">{member.name}</p>
                        <p className="truncate text-xs text-gray-500">{member.role}</p>
                        {member.email && (
                          <p className="truncate text-xs text-gray-400">{member.email}</p>
                        )}
                      </div>

                      {/* Status badge */}
                      <span
                        className={`hidden rounded-full px-2 py-0.5 text-xs font-medium sm:inline-flex ${
                          member.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {member.is_active ? t("active") : t("inactive")}
                      </span>

                      {/* Sort order arrows */}
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => moveUp(index)}
                          disabled={index === 0}
                          title={t("moveUp")}
                          className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDown(index)}
                          disabled={index === members.length - 1}
                          title={t("moveDown")}
                          className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(member)}
                          title={member.is_active ? t("deactivate") : t("activate")}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >
                          {member.is_active ? (
                            <X className="h-4 w-4" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(member)}
                          title="Bearbeiten"
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(member.id)}
                          title="Löschen"
                          className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingMember ? t("editTitle") : t("createTitle")}
            </DialogTitle>
          </DialogHeader>
          <TeamMemberForm
            initial={editingMember ?? undefined}
            existingGroups={existingGroups}
            onSubmit={handleFormSubmit}
            onCancel={() => setDialogOpen(false)}
            isLoading={formLoading}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mitglied löschen</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">{t("confirmDelete")}</p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setDeletingId(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              onClick={() => deletingId && handleDelete(deletingId)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Löschen
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
