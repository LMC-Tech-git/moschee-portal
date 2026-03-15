// Immer dynamisch rendern — PocketBase-Daten (Kampagnenfortschritt) dürfen nicht gecacht werden
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, TrendingUp, Heart, Search } from "lucide-react";
import { resolveMosqueBySlug } from "@/lib/resolve-mosque";
import { getTranslations } from "next-intl/server";
import { getPublicCampaigns } from "@/lib/actions/campaigns";
import { CampaignCard } from "@/components/campaigns/CampaignCard";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const mosque = await resolveMosqueBySlug(params.slug);
  if (!mosque) return { title: "Nicht gefunden" };
  const t = await getTranslations("publicCampaigns");
  const title = t("metaTitle", { mosque: mosque.name });
  const description = t("metaDesc", { mosque: mosque.name });
  return {
    title,
    description,
    alternates: {
      canonical: `https://moschee.app/${params.slug}/campaigns`,
    },
    openGraph: {
      title,
      description,
      type: "website" as const,
      url: `https://moschee.app/${params.slug}/campaigns`,
      siteName: "moschee.app",
    },
  };
}

export default async function CampaignsPage({
  params,
}: {
  params: { slug: string };
}) {
  const mosque = await resolveMosqueBySlug(params.slug);
  if (!mosque) notFound();
  const t = await getTranslations("publicCampaigns");

  const result = await getPublicCampaigns(mosque.id, 50);
  const campaigns = result.success ? result.data || [] : [];

  return (
    <div className="py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Zurück */}
        <Link
          href={`/${params.slug}`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("back")}
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">
                {t("title")}
              </h1>
              <p className="text-sm text-gray-500">{mosque.name}</p>
            </div>
          </div>
          <p className="mt-3 text-gray-600">
            {t("subtitle")}
          </p>
        </div>

        {/* Kampagnen-Liste */}
        {campaigns.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
            <Search className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="font-medium text-gray-500">
              {t("empty")}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {t("emptyHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/${params.slug}/campaigns/${campaign.id}`}
                className="block transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded-xl"
              >
                <CampaignCard campaign={campaign} />
              </Link>
            ))}
          </div>
        )}

        {/* Allgemein spenden CTA */}
        <div className="mt-10 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 text-center">
          <Heart className="mx-auto mb-3 h-8 w-8 text-amber-500" />
          <p className="font-semibold text-gray-800">
            {t("ctaTitle")}
          </p>
          <p className="mt-1 mb-4 text-sm text-gray-600">
            {t("ctaDesc")}
          </p>
          <Link
            href={`/${params.slug}/donate`}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-bold text-white shadow transition-colors hover:bg-amber-600"
          >
            <Heart className="h-4 w-4" />
            {t("ctaBtn")}
          </Link>
        </div>
      </div>
    </div>
  );
}
