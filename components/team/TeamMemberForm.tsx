"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CreateTeamMemberInput, UpdateTeamMemberInput } from "@/lib/actions/team";
import type { TeamMember } from "@/types";

interface TeamMemberFormProps {
  initial?: TeamMember;
  existingGroups?: string[];
  onSubmit: (input: CreateTeamMemberInput | UpdateTeamMemberInput) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export default function TeamMemberForm({
  initial,
  existingGroups = [],
  onSubmit,
  onCancel,
  isLoading,
}: TeamMemberFormProps) {
  const t = useTranslations("team.admin");

  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [group, setGroup] = useState(initial?.group ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? 0);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);

  const uniqueGroups = Array.from(new Set(existingGroups.filter(Boolean)));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t("name") + " ist erforderlich.");
      return;
    }
    if (!role.trim()) {
      setError(t("role") + " ist erforderlich.");
      return;
    }
    if (bio.length > 500) {
      setError(t("bio") + " darf max. 500 Zeichen lang sein.");
      return;
    }

    await onSubmit({
      name: name.trim(),
      role: role.trim(),
      group: group.trim(),
      bio: bio.trim(),
      email: email.trim(),
      sort_order: sortOrder,
      is_active: isActive,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t("name")} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          maxLength={100}
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Rolle */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t("role")} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder={t("rolePlaceholder")}
          maxLength={100}
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Gruppe */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("group")}</label>
        <input
          type="text"
          list="team-groups-list"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          placeholder={t("groupPlaceholder")}
          maxLength={80}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        {uniqueGroups.length > 0 && (
          <datalist id="team-groups-list">
            {uniqueGroups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        )}
      </div>

      {/* Bio */}
      <div>
        <label className="mb-1 flex items-center justify-between text-sm font-medium text-gray-700">
          <span>{t("bio")}</span>
          <span className="text-xs text-gray-400">{t("chars", { count: bio.length })}</span>
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t("bioPlaceholder")}
          maxLength={500}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* E-Mail */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("email")}</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Reihenfolge + Aktiv */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("sortOrder")}</label>
          <input
            type="number"
            min={0}
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded text-emerald-600"
            />
            <span className="text-sm font-medium text-gray-700">{t("active")}</span>
          </label>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {isLoading ? "Wird gespeichert..." : "Speichern"}
        </button>
      </div>
    </form>
  );
}
