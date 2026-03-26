import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolveMosqueWithSettings } from "@/lib/resolve-mosque";
import { getBrandColor } from "@/lib/constants";
import type { Mosque, Settings } from "@/types";
import { TokenReceiver } from "@/components/shared/TokenReceiver";
import { MosqueInitializer } from "@/components/shared/MosqueInitializer";

/**
 * Server-seitiges Layout für Slug-basierte öffentliche Seiten.
 * Löst die Moschee anhand des Slugs auf und stellt die Daten bereit.
 */
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "moschee.app";
  const hostname = (await headers()).get("host") || "";
  if (hostname === rootDomain || hostname === `www.${rootDomain}`) return {};

  const result = await resolveMosqueWithSettings(params.slug);
  if (!result) return { title: "Nicht gefunden" };

  const baseUrl = `https://${params.slug}.${rootDomain}`;
  const title = `${result.mosque.name} — Digitales Gemeinde-Portal`;
  const description = `Willkommen beim digitalen Portal der ${result.mosque.name}${result.mosque.city ? ` in ${result.mosque.city}` : ""}. Gebetszeiten, Veranstaltungen, Spenden und mehr.`;

  return {
    title,
    description,
    alternates: {
      canonical: baseUrl,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: baseUrl,
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

  // Gemeinde-Seiten nur über Subdomains erreichbar
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "moschee.app";
  const hostname = (await headers()).get("host") || "";
  if (hostname === rootDomain || hostname === `www.${rootDomain}`) notFound();

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
      <MosqueInitializer mosque={mosque} settings={settings} />
      {children}
    </div>
  );
}
