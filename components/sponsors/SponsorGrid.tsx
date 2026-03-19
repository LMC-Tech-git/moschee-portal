"use client";

import { useState } from "react";
import { ExternalLink, Handshake } from "lucide-react";
import { sponsorCategoryLabels, sponsorCategoryColors } from "@/lib/constants";
import type { Sponsor, SponsorCategory } from "@/types";
import { useTranslations } from "next-intl";

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || "";

/** Strip protocol + trailing slash for display */
function displayUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

export default function SponsorGrid({ sponsors }: { sponsors: Sponsor[] }) {
  const t = useTranslations("sponsors");
  const [activeCategory, setActiveCategory] = useState<SponsorCategory | null>(null);

  // Categories that have at least one sponsor
  const presentCategories = Array.from(
    new Set(sponsors.map((s) => s.category).filter(Boolean) as SponsorCategory[])
  );

  const filtered = activeCategory
    ? sponsors.filter((s) => s.category === activeCategory)
    : sponsors;

  return (
    <>
      {/* Category Filter */}
      {presentCategories.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeCategory === null
                ? "bg-emerald-600 text-white"
                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t("filterAll")} ({sponsors.length})
          </button>
          {presentCategories.map((cat) => {
            const count = sponsors.filter((s) => s.category === cat).length;
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(isActive ? null : cat)}
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-600 text-white"
                    : `${sponsorCategoryColors[cat]} hover:opacity-80`
                }`}
              >
                {sponsorCategoryLabels[cat]} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <Handshake className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-500">{t("noSponsors")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((sponsor) => {
            const logoUrl = sponsor.logo
              ? `${PB_URL}/api/files/sponsors/${sponsor.id}/${sponsor.logo}?thumb=160x160`
              : null;

            return (
              <div
                key={sponsor.id}
                className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
              >
                {/* Logo */}
                <div className="flex h-32 items-center justify-center border-b border-gray-100 bg-gray-50 p-4">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt={sponsor.name}
                      className="max-h-24 max-w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-gray-100">
                      <span className="text-2xl font-bold text-gray-400">
                        {sponsor.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold text-gray-900">{sponsor.name}</h2>
                    {sponsor.category && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${sponsorCategoryColors[sponsor.category]}`}
                      >
                        {sponsorCategoryLabels[sponsor.category]}
                      </span>
                    )}
                  </div>

                  {sponsor.description && (
                    <p className="mb-3 flex-1 text-sm text-gray-600 leading-relaxed">
                      {sponsor.description}
                    </p>
                  )}

                  {sponsor.website_url && (
                    <a
                      href={sponsor.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      {displayUrl(sponsor.website_url)}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
