// Immer dynamisch rendern — Kampagnenfortschritt muss immer aktuell sein
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Heart, Users, Calendar, TrendingUp } from "lucide-react";
import { resolveMosqueBySlug } from "@/lib/resolve-mosque";
import { getCampaignById } from "@/lib/actions/campaigns";
import { formatCurrencyCents, formatDate } from "@/lib/utils";
import { campaignCategoryLabels, campaignCategoryColors } from "@/lib/constants";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || "";

export async function generateMetadata({
  params,
}: {
  params: { slug: string; id: string };
}) {
  try {
    const mosque = await resolveMosqueBySlug(params.slug);
    const result = await getCampaignById(params.id, mosque?.id ?? "");
    if (!result.success || !result.data) return { title: "Kampagne" };
    const title = `${result.data.title} | ${mosque?.name ?? "Gemeinde"}`;
    const description = result.data.description
      ? result.data.description.slice(0, 160)
      : `Spendenaufruf der ${mosque?.name ?? "Gemeinde"}`;
    return {
      title,
      description,
      alternates: { canonical: `https://moschee.app/${params.slug}/campaigns/${params.id}` },
      openGraph: { title, description, type: "article" as const },
    };
  } catch {
    return { title: "Kampagne" };
  }
}

export default async function PublicCampaignPage({
  params,
}: {
  params: { slug: string; id: string };
}) {
  const mosque = await resolveMosqueBySlug(params.slug);
  if (!mosque) notFound();

  const result = await getCampaignById(params.id, mosque.id);
  if (!result.success || !result.data || result.data.status !== "active") {
    notFound();
  }

  const campaign = result.data;
  const isGoalReached = campaign.progress_percent >= 100;

  return (
    <>
      {/* Header */}
      <section
        className="py-10"
        style={{
          background:
            "linear-gradient(to bottom right, var(--brand-primary, #059669), color-mix(in srgb, var(--brand-primary, #059669) 80%, transparent))",
        }}
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Link
            href={`/${params.slug}/campaigns`}
            className="mb-4 inline-flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Alle Kampagnen
          </Link>

          <div className="mb-3 flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${campaignCategoryColors[campaign.category]}`}
            >
              {campaignCategoryLabels[campaign.category]}
            </span>
            {isGoalReached && (
              <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                Ziel erreicht!
              </span>
            )}
          </div>

          <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
            {campaign.title}
          </h1>
        </div>
      </section>

      {/* Inhalt */}
      <section className="py-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-8">

          {/* Cover-Bild */}
          {campaign.cover_image && (
            <div className="relative overflow-hidden rounded-xl bg-gray-100" style={{ maxHeight: "400px", minHeight: "200px" }}>
              <Image
                src={`${PB_URL}/api/files/campaigns/${campaign.id}/${campaign.cover_image}`}
                alt={campaign.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 800px"
              />
            </div>
          )}

          {/* Fortschritt */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <h2 className="font-bold text-gray-900">Spendenfortschritt</h2>
            </div>

            <div>
              <div className="mb-2 flex items-end justify-between">
                <div>
                  <p className="text-2xl font-extrabold text-emerald-700">
                    {formatCurrencyCents(campaign.raised_cents)}
                  </p>
                  <p className="text-sm text-gray-500">
                    von {formatCurrencyCents(campaign.goal_amount_cents)} Ziel
                  </p>
                </div>
                <p className="text-3xl font-extrabold text-gray-800">
                  {campaign.progress_percent}%
                </p>
              </div>
              <Progress
                value={Math.min(campaign.progress_percent, 100)}
                className="h-3"
                aria-label={`${campaign.title}: ${campaign.progress_percent}% erreicht`}
              />
            </div>

            <div className="flex flex-wrap gap-4 pt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {campaign.donor_count} Spender
              </span>
              {campaign.end_at && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  Endet am {formatDate(campaign.end_at)}
                </span>
              )}
            </div>
          </div>

          {/* Beschreibung */}
          {campaign.description && (
            <div>
              <h2 className="mb-3 font-bold text-gray-900">Über diese Kampagne</h2>
              <div className="whitespace-pre-wrap text-base leading-relaxed text-gray-700">
                {campaign.description}
              </div>
            </div>
          )}

          {/* Spenden CTA */}
          <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 text-center">
            <Heart className="mx-auto mb-3 h-8 w-8 text-amber-500" />
            <p className="mb-1 font-semibold text-gray-800">
              Unterstützen Sie diese Kampagne
            </p>
            <p className="mb-5 text-sm text-gray-600">
              Jede Spende hilft uns, unser Ziel zu erreichen.
            </p>
            <Button asChild className="bg-amber-500 hover:bg-amber-600 px-8 font-bold">
              <Link href={`/${params.slug}/donate?campaign=${campaign.id}`}>
                <Heart className="mr-2 h-4 w-4" />
                Für diese Kampagne spenden
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
