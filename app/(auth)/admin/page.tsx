"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Target,
  Heart,
  UserCheck,
  Clock,
  FileText,
  CalendarDays,
  ArrowRight,
  Banknote,
  BookOpen,
  Mail,
  Link2,
  ClipboardList,
  Settings,
  Handshake,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import { formatCurrencyCents } from "@/lib/utils";
import { getDashboardStats, type DashboardStats } from "@/lib/actions/dashboard";
import { DemoHint } from "@/components/demo/DemoHint";

export default function AdminDashboard() {
  const t = useTranslations();
  const { mosqueId, isLoading: mosqueLoading, teamEnabled, sponsorsEnabled } = useMosque();
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0,
    activeMembers: 0,
    pendingMembers: 0,
    activeCampaigns: 0,
    totalDonationsCents: 0,
    campaignDonationsCents: 0,
    publishedPosts: 0,
    upcomingEvents: 0,
    totalEvents: 0,
    upcomingEventsThisMonth: 0,
    registrationsThisMonth: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Super Admin ohne gewählte Moschee → Plattform-Dashboard
  useEffect(() => {
    if (!mosqueLoading && user?.role === "super_admin" && !mosqueId) {
      router.replace("/admin/platform");
    }
  }, [mosqueLoading, user?.role, mosqueId, router]);

  useEffect(() => {
    if (!mosqueId) return;

    getDashboardStats(mosqueId)
      .then(setStats)
      .catch((error) => console.error("Dashboard-Statistiken Fehler:", error))
      .finally(() => setIsLoading(false));
  }, [mosqueId]);

  const statCards = [
    { title: t("admin.stat.members"), value: stats.totalMembers, icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { title: t("admin.stat.active"), value: stats.activeMembers, icon: UserCheck, color: "text-emerald-600", bg: "bg-emerald-100" },
    { title: t("admin.stat.pending"), value: stats.pendingMembers, icon: Clock, color: "text-amber-600", bg: "bg-amber-100" },
    { title: t("admin.stat.posts"), value: stats.publishedPosts, icon: FileText, color: "text-indigo-600", bg: "bg-indigo-100" },
    { title: t("admin.stat.events"), value: stats.totalEvents, icon: CalendarDays, color: "text-cyan-600", bg: "bg-cyan-100" },
    { title: t("admin.stat.campaigns"), value: stats.activeCampaigns, icon: Target, color: "text-purple-600", bg: "bg-purple-100" },
    { title: t("admin.stat.donations"), value: formatCurrencyCents(stats.totalDonationsCents), icon: Heart, color: "text-rose-600", bg: "bg-rose-100" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("admin.dashboard.title")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("admin.dashboard.subtitle")}
        </p>
      </div>

      {/* Demo-Hinweise */}
      <DemoHint
        id="admin-dashboard"
        title={t("admin.dashboard.welcome.title")}
        description={t("admin.dashboard.welcome.desc")}
        className="mb-4"
      />

      {/* Statistik-Karten */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 sm:gap-4 sm:p-5"
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11 ${card.bg}`}>
                <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-gray-500">{card.title}</p>
                <p className="text-base font-bold text-gray-900 sm:text-xl">
                  {isLoading ? "…" : card.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <DemoHint
        id="admin-stats"
        title={t("admin.dashboard.liveStats.title")}
        description={t("admin.dashboard.liveStats.desc")}
      />

      {/* Schnellzugriff */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            title: t("admin.quickAccess.posts.title"),
            desc: t("admin.quickAccess.posts.desc"),
            href: "/admin/posts",
            icon: FileText,
            color: "text-indigo-600",
          },
          {
            title: t("admin.quickAccess.events.title"),
            desc: t("admin.quickAccess.events.desc"),
            href: "/admin/events",
            icon: CalendarDays,
            color: "text-cyan-600",
          },
          {
            title: t("admin.quickAccess.members.title"),
            desc: t("admin.quickAccess.members.desc"),
            href: "/admin/mitglieder",
            icon: Users,
            color: "text-blue-600",
            badge: stats.pendingMembers > 0 ? t("admin.quickAccess.members.pending", { count: stats.pendingMembers }) : undefined,
          },
          {
            title: t("admin.quickAccess.campaigns.title"),
            desc: t("admin.quickAccess.campaigns.desc"),
            href: "/admin/kampagnen",
            icon: Target,
            color: "text-purple-600",
          },
          {
            title: t("admin.quickAccess.donations.title"),
            desc: t("admin.quickAccess.donations.desc"),
            href: "/admin/spenden",
            icon: Banknote,
            color: "text-rose-600",
          },
          {
            title: t("admin.quickAccess.madrasa.title"),
            desc: t("admin.quickAccess.madrasa.desc"),
            href: "/admin/madrasa",
            icon: BookOpen,
            color: "text-amber-600",
          },
          ...(sponsorsEnabled ? [{
            title: t("admin.quickAccess.sponsors.title"),
            desc: t("admin.quickAccess.sponsors.desc"),
            href: "/admin/foerderpartner",
            icon: Handshake,
            color: "text-emerald-600",
          }] : []),
          ...(teamEnabled ? [{
            title: t("admin.quickAccess.team.title"),
            desc: t("admin.quickAccess.team.desc"),
            href: "/admin/leitung",
            icon: Users,
            color: "text-blue-600",
          }] : []),
          {
            title: t("admin.quickAccess.newsletter.title"),
            desc: t("admin.quickAccess.newsletter.desc"),
            href: "/admin/newsletter",
            icon: Mail,
            color: "text-violet-600",
          },
          {
            title: t("admin.quickAccess.invites.title"),
            desc: t("admin.quickAccess.invites.desc"),
            href: "/admin/invites",
            icon: Link2,
            color: "text-teal-600",
          },
          {
            title: t("admin.quickAccess.audit.title"),
            desc: t("admin.quickAccess.audit.desc"),
            href: "/admin/audit",
            icon: ClipboardList,
            color: "text-slate-600",
          },
          {
            title: t("admin.quickAccess.settings.title"),
            desc: t("admin.quickAccess.settings.desc"),
            href: "/admin/settings",
            icon: Settings,
            color: "text-gray-600",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className={`h-5 w-5 shrink-0 ${item.color}`} />
                  <h3 className="truncate font-bold text-gray-900">{item.title}</h3>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="line-clamp-2 text-sm text-gray-600">{item.desc}</p>
              {item.badge && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                  {item.badge}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
