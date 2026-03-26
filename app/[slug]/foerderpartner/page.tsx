export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { Handshake } from "lucide-react";
import { resolveMosqueBySlug } from "@/lib/resolve-mosque";
import { getTranslations } from "next-intl/server";
import { getActiveSponsors } from "@/lib/actions/sponsors";
import { getPortalSettings } from "@/lib/actions/settings";
import { getAuthFromCookie } from "@/lib/auth-cookie";
import SponsorGrid from "@/components/sponsors/SponsorGrid";

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
  const settings = settingsResult.settings;
  if (!settings?.sponsors_enabled) notFound();

  // Visibility guard
  if (settings.sponsors_visibility === "members") {
    const { isActiveMember } = getAuthFromCookie();
    if (!isActiveMember) notFound();
  }

  // Load active sponsors
  const sponsorsResult = await getActiveSponsors(mosque.id);
  const sponsors = sponsorsResult.data ?? [];

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

        {/* Client-side filter + grid */}
        <SponsorGrid sponsors={sponsors} />

        {/* Back Link */}
        <div className="mt-10">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            {t("backToHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
