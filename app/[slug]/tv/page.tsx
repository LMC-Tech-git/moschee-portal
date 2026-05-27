import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolveMosqueWithSettings } from "@/lib/resolve-mosque";
import { getTVSettings } from "@/lib/actions/settings";
import { resolveTVColors } from "@/lib/tv-colors";
import { buildTVSlides } from "./build-slides";
import { verifyPreviewToken } from "./preview-token";
import { TVClient } from "@/components/tv/TVClient";
import type { TVLocaleConfig, TVTimeContext } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatYmdInTz(ms: number, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default async function TVPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { preview?: string };
}) {
  const result = await resolveMosqueWithSettings(params.slug);
  if (!result) notFound();
  const { mosque, settings } = result;

  const tv = await getTVSettings(mosque.id);

  // Preview-Token akzeptieren (zeigt TV auch wenn tv_enabled=false)
  const previewToken = searchParams.preview;
  const validPreview = previewToken ? verifyPreviewToken(previewToken, mosque.id) : false;

  if (!tv.tv_enabled && !validPreview) notFound();

  const tz = mosque.timezone || "Europe/Berlin";
  const nowMs = Date.now();
  const currentDateYmd = formatYmdInTz(nowMs, tz);

  // Base-URL aus Request-Host
  const hdrs = await headers();
  const host = hdrs.get("host") || "";
  const proto = hdrs.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  const { slides, prayerData, nextPrayerAtMs, currentPrayerStartedAtMs, currentPrayerName } = await buildTVSlides({
    mosque,
    settings,
    tv,
    currentDateYmd,
    nowMs,
    baseUrl,
  });

  const colors = resolveTVColors(mosque, tv);

  const localeConfig: TVLocaleConfig = {
    mode: tv.tv_locale_mode,
    primary: tv.tv_locale_primary,
    secondary: tv.tv_locale_mode === "single" ? "none" : tv.tv_locale_secondary,
    rotateSeconds: tv.tv_locale_rotate_seconds,
  };

  const timeContext: TVTimeContext = {
    mosqueTimezone: tz,
    serverTimestampMs: nowMs,
    currentDateInMosqueTz: currentDateYmd,
  };

  const pbRealtimeUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL || "";

  return (
    <TVClient
      slides={slides}
      prayerData={prayerData}
      rotationMs={tv.tv_rotation_seconds * 1000}
      colors={colors}
      localeConfig={localeConfig}
      showArabicPrayerNames={tv.tv_show_arabic_prayer_names}
      mosqueId={mosque.id}
      mosqueName={mosque.name}
      mosqueSlug={mosque.slug}
      mosqueLogoUrl={
        mosque.brand_logo && pbRealtimeUrl
          ? `${pbRealtimeUrl}/api/files/mosques/${mosque.id}/${mosque.brand_logo}`
          : null
      }
      pbRealtimeUrl={pbRealtimeUrl}
      timeContext={timeContext}
      nextPrayerAtMs={nextPrayerAtMs}
      currentPrayerStartedAtMs={currentPrayerStartedAtMs}
      currentPrayerName={currentPrayerName}
      highlightActivePrayer={tv.tv_highlight_active_prayer}
      highlightDurationMs={tv.tv_highlight_duration_seconds * 1000}
    />
  );
}
