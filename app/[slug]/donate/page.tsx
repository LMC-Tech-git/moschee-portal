import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Heart, TrendingUp } from "lucide-react";
import { resolveMosqueWithSettings } from "@/lib/resolve-mosque";
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
  const title = `Spenden | ${result.mosque.name}`;
  const description = `Unterstützen Sie die ${result.mosque.name} mit einer Spende. Sichere Online-Zahlung über Stripe.`;
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

  // Spenden-Schnellbeträge aus Settings parsen (z.B. "10,25,50,100" → Cents-Array)
  const quickAmounts = (settings.donation_quick_amounts || "10,25,50,100")
    .split(",")
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n) && n > 0)
    .map((n) => Math.round(n * 100));

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
          Zurück zum Dashboard
        </Link>

        {/* Erfolgs-Banner */}
        {searchParams.success && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <Heart className="h-6 w-6 flex-shrink-0 text-emerald-500" />
            <div>
              <p className="font-semibold text-emerald-800">
                Vielen Dank für Ihre Spende!
              </p>
              <p className="text-sm text-emerald-700">
                Ihre Zahlung wurde erfolgreich übermittelt. Wir sind sehr
                dankbar für Ihre Unterstützung.
              </p>
            </div>
          </div>
        )}

        {/* Abbruch-Banner */}
        {searchParams.cancelled && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Der Zahlungsvorgang wurde abgebrochen. Sie können es jederzeit
            erneut versuchen.
          </div>
        )}

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-gray-900">
            Spenden an {mosque.name}
          </h1>
          <p className="mt-2 text-gray-600">
            Unterstützen Sie unsere Gemeinde mit einer Spende.
          </p>
        </div>

        {/* Kampagnen-Auswahl (nur wenn keine vorausgewählt und Kampagnen vorhanden) */}
        {!preselectedCampaign && campaigns.length > 0 && (
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <h2 className="font-bold text-gray-900">Aktive Kampagnen</h2>
              </div>
              <Link
                href={`/${params.slug}/campaigns`}
                className="text-xs font-medium text-emerald-600 hover:underline"
              >
                Alle anzeigen
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
                oder allgemein spenden
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
                Spende für:
              </span>
              <Link
                href={`/${params.slug}/donate`}
                className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
              >
                Allgemeine Spende wählen
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
                    gesammelt
                  </span>
                  <span>
                    {preselectedCampaign.progress_percent}% von{" "}
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
