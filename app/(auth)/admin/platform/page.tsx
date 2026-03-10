"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Users,
  Heart,
  Target,
  ArrowRight,
  Globe,
} from "lucide-react";
import { getPlatformStats, type PlatformStats } from "@/lib/actions/dashboard";
import { formatCurrencyCents } from "@/lib/utils";
import { useMosque } from "@/lib/mosque-context";
import { useRouter } from "next/navigation";

export default function PlatformDashboard() {
  const { setMosqueOverride } = useMosque();
  const router = useRouter();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getPlatformStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleManageMosque = (mosqueId: string) => {
    setMosqueOverride(mosqueId);
    router.push("/admin");
  };

  const kpiCards = stats
    ? [
        {
          title: "Gemeinden",
          value: stats.totalMosques,
          icon: Building2,
          color: "text-purple-600",
          bg: "bg-purple-100",
        },
        {
          title: "Mitglieder gesamt",
          value: stats.totalMembers,
          icon: Users,
          color: "text-blue-600",
          bg: "bg-blue-100",
        },
        {
          title: "Aktive Kampagnen",
          value: stats.activeCampaigns,
          icon: Target,
          color: "text-amber-600",
          bg: "bg-amber-100",
        },
        {
          title: "Gesamtspenden",
          value: formatCurrencyCents(stats.totalDonationsCents),
          icon: Heart,
          color: "text-rose-600",
          bg: "bg-rose-100",
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
          <Globe className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Plattform-Übersicht
          </h1>
          <p className="text-sm text-gray-500">
            Statistiken über alle Gemeinden
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl bg-gray-100 p-4 h-24"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bg}`}
                  >
                    <Icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{card.title}</p>
                    <p className="text-xl font-bold text-gray-900">
                      {typeof card.value === "number"
                        ? card.value.toLocaleString("de-DE")
                        : card.value}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Moschee-Liste */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Alle Gemeinden
        </h2>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl bg-gray-100 h-16"
              />
            ))}
          </div>
        ) : stats?.mosques.length === 0 ? (
          <p className="text-sm text-gray-500">Keine Gemeinden vorhanden.</p>
        ) : (
          <div className="space-y-2">
            {stats?.mosques.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                    <Building2 className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{m.name}</p>
                    {m.city && (
                      <p className="text-xs text-gray-400">{m.city}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-gray-800">
                      {m.memberCount.toLocaleString("de-DE")}
                    </p>
                    <p className="text-xs text-gray-400">Mitglieder</p>
                  </div>
                  <button
                    onClick={() => handleManageMosque(m.id)}
                    className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                    type="button"
                  >
                    Verwalten
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
