import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { resolveMosqueWithSettings } from "@/lib/resolve-mosque";
import { getBrandColor } from "@/lib/constants";
import type { Mosque, Settings } from "@/types";
import { DemoReturnButton } from "@/components/shared/DemoReturnButton";
import { TokenReceiver } from "@/components/shared/TokenReceiver";
import { MosqueInitializer } from "@/components/shared/MosqueInitializer";
import { AlertTriangle } from "lucide-react";

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
  // Locale-Codes niemals als Moschee-Slugs behandeln
  if (["de", "tr"].includes(params.slug)) notFound();

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

  const tBanner = isDemoBanner ? await getTranslations("demo.banner") : null;

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
      <MosqueInitializer mosque={mosque} />
      {isDemoBanner && tBanner && (
        <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <strong>{tBanner("title")}</strong> — {tBanner("message")}
            </span>
          </div>
          <DemoReturnButton />
        </div>
      )}
      {children}
    </div>
  );
}
