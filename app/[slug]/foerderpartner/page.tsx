export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Handshake } from "lucide-react";
import { resolveMosqueBySlug } from "@/lib/resolve-mosque";
import { getTranslations } from "next-intl/server";
import { getActiveSponsors } from "@/lib/actions/sponsors";
import { getPortalSettings } from "@/lib/actions/settings";
import { sponsorCategoryLabels, sponsorCategoryColors } from "@/lib/constants";
import type { SponsorCategory } from "@/types";

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || "";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const mosque = await resolveMosqueBySlug(params.slug);
  if (!mosque) return { title: "Nicht gefunden" };
  return {
    title: `Förderpartner – ${mosque.name}`,
    description: `Lokale Unternehmen, die die Gemeinde ${mosque.name} unterstützen.`,
  };
}

export default async function FoerderpartnerPage({
  params,
}: {
  params: { slug: string };
}) {
  const mosque = await resolveMosqueBySlug(params.slug);
  if (!mosque) notFound();

  const t = await getTranslations("sponsors");

  // Check if sponsors module is enabled
  const settingsResult = await getPortalSettings(mosque.id);
  const sponsorsEnabled = settingsResult.settings?.sponsors_enabled ?? false;
  if (!sponsorsEnabled) notFound();

  // Load active sponsors
  const sponsorsResult = await getActiveSponsors(mosque.id);
  const sponsors = sponsorsResult.data ?? [];

  // Get unique categories that have active sponsors
  const presentCategories = Array.from(
    new Set(sponsors.map((s) => s.category).filter(Boolean) as SponsorCategory[])
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
            <Handshake className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("subtitle")}</h1>
            <p className="text-sm text-gray-500">{mosque.name}</p>
          </div>
        </div>

        {/* Intro Text */}
        <div className="mb-8 rounded-xl border border-emerald-100 bg-white p-6">
          <div className="prose prose-sm max-w-none text-gray-600">
            {t("intro").split("\n\n").map((para, i) => (
              <p key={i} className="mb-3 last:mb-0 text-sm leading-relaxed">
                {para}
              </p>
            ))}
          </div>
        </div>

        {/* Category Filter (client-side via search params or simple anchor tags) */}
        {presentCategories.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600">
              {t("filterAll")} ({sponsors.length})
            </span>
            {presentCategories.map((cat) => {
              const count = sponsors.filter((s) => s.category === cat).length;
              return (
                <span
                  key={cat}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${sponsorCategoryColors[cat]}`}
                >
                  {sponsorCategoryLabels[cat]} ({count})
                </span>
              );
            })}
          </div>
        )}

        {/* Sponsors Grid */}
        {sponsors.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
            <Handshake className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-gray-500">{t("noSponsors")}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sponsors.map((sponsor) => {
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
                        className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {t("visitWebsite")}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Back Link */}
        <div className="mt-10">
          <Link
            href={`/${params.slug}`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Zurück zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}
