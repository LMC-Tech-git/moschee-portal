import { Suspense } from "react";
import { notFound } from "next/navigation";
import { resolveMosqueWithSettings } from "@/lib/resolve-mosque";
import { getBrandColor } from "@/lib/constants";
import type { Mosque, Settings } from "@/types";
import { DemoReturnButton } from "@/components/shared/DemoReturnButton";
import { TokenReceiver } from "@/components/shared/TokenReceiver";

/**
 * Server-seitiges Layout für Slug-basierte öffentliche Seiten.
 * Löst die Moschee anhand des Slugs auf und stellt die Daten bereit.
 */
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const result = await resolveMosqueWithSettings(params.slug);
  if (!result) return { title: "Nicht gefunden" };

  const title = `${result.mosque.name} — Digitales Gemeinde-Portal`;
  const description = `Willkommen beim digitalen Portal der ${result.mosque.name}${result.mosque.city ? ` in ${result.mosque.city}` : ""}. Gebetszeiten, Veranstaltungen, Spenden und mehr.`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://moschee.app/${params.slug}`,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: `https://moschee.app/${params.slug}`,
      siteName: "moschee.app",
    },
  };
}

export default async function SlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const result = await resolveMosqueWithSettings(params.slug);

  if (!result) {
    notFound();
  }

  const { mosque, settings } = result;

  const primaryColor = getBrandColor(
    mosque.brand_theme || "emerald",
    mosque.brand_primary_color || ""
  );
  const accentColor = mosque.brand_accent_color || "#d97706";

  const isDemoBanner =
    process.env.NEXT_PUBLIC_DEMO_MOSQUE_ID !== "" &&
    mosque.id === process.env.NEXT_PUBLIC_DEMO_MOSQUE_ID;

  return (
    <div
      data-mosque-id={mosque.id}
      data-mosque-slug={mosque.slug}
      style={
        {
          "--brand-primary": primaryColor,
          "--brand-accent": accentColor,
        } as React.CSSProperties
      }
    >
      <Suspense fallback={null}>
        <TokenReceiver />
      </Suspense>
      {isDemoBanner && (
        <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <span>
              ⚠️ <strong>Demo-Modus</strong> — Alle Daten können jederzeit zurückgesetzt werden.
            </span>
          </div>
          <DemoReturnButton />
        </div>
      )}
      {children}
    </div>
  );
}
