"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Target,
  FileText,
  CalendarDays,
  Mail,
  BookOpen,
  Link2,
  ChevronLeft,
  Shield,
  Banknote,
  Settings,
  ClipboardList,
  Globe,
  Crown,
  Edit3,
  Handshake,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useMosque } from "@/lib/mosque-context";
import { MoscheeSelektor } from "@/components/admin/MoscheeSelektor";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

// Rollen mit eingeschränktem Zugriff: erlaubte Routen-Prefixe
const EDITOR_ALLOWED_PREFIXES = [
  "/admin/posts",
  "/admin/events",
  "/admin/kampagnen",
];
const MADRASA_ADMIN_ALLOWED_PREFIXES = [
  "/admin/madrasa",
  "/admin/newsletter",
];
const TREASURER_ALLOWED_PREFIXES = [
  "/admin/spenden",
  "/admin/kampagnen",
];
const SECRETARY_ALLOWED_PREFIXES = [
  "/admin/mitglieder",
  "/admin/events",
  "/admin/newsletter",
  "/admin/invites",
];

// Standard-Redirect pro eingeschränkter Rolle
const ROLE_DEFAULT_REDIRECT: Record<string, string> = {
  editor:        "/admin/posts",
  madrasa_admin: "/admin/madrasa",
  treasurer:     "/admin/spenden",
  secretary:     "/admin/mitglieder",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("admin");
  const { user, isAuthenticated, isLoading } = useAuth();
  const { mosque } = useMosque();
  const router = useRouter();
  const pathname = usePathname();

  const role = user?.role;
  const canAccess =
    role === "admin" ||
    role === "super_admin" ||
    role === "editor" ||
    role === "madrasa_admin" ||
    role === "treasurer" ||
    role === "secretary";
  const isSuperAdmin = role === "super_admin";
  const isEditor = role === "editor";
  const isMadrasaAdmin = role === "madrasa_admin";
  const isTreasurer = role === "treasurer";
  const isSecretary = role === "secretary";
  const isRestrictedRole = isEditor || isMadrasaAdmin || isTreasurer || isSecretary;

  const adminNav = [
    {
      label: "Dashboard",
      href: "/admin",
      icon: LayoutDashboard,
      roles: ["admin", "super_admin"],
    },
    {
      label: t("quickAccess.posts.title"),
      href: "/admin/posts",
      icon: FileText,
      roles: ["admin", "super_admin", "editor"],
    },
    {
      label: t("quickAccess.events.title"),
      href: "/admin/events",
      icon: CalendarDays,
      roles: ["admin", "super_admin", "editor"],
    },
    {
      label: t("quickAccess.members.title"),
      href: "/admin/mitglieder",
      icon: Users,
      roles: ["admin", "super_admin", "secretary"],
    },
    {
      label: t("quickAccess.campaigns.title"),
      href: "/admin/kampagnen",
      icon: Target,
      roles: ["admin", "super_admin", "editor", "treasurer"],
    },
    {
      label: t("quickAccess.donations.title"),
      href: "/admin/spenden",
      icon: Banknote,
      roles: ["admin", "super_admin", "treasurer"],
    },
    {
      label: t("quickAccess.madrasa.title"),
      href: "/admin/madrasa",
      icon: BookOpen,
      roles: ["admin", "super_admin", "madrasa_admin"],
    },
    {
      label: t("quickAccess.sponsors.title"),
      href: "/admin/foerderpartner",
      icon: Handshake,
      roles: ["admin", "super_admin"],
    },
    {
      label: t("quickAccess.newsletter.title"),
      href: "/admin/newsletter",
      icon: Mail,
      roles: ["admin", "super_admin", "madrasa_admin", "secretary"],
    },
    {
      label: t("quickAccess.invites.title"),
      href: "/admin/invites",
      icon: Link2,
      roles: ["admin", "super_admin", "secretary"],
    },
    {
      label: t("quickAccess.audit.title"),
      href: "/admin/audit",
      icon: ClipboardList,
      roles: ["admin", "super_admin"],
    },
    {
      label: t("quickAccess.settings.title"),
      href: "/admin/settings",
      icon: Settings,
      roles: ["admin", "super_admin"],
    },
  ];

  // Zugangsschutz
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !canAccess)) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, canAccess, router]);

  // Eingeschränkte Rollen: Weiterleitung bei unerlaubten Routen
  useEffect(() => {
    if (!isLoading && isAuthenticated && isRestrictedRole) {
      let allowedPrefixes: string[] = [];
      if (isEditor)        allowedPrefixes = EDITOR_ALLOWED_PREFIXES;
      else if (isMadrasaAdmin) allowedPrefixes = MADRASA_ADMIN_ALLOWED_PREFIXES;
      else if (isTreasurer)    allowedPrefixes = TREASURER_ALLOWED_PREFIXES;
      else if (isSecretary)    allowedPrefixes = SECRETARY_ALLOWED_PREFIXES;

      const isAllowed = allowedPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
      );
      if (!isAllowed) {
        const defaultRedirect = ROLE_DEFAULT_REDIRECT[role ?? ""] ?? "/";
        router.replace(defaultRedirect);
      }
    }
  }, [isLoading, isRestrictedRole, isEditor, isMadrasaAdmin, isTreasurer, isSecretary, isAuthenticated, pathname, router, role]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600 motion-reduce:animate-none" />
          <p className="text-sm text-gray-500">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !canAccess) {
    return null;
  }

  // Nav-Items nach Rolle filtern
  const visibleNav = adminNav.filter((item) =>
    (item.roles as string[]).includes(role ?? "")
  );

  return (
    <div className="flex min-h-[calc(100vh-73px)]">
      {/* Sidebar — nur auf Desktop sichtbar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="flex h-full flex-col">
          {/* Sidebar Header */}
          <div className="border-b border-gray-100 px-4 py-4 space-y-3">
            <div className="flex items-center gap-2">
              {isSuperAdmin ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                  <Crown className="h-4 w-4 text-purple-600" />
                </div>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                  <Shield className="h-4 w-4 text-emerald-600" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {isSuperAdmin
                    ? t("platformAdmin")
                    : mosque?.name || t("panel")}
                </p>
                <p className="text-xs text-gray-500">
                  {isRestrictedRole && !isEditor ? user?.full_name : isEditor ? t("editorAccess") : user?.full_name}
                </p>
              </div>
            </div>

            {/* Moschee-Selektor für Super Admin */}
            {isSuperAdmin && <MoscheeSelektor />}

            {/* Plattform-Übersicht Link für Super Admin */}
            {isSuperAdmin && (
              <Link
                href="/admin/platform"
                className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors"
              >
                <Globe className="h-3.5 w-3.5" />
                {t("platformOverview")}
              </Link>
            )}

            {/* Rollen-Badges für eingeschränkte Rollen */}
            {isEditor && (
              <div className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                <Edit3 className="h-3.5 w-3.5" />
                {t("editorBadge")}
              </div>
            )}
            {isMadrasaAdmin && (
              <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                <BookOpen className="h-3.5 w-3.5" />
                {t("madrasaAdminBadge")}
              </div>
            )}
            {isTreasurer && (
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                <Banknote className="h-3.5 w-3.5" />
                {t("treasurerBadge")}
              </div>
            )}
            {isSecretary && (
              <div className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700">
                <Users className="h-3.5 w-3.5" />
                {t("secretaryBadge")}
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto space-y-1 px-3 py-4">
            {visibleNav.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Back to Portal + Language Switcher */}
          <div className="border-t border-gray-100 px-3 py-4 space-y-2">
            <div className="px-3">
              <LanguageSwitcher />
            </div>
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            >
              <ChevronLeft className="h-4 w-4" />
              {t("backToPortal")}
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
