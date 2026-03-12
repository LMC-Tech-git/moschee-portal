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
} from "lucide-react";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import { formatCurrencyCents } from "@/lib/utils";
import { getDashboardStats, type DashboardStats } from "@/lib/actions/dashboard";

export default function AdminDashboard() {
  const { mosqueId, isLoading: mosqueLoading } = useMosque();
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
    { title: "Mitglieder", value: stats.totalMembers, icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { title: "Aktiv", value: stats.activeMembers, icon: UserCheck, color: "text-emerald-600", bg: "bg-emerald-100" },
    { title: "Ausstehend", value: stats.pendingMembers, icon: Clock, color: "text-amber-600", bg: "bg-amber-100" },
    { title: "Beiträge", value: stats.publishedPosts, icon: FileText, color: "text-indigo-600", bg: "bg-indigo-100" },
    { title: "Events", value: stats.totalEvents, icon: CalendarDays, color: "text-cyan-600", bg: "bg-cyan-100" },
    { title: "Kampagnen", value: stats.activeCampaigns, icon: Target, color: "text-purple-600", bg: "bg-purple-100" },
    { title: "Spenden", value: formatCurrencyCents(stats.totalDonationsCents), icon: Heart, color: "text-rose-600", bg: "bg-rose-100" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Übersicht über Ihre Gemeinde
        </p>
      </div>

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

      {/* Schnellzugriff */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            title: "Beiträge",
            desc: "Neuigkeiten für die Gemeinde veröffentlichen.",
            href: "/admin/posts",
            icon: FileText,
            color: "text-indigo-600",
          },
          {
            title: "Veranstaltungen",
            desc: "Events erstellen und Anmeldungen verwalten.",
            href: "/admin/events",
            icon: CalendarDays,
            color: "text-cyan-600",
          },
          {
            title: "Mitglieder",
            desc: "Mitglieder verwalten und Anträge freischalten.",
            href: "/admin/mitglieder",
            icon: Users,
            color: "text-blue-600",
            badge: stats.pendingMembers > 0 ? `${stats.pendingMembers} ausstehend` : undefined,
          },
          {
            title: "Kampagnen",
            desc: "Spendenkampagnen erstellen und verfolgen.",
            href: "/admin/kampagnen",
            icon: Target,
            color: "text-purple-600",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${item.color}`} />
                  <h3 className="font-bold text-gray-900">{item.title}</h3>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="text-sm text-gray-600">{item.desc}</p>
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
