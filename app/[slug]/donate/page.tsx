import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Heart, TrendingUp } from "lucide-react";
import { resolveMosqueWithSettings } from "@/lib/resolve-mosque";
import { getTranslations } from "next-intl/server";
import { getPublicCampaigns, getCampaignById } from "@/lib/actions/campaigns";
import { DonationForm } from "./DonationForm";
import { CampaignCard } from "@/components/campaigns/CampaignCard";
import { formatCurrencyCents } from "@/lib/utils";
import type { CampaignWithProgress } from "@/types";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { campaign?: string };
}) {
  const result = await resolveMosqueWithSettings(params.slug);
  if (!result) return { title: "Nicht gefunden" };
  const t = await getTranslations("publicDonate");
  const title = t("metaTitle", { mosque: result.mosque.name });
  const description = t("metaDesc", { mosque: result.mosque.name });
  return {
    title,
    description,
    alternates: {
      canonical: `https://moschee.app/${params.slug}/donate`,
    },
    robots: searchParams?.campaign ? { index: false } : undefined,
    openGraph: {
      title,
      description,
      type: "website" as const,
      url: `https://moschee.app/${params.slug}/donate`,
      siteName: "moschee.app",
    },
  };
}

export default async function DonatePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { campaign?: string; success?: string; cancelled?: string };
}) {
  const result = await resolveMosqueWithSettings(params.slug);
  if (!result) notFound();
  const { mosque, settings } = result;
  const t = await getTranslations("publicDonate");

  // Spenden-Schnellbeträge aus Settings parsen (z.B. "10,25,50,100" → Cents-Array)
  const quickAmounts = (settings.donation_quick_amounts || "10,25,50,100")
    .split(",")
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n) && n > 0)
    .map((n) => Math.round(n * 100));

  const isDemoMosque =
    !!process.env.NEXT_PUBLIC_DEMO_MOSQUE_ID &&
    mosque.id === process.env.NEXT_PUBLIC_DEMO_MOSQUE_ID;

  // Kampagnen laden
  const campaignsResult = await getPublicCampaigns(mosque.id, 50);
  const campaigns = campaignsResult.success ? campaignsResult.data || [] : [];

  // Vorausgewählte Kampagne laden (falls per Query-Param angegeben)
  let preselectedCampaign: CampaignWithProgress | null = null;
  if (searchParams.campaign) {
    const campResult = await getCampaignById(searchParams.campaign, mosque.id);
    if (campResult.success && campResult.data?.status === "active") {
      preselectedCampaign = campResult.data;
    }
  }

  return (
    <div className="py-10">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        {/* Zurück */}
        <Link
          href={`/${params.slug}`}
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("back")}
        </Link>

        {/* Erfolgs-Banner */}
        {searchParams.success && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <Heart className="h-6 w-6 flex-shrink-0 text-emerald-500" />
            <div>
              <p className="font-semibold text-emerald-800">
                {t("thankYou")}
              </p>
              <p className="text-sm text-emerald-700">
                {t("thankYouDesc")}
              </p>
            </div>
          </div>
        )}

        {/* Demo: Stripe Test-Card Info */}
        {isDemoMosque && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <p className="mb-1.5 font-semibold">🧪 {t("demoTitle")}</p>
            <p className="mb-0.5">
              {t("demoCard")}{" "}
              <code className="rounded bg-blue-100 px-1 font-mono font-bold tracking-wider">
                4242 4242 4242 4242
              </code>
            </p>
            <p>
              {t("demoExpiry")}{" "}
              <code className="rounded bg-blue-100 px-1 font-mono">12/34</code>
              {"  "}{t("demoCvc")}{" "}
              <code className="rounded bg-blue-100 px-1 font-mono">123</code>
              {"  "}{t("demoZip")}{" "}
              <code className="rounded bg-blue-100 px-1 font-mono">12345</code>
            </p>
          </div>
        )}

        {/* Abbruch-Banner */}
        {searchParams.cancelled && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {t("cancelled")}
          </div>
        )}

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-gray-900">
            {t("title", { mosque: mosque.name })}
          </h1>
          <p className="mt-2 text-gray-600">
            {t("subtitle")}
          </p>
        </div>

        {/* Kampagnen-Auswahl (nur wenn keine vorausgewählt und Kampagnen vorhanden) */}
        {!preselectedCampaign && campaigns.length > 0 && (
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <h2 className="font-bold text-gray-900">{t("activeCampaigns")}</h2>
              </div>
              <Link
                href={`/${params.slug}/campaigns`}
                className="text-xs font-medium text-emerald-600 hover:underline"
              >
                {t("showAll")}
              </Link>
            </div>
            <div className="space-y-4">
              {campaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/${params.slug}/donate?campaign=${campaign.id}`}
                  className="block rounded-xl transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                >
                  <CampaignCard campaign={campaign} />
                </Link>
              ))}
            </div>
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 border-t border-gray-200" />
              <span className="whitespace-nowrap text-xs text-gray-400">
                {t("orGeneral")}
              </span>
              <div className="flex-1 border-t border-gray-200" />
            </div>
          </div>
        )}

        {/* Vorausgewählte Kampagne hervorheben */}
        {preselectedCampaign && (
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">
                {t("donateFor")}
              </span>
              <Link
                href={`/${params.slug}/donate`}
                className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
              >
                {t("selectGeneral")}
              </Link>
            </div>
            <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4">
              <p className="font-bold text-emerald-900">
                {preselectedCampaign.title}
              </p>
              {preselectedCampaign.description && (
                <p className="mt-1 line-clamp-2 text-sm text-emerald-700">
                  {preselectedCampaign.description}
                </p>
              )}
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-emerald-700">
                  <span>
                    {formatCurrencyCents(preselectedCampaign.raised_cents)}{" "}
                    {t("raised")}
                  </span>
                  <span>
                    {preselectedCampaign.progress_percent}{t("percentOf")}{" "}
                    {formatCurrencyCents(
                      preselectedCampaign.goal_amount_cents
                    )}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-emerald-200">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{
                      width: `${Math.min(
                        preselectedCampaign.progress_percent,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Spendenformular */}
        {/* key erzwingt Remount bei Kampagnenwechsel, damit useState neu initialisiert wird */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <DonationForm
            key={searchParams.campaign || "general"}
            slug={params.slug}
            mosqueId={mosque.id}
            campaigns={campaigns}
            preselectedCampaignId={searchParams.campaign}
            donationProvider={mosque.donation_provider}
            externalDonationUrl={mosque.external_donation_url}
            externalDonationLabel={mosque.external_donation_label}
            paypalDonateUrl={mosque.paypal_donate_url}
            quickAmounts={quickAmounts}
          />
        </div>
      </div>
    </div>
  );
}
