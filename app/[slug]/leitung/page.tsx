export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { Users, Mail } from "lucide-react";
import { resolveMosqueBySlug } from "@/lib/resolve-mosque";
import { getPortalSettings } from "@/lib/actions/settings";
import { getActiveTeamMembers } from "@/lib/actions/team";
import { getAuthFromCookie } from "@/lib/auth-cookie";
import { getTranslations } from "next-intl/server";
import type { TeamMember } from "@/types";
import { TEAM_GROUP_KEYS, TEAM_ROLE_KEYS } from "@/lib/constants";

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || "";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const mosque = await resolveMosqueBySlug(params.slug);
  if (!mosque) return { title: "Nicht gefunden" };
  return {
    title: `Leitung & Team – ${mosque.name}`,
    description: `Vorstand, Imame und Mitarbeiter der Gemeinde ${mosque.name}.`,
  };
}

function getPhotoUrl(member: TeamMember): string | null {
  if (!member.photo) return null;
  return `${PB_URL}/api/files/team_members/${member.id}/${member.photo}?thumb=200x200`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function LeitungPage({
  params,
}: {
  params: { slug: string };
}) {
  const mosque = await resolveMosqueBySlug(params.slug);
  if (!mosque) notFound();

  const t = await getTranslations("team");

  // Check if team module is enabled
  const settingsResult = await getPortalSettings(mosque.id);
  const settings = settingsResult.settings;
  if (!settings?.team_enabled) notFound();

  // Visibility guard
  if (settings.team_visibility === "members") {
    const { isActiveMember } = getAuthFromCookie();
    if (!isActiveMember) notFound();
  }

  // Load active members
  const membersResult = await getActiveTeamMembers(mosque.id);
  const members = membersResult.data ?? [];

  function getRoleLabel(key: string): string {
    if ((TEAM_ROLE_KEYS as readonly string[]).includes(key)) {
      return t(`roles.${key}` as Parameters<typeof t>[0]);
    }
    return key;
  }

  function getGroupLabel(key: string): string {
    if ((TEAM_GROUP_KEYS as readonly string[]).includes(key)) {
      return t(`groups.${key}` as Parameters<typeof t>[0]);
    }
    return key || t("ungrouped");
  }

  // Group members (preserve sort_order within groups, order groups by first member's sort_order)
  const groupOrder: string[] = [];
  const groupMap: Record<string, TeamMember[]> = {};

  members.forEach((member) => {
    const key = member.group?.trim() || "";
    if (!groupMap[key]) {
      groupMap[key] = [];
      groupOrder.push(key);
    }
    groupMap[key].push(member);
  });

  const groups = groupOrder.map((name) => ({ name, members: groupMap[name] }));
  const showGroupHeaders = groups.length > 1;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">

        {/* Page Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
            <Users className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("pageTitle")}</h1>
            <p className="text-sm text-gray-500">{mosque.name}</p>
          </div>
        </div>

        {/* Content */}
        {members.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">{t("noMembers")}</p>
          </div>
        ) : (
          <div className="space-y-10">
            {groups.map(({ name, members: groupMembers }) => (
              <section key={name}>
                {showGroupHeaders && (
                  <h2 className="mb-4 text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
                    {getGroupLabel(name)}
                  </h2>
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groupMembers.map((member) => {
                    const photoUrl = getPhotoUrl(member);
                    return (
                      <div
                        key={member.id}
                        className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                      >
                        {/* Avatar */}
                        <div className="mb-4 flex justify-center">
                          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-emerald-100">
                            {photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={photoUrl}
                                alt={member.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-xl font-bold text-emerald-700">
                                {getInitials(member.name)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 text-center">
                          <p className="text-base font-semibold text-gray-900">{member.name}</p>
                          <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                            {getRoleLabel(member.role)}
                          </span>
                          {member.bio && (
                            <p className="mt-3 text-sm text-gray-600 line-clamp-3 leading-relaxed">
                              {member.bio}
                            </p>
                          )}
                        </div>

                        {/* E-Mail */}
                        {member.email && (
                          <div className="mt-4 border-t border-gray-100 pt-4 text-center">
                            <a
                              href={`mailto:${member.email}`}
                              className="inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:underline"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              {t("emailContact")}
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Back link */}
        <div className="mt-10">
          <Link
            href={`/${params.slug}`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            {t("backToHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
