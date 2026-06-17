"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TVColors, TVLocale, TVLocaleConfig, TVPrayerSlideData, TVSlide, TVTimeContext } from "@/types";
import { TVLocaleProvider } from "./LocaleAwareText";
import { TVTopBar, PrayerRail } from "./PrayerHeader";
import { PrayerSlide } from "./slides/PrayerSlide";
import { EventsSlide } from "./slides/EventsSlide";
import { PostsSlide } from "./slides/PostsSlide";
import { CampaignsSlide } from "./slides/CampaignsSlide";
import { QRDonateSlide } from "./slides/QRDonateSlide";
import { QRTransferSlide } from "./slides/QRTransferSlide";
import { AnnouncementSlide } from "./slides/AnnouncementSlide";
import { ActivePrayerSlide } from "./slides/ActivePrayerSlide";
import { ARABIC_PRAYER_NAMES } from "@/app/[slug]/tv/active-prayer";
import { msUntilNextMidnight } from "@/app/[slug]/tv/midnight-rollover";

export function TVClient({
  slides,
  prayerData,
  rotationMs,
  colors,
  localeConfig,
  showArabicPrayerNames,
  mosqueId,
  mosqueName,
  mosqueSlug,
  mosqueLogoUrl,
  pbRealtimeUrl,
  timeContext,
  nextPrayerAtMs,
  currentPrayerStartedAtMs,
  currentPrayerName,
  highlightActivePrayer,
  highlightDurationMs,
}: {
  slides: TVSlide[];
  prayerData: TVPrayerSlideData | null;
  rotationMs: number;
  colors: TVColors;
  localeConfig: TVLocaleConfig;
  showArabicPrayerNames: boolean;
  mosqueId: string;
  mosqueName: string;
  mosqueSlug: string;
  mosqueLogoUrl: string | null;
  pbRealtimeUrl: string;
  timeContext: TVTimeContext;
  nextPrayerAtMs: number | null;
  currentPrayerStartedAtMs: number | null;
  currentPrayerName: string | null;
  highlightActivePrayer: boolean;
  highlightDurationMs: number;
}) {
  const router = useRouter();
  const [slideIndex, setSlideIndex] = useState(0);
  const [activePrayerOverride, setActivePrayerOverride] = useState<TVSlide | null>(null);
  const [currentLocale, setCurrentLocale] = useState<TVLocale>(localeConfig.primary);
  const [transitioning, setTransitioning] = useState(false);
  const transitionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Server-Client-Drift-Offset
  const [clientOffsetMs, setClientOffsetMs] = useState<number>(
    () => timeContext.serverTimestampMs - Date.now()
  );

  // Effective now = client + offset
  const effectiveNow = useCallback(() => Date.now() + clientOffsetMs, [clientOffsetMs]);

  // Periodischer Server-Sync alle 30 min
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      try {
        const res = await fetch("/api/tv/time", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { serverTimestampMs: number };
        if (cancelled || typeof json.serverTimestampMs !== "number") return;
        setClientOffsetMs(json.serverTimestampMs - Date.now());
      } catch {
        // ignore
      }
    };
    const i = setInterval(sync, 30 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(i);
    };
  }, []);

  // Mitternachts-Rollover in Moschee-TZ
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      const ms = msUntilNextMidnight(timeContext.mosqueTimezone);
      timeout = setTimeout(() => {
        router.refresh();
        schedule();
      }, ms);
    };
    schedule();
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [router, timeContext.mosqueTimezone]);

  // Visibility-API
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVis = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt) {
        const hiddenMs = Date.now() - hiddenAt;
        hiddenAt = null;
        if (hiddenMs > 60_000) router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [router]);

  // Slide-Rotation
  useEffect(() => {
    if (activePrayerOverride) return;
    if (slides.length <= 1) return;
    const i = setInterval(() => {
      if (document.hidden) return;
      setTransitioning(true);
      if (transitionTimeout.current) clearTimeout(transitionTimeout.current);
      transitionTimeout.current = setTimeout(() => {
        setSlideIndex((idx) => (idx + 1) % slides.length);
        setTransitioning(false);
      }, 500);
    }, rotationMs);
    return () => clearInterval(i);
  }, [rotationMs, slides.length, activePrayerOverride]);

  // Sprach-Rotation (nur im 'rotate'-Modus)
  useEffect(() => {
    if (localeConfig.mode !== "rotate") {
      setCurrentLocale(localeConfig.primary);
      return;
    }
    const ms = localeConfig.rotateSeconds * 1000;
    const i = setInterval(() => {
      if (document.hidden) return;
      if (transitioning) return;
      setCurrentLocale((cur) =>
        cur === localeConfig.primary
          ? (localeConfig.secondary as TVLocale)
          : localeConfig.primary
      );
    }, ms);
    return () => clearInterval(i);
  }, [localeConfig.mode, localeConfig.primary, localeConfig.secondary, localeConfig.rotateSeconds, transitioning]);

  // Active-Prayer-Override Trigger
  const nextPrayerName = useMemo(() => {
    if (prayerData?.nextPrayer) return prayerData.nextPrayer;
    return null;
  }, [prayerData]);

  useEffect(() => {
    if (!highlightActivePrayer || !nextPrayerAtMs || !nextPrayerName) return;
    const check = () => {
      const now = effectiveNow();
      if (now >= nextPrayerAtMs && now < nextPrayerAtMs + highlightDurationMs) {
        setActivePrayerOverride({
          type: "active_prayer",
          data: {
            prayer: nextPrayerName,
            arabicName: ARABIC_PRAYER_NAMES[nextPrayerName],
            startedAtMs: nextPrayerAtMs,
          },
        });
      } else if (activePrayerOverride && now >= nextPrayerAtMs + highlightDurationMs) {
        setActivePrayerOverride(null);
        router.refresh();
      }
    };
    check();
    const i = setInterval(check, 5000);
    return () => clearInterval(i);
  }, [highlightActivePrayer, nextPrayerAtMs, highlightDurationMs, nextPrayerName, effectiveNow, activePrayerOverride, router]);

  // Realtime PocketBase-Subscriptions
  useEffect(() => {
    if (!pbRealtimeUrl || !mosqueId) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const { default: PocketBase } = await import("pocketbase");
        const pb = new PocketBase(pbRealtimeUrl);
        const unsubs: Array<() => void> = [];
        const debouncedRefresh = (() => {
          let t: ReturnType<typeof setTimeout> | null = null;
          return () => {
            if (t) clearTimeout(t);
            t = setTimeout(() => router.refresh(), 800);
          };
        })();

        const collections = ["settings", "events", "posts", "campaigns"];
        for (const col of collections) {
          try {
            const unsub = await pb.collection(col).subscribe("*", (e) => {
              const rec = e.record as { mosque_id?: string };
              if (rec.mosque_id === mosqueId) debouncedRefresh();
            });
            unsubs.push(unsub);
          } catch {
            // ignore single subscription errors
          }
        }
        if (cancelled) {
          unsubs.forEach((u) => u());
          return;
        }
        cleanup = () => unsubs.forEach((u) => u());
      } catch {
        // pocketbase nicht verfügbar
      }
    })();

    const poll = setInterval(() => router.refresh(), 10 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      if (cleanup) cleanup();
    };
  }, [pbRealtimeUrl, mosqueId, router]);

  // Service-Worker unregister auf TV-Route
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister().catch(() => undefined));
    }).catch(() => undefined);
  }, []);

  const slideToRender: TVSlide | undefined = activePrayerOverride || slides[slideIndex];

  const localeCtx = useMemo(
    () => ({
      mode: localeConfig.mode,
      currentLocale: localeConfig.mode === "single" || localeConfig.mode === "bilingual" ? localeConfig.primary : currentLocale,
      primary: localeConfig.primary,
      secondary: localeConfig.secondary,
    }),
    [localeConfig.mode, localeConfig.primary, localeConfig.secondary, currentLocale]
  );

  const requestFullscreen = useCallback(() => {
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => undefined);
    }
  }, []);

  const dir = localeCtx.currentLocale === "ar" ? "rtl" : "ltr";

  // Suppress unused warnings for currently-untracked vars (reserved for future iqama feature)
  void currentPrayerStartedAtMs;
  void currentPrayerName;

  return (
    <TVLocaleProvider value={localeCtx}>
      <div
        className="tv-root"
        onClick={requestFullscreen}
        dir={dir}
        style={{
          ["--accent" as string]: colors.accent,
          ["--bg" as string]: colors.bg,
          ["--text" as string]: colors.text,
        }}
      >
        <div className="tv-bg-mesh" aria-hidden />

        <div className="tv-content">
          <TVTopBar
            mosqueName={mosqueName}
            mosqueLogoUrl={mosqueLogoUrl}
            hijriDate={prayerData?.hijriDate ?? null}
            mosqueTimezone={timeContext.mosqueTimezone}
            clientOffsetMs={clientOffsetMs}
          />

          <main className="tv-stage">
            <div className={`tv-slide${transitioning ? " is-out" : ""}`}>
              {slideToRender && renderSlide(slideToRender, colors, showArabicPrayerNames, clientOffsetMs, timeContext.mosqueTimezone, timeContext.currentDateInMosqueTz)}
            </div>

            <div className="tv-footer-url">{mosqueSlug}.moschee.app/tv</div>
          </main>

          <PrayerRail
            prayerData={prayerData}
            clientOffsetMs={clientOffsetMs}
            mosqueTimezone={timeContext.mosqueTimezone}
          />
        </div>
      </div>
    </TVLocaleProvider>
  );
}

function renderSlide(
  slide: TVSlide,
  colors: TVColors,
  showArabicPrayerNames: boolean,
  clientOffsetMs: number,
  mosqueTimezone: string,
  currentDateYmd: string
) {
  switch (slide.type) {
    case "prayer":
      return (
        <PrayerSlide
          data={slide.data}
          colors={colors}
          showArabicPrayerNames={showArabicPrayerNames}
          clientOffsetMs={clientOffsetMs}
          mosqueTimezone={mosqueTimezone}
          currentDateYmd={currentDateYmd}
        />
      );
    case "active_prayer":
      return <ActivePrayerSlide data={slide.data} colors={colors} />;
    case "events":
      return <EventsSlide data={slide.data} colors={colors} mosqueTimezone={mosqueTimezone} />;
    case "posts":
      return <PostsSlide data={slide.data} colors={colors} />;
    case "campaigns":
      return <CampaignsSlide data={slide.data} colors={colors} />;
    case "qr_donate":
      return <QRDonateSlide data={slide.data} colors={colors} />;
    case "qr_transfer":
      return <QRTransferSlide data={slide.data} colors={colors} />;
    case "announcement":
      return <AnnouncementSlide data={slide.data} colors={colors} />;
    default:
      return null;
  }
}
