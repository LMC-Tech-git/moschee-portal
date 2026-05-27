/**
 * Baut das Slide-Array aus Settings + parallel geladenen Daten.
 * Leere Module werden übersprungen (außer prayer — immer dabei, wenn Modul an).
 */
import { getPublicUpcomingEvents } from "@/lib/actions/events";
import { getPublicPostsByMosque } from "@/lib/actions/posts";
import { getPublicCampaigns } from "@/lib/actions/campaigns";
import { getPrayerTimesForDate, buildPrayerConfig } from "@/lib/prayer";
import type { Mosque, Settings, TVSlide, TVPrayerSlideData, TVModuleKey } from "@/types";
import type { TVSettingsResolved } from "@/lib/actions/settings";
import { computeActivePrayer, wallClockToUtcMs } from "./active-prayer";

const POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || "";

async function generateQrSvg(url: string): Promise<string> {
  try {
    const mod = await import("qrcode");
    const svg = await mod.toString(url, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 600,
    });
    return svg;
  } catch {
    return "";
  }
}

function postImageUrl(postId: string, fileName: string): string | null {
  if (!fileName || !POCKETBASE_URL) return null;
  return `${POCKETBASE_URL}/api/files/posts/${postId}/${fileName}`;
}

export type BuildSlidesInput = {
  mosque: Mosque;
  settings: Settings;
  tv: TVSettingsResolved;
  currentDateYmd: string;
  nowMs: number;
  baseUrl: string;
};

export type BuildSlidesResult = {
  slides: TVSlide[];
  prayerData: TVPrayerSlideData | null;
  nextPrayerAtMs: number | null;
  currentPrayerStartedAtMs: number | null;
  currentPrayerName: string | null;
};

export async function buildTVSlides(input: BuildSlidesInput): Promise<BuildSlidesResult> {
  const { mosque, settings, tv, currentDateYmd, nowMs, baseUrl } = input;

  // Prayer-Times laden (auch wenn Modul aus — für active-prayer-Override)
  // WICHTIG: Datum aus currentDateYmd in Moschee-TZ konstruieren (mittag UTC = sicher gleicher Tag)
  // damit Provider auf UTC-Servern um Mitternacht nicht den Vortag lädt.
  const config = buildPrayerConfig(mosque, settings);
  const [ymdY, ymdM, ymdD] = currentDateYmd.split("-").map(Number);
  const dateForProvider = new Date(Date.UTC(ymdY, ymdM - 1, ymdD, 12, 0, 0));
  const times = await getPrayerTimesForDate(mosque.id, dateForProvider, config);

  let prayerData: TVPrayerSlideData | null = null;
  let nextPrayerAtMs: number | null = null;
  let currentPrayerStartedAtMs: number | null = null;
  let currentPrayerName: string | null = null;

  if (times) {
    const active = computeActivePrayer(times, mosque.timezone || "Europe/Berlin", currentDateYmd, nowMs);
    nextPrayerAtMs = active.nextPrayerAtMs;
    currentPrayerStartedAtMs = active.currentPrayerStartedAtMs;
    currentPrayerName = active.currentPrayer;

    const PRAYER_NAMES = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"] as const;
    prayerData = {
      times: PRAYER_NAMES.map((name) => ({
        name,
        time: times[name] || "",
        isNext: name === active.nextPrayer,
      })),
      nextPrayer: active.nextPrayer,
      nextPrayerAtMs: active.nextPrayerAtMs,
      hijriDate: tv.tv_show_hijri ? times.hijriDate || null : null,
    };
  }

  // Parallel-Load nur was aktiv ist
  const wantEvents = tv.tv_modules.events;
  const wantPosts = tv.tv_modules.posts;
  const wantCampaigns = tv.tv_modules.campaigns;

  const [eventsRes, postsRes, campaignsRes] = await Promise.all([
    wantEvents ? getPublicUpcomingEvents(mosque.id, tv.tv_module_counts.events ?? 3) : Promise.resolve(null),
    wantPosts ? getPublicPostsByMosque(mosque.id, tv.tv_module_counts.posts ?? 1) : Promise.resolve(null),
    wantCampaigns ? getPublicCampaigns(mosque.id, tv.tv_module_counts.campaigns ?? 1) : Promise.resolve(null),
  ]);

  const events = eventsRes?.success ? eventsRes.data : [];
  const posts = postsRes?.success ? postsRes.data : [];
  const campaigns = campaignsRes?.success ? campaignsRes.data : [];

  // QR-SVG vorbereiten wenn QR-Modul an
  let qrSvg = "";
  const donateUrl = `${baseUrl}/${mosque.slug}/donate`;
  if (tv.tv_modules.qr_donate) {
    qrSvg = await generateQrSvg(donateUrl);
  }

  // Slides nach tv_slide_order aufbauen
  const slides: TVSlide[] = [];
  for (const key of tv.tv_slide_order) {
    if (!tv.tv_modules[key]) continue;

    if (key === "prayer") {
      if (prayerData) slides.push({ type: "prayer", data: prayerData });
      continue;
    }

    if (key === "events") {
      if (events && events.length > 0) {
        slides.push({
          type: "events",
          data: events.slice(0, tv.tv_module_counts.events ?? 3).map((e) => ({
            id: e.id,
            title: e.title,
            startAtIso: e.start_at,
            location: e.location_name || "",
          })),
        });
      }
      continue;
    }

    if (key === "posts") {
      if (posts && posts.length > 0) {
        slides.push({
          type: "posts",
          data: posts.slice(0, tv.tv_module_counts.posts ?? 1).map((p) => ({
            id: p.id,
            title: p.title,
            excerpt: (p.content || "").slice(0, 300),
            imageUrl: postImageUrl(p.id, (p.attachments ?? [])[0] ?? ""),
          })),
        });
      }
      continue;
    }

    if (key === "campaigns") {
      if (campaigns && campaigns.length > 0) {
        const c = campaigns[0];
        slides.push({
          type: "campaigns",
          data: {
            id: c.id,
            title: c.title,
            goalCents: c.goal_amount_cents,
            raisedCents: c.raised_cents,
          },
        });
      }
      continue;
    }

    if (key === "qr_donate") {
      slides.push({
        type: "qr_donate",
        data: { url: donateUrl, svg: qrSvg },
      });
      continue;
    }

    if (key === "announcement") {
      const textPrimary = tv.tv_announcement_text.trim();
      const textSecondary = tv.tv_announcement_text_secondary.trim();
      if (textPrimary || textSecondary) {
        slides.push({
          type: "announcement",
          data: { textPrimary, textSecondary },
        });
      }
      continue;
    }
  }

  // Empty-State-Fallback
  if (slides.length === 0 && prayerData) {
    slides.push({ type: "prayer", data: prayerData });
  }

  return { slides, prayerData, nextPrayerAtMs, currentPrayerStartedAtMs, currentPrayerName };
}

export type { TVModuleKey };
