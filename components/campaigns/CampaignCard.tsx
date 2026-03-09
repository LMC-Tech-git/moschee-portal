import { Heart, Users } from "lucide-react";
import { formatCurrencyCents } from "@/lib/utils";
import type { CampaignWithProgress } from "@/types";

const categoryLabels: Record<CampaignWithProgress["category"], string> = {
  ramadan: "Ramadan",
  construction: "Bau",
  aid: "Hilfe",
  maintenance: "Instandhaltung",
  general: "Allgemein",
};

const categoryColors: Record<CampaignWithProgress["category"], string> = {
  ramadan: "bg-green-100 text-green-700",
  construction: "bg-blue-100 text-blue-700",
  aid: "bg-red-100 text-red-700",
  maintenance: "bg-amber-100 text-amber-700",
  general: "bg-gray-100 text-gray-700",
};

interface CampaignCardProps {
  campaign: CampaignWithProgress;
  compact?: boolean;
}

export function CampaignCard({ campaign, compact }: CampaignCardProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900">
            {campaign.title}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[campaign.category]}`}
            >
              {categoryLabels[campaign.category]}
            </span>
            <span>
              {formatCurrencyCents(campaign.raised_cents)} /{" "}
              {formatCurrencyCents(campaign.goal_amount_cents)}
            </span>
          </div>
        </div>
        {/* Progress Mini */}
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${campaign.progress_percent}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-600">
            {campaign.progress_percent}%
          </span>
        </div>
      </div>
    );
  }

  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="p-5">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryColors[campaign.category]}`}
          >
            {categoryLabels[campaign.category]}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              campaign.status === "active"
                ? "bg-green-100 text-green-700"
                : campaign.status === "completed"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600"
            }`}
          >
            {campaign.status === "active"
              ? "Aktiv"
              : campaign.status === "completed"
                ? "Abgeschlossen"
                : "Pausiert"}
          </span>
        </div>

        {/* Titel */}
        <h2 className="mb-2 text-lg font-bold text-gray-900">
          {campaign.title}
        </h2>

        {/* Beschreibung */}
        {campaign.description && (
          <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-gray-600">
            {campaign.description}
          </p>
        )}

        {/* Progress */}
        <div className="mb-2">
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-semibold text-emerald-700">
              {formatCurrencyCents(campaign.raised_cents)}
            </span>
            <span className="text-gray-500">
              von {formatCurrencyCents(campaign.goal_amount_cents)}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${campaign.progress_percent}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3" aria-hidden="true" />
            {campaign.progress_percent}% erreicht
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" aria-hidden="true" />
            {campaign.donor_count} Spender
          </span>
        </div>
      </div>
    </article>
  );
}
