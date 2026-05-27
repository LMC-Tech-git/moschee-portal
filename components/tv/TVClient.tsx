"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TVColors, TVLocale, TVLocaleConfig, TVSlide, TVTimeContext } from "@/types";
import { TVLocaleProvider } from "./LocaleAwareText";
import { PrayerSlide } from "./slides/PrayerSlide";
import { EventsSlide } from "./slides/EventsSlide";
import { PostsSlide } from "./slides/PostsSlide";
import { CampaignsSlide } from "./slides/CampaignsSlide";
import { QRDonateSlide } from "./slides/QRDonateSlide";
import { AnnouncementSlide } from "./slides/AnnouncementSlide";
import { ActivePrayerSlide } from "./slides/ActivePrayerSlide";
import { ARABIC_PRAYER_NAMES } from "@/app/[slug]/tv/active-prayer";
import { msUntilNextMidnight } from "@/app/[slug]/tv/midnight-rollover";

export function TVClient({
  slides,
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
  currentPrayerStartedAtMs: _currentPrayerStartedAtMs,
  highlightActivePrayer,
  highlightDurationMs,
}: {
  slides: TVSlide[];
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

  // Periodischer Server-Sync alle 30 min gegen langfristige Browser-Uhr-Drift
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

  // Visibility-API: Refresh wenn lange unsichtbar
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
    if (activePrayerOverride) return; // pausieren während Override
    if (slides.length <= 1) return;
    const i = setInterval(() => {
      if (document.hidden) return;
      setTransitioning(true);
      if (transitionTimeout.current) clearTimeout(transitionTimeout.current);
      transitionTimeout.current = setTimeout(() => {
        setSlideIndex((idx) => (idx + 1) % slides.length);
        setTransitioning(false);
      }, 300);
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
      if (transitioning) return; // Sync-Lock während Slide-Transition
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
    const prayerSlide = slides.find((s) => s.type === "prayer");
    if (prayerSlide && prayerSlide.type === "prayer") return prayerSlide.data.nextPrayer;
    return null;
  }, [slides]);

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

  // Realtime: PocketBase-Subscriptions auf settings/events/posts/campaigns
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
        // pocketbase nicht verfügbar / disconnect
      }
    })();

    // Fallback-Polling alle 10 min
    const poll = setInterval(() => router.refresh(), 10 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      if (cleanup) cleanup();
    };
  }, [pbRealtimeUrl, mosqueId, router]);

  // Service-Worker auf TV-Route deaktivieren (kein veralteter Content)
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

  return (
    <TVLocaleProvider value={localeCtx}>
      <div
        onClick={requestFullscreen}
        dir={dir}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          backgroundColor: colors.bg,
          color: colors.text,
          overflow: "hidden",
          cursor: "none",
          paddingTop: "2vh",
          paddingBottom: "2vh",
          paddingLeft: "2vw",
          paddingRight: "2vw",
        }}
      >
        {/* Header: Logo + Moschee-Name (immer sichtbar) */}
        <div
          style={{
            position: "absolute",
            top: "2vh",
            left: "2vw",
            display: "flex",
            alignItems: "center",
            gap: "1.5vw",
            opacity: 0.85,
          }}
        >
          {mosqueLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mosqueLogoUrl} alt="" style={{ height: "5vh", width: "auto" }} />
          )}
          <span style={{ fontSize: "2.5vh", fontWeight: 600, color: colors.text }}>{mosqueName}</span>
        </div>

        {/* Slug-Footer */}
        <div
          style={{
            position: "absolute",
            bottom: "2vh",
            right: "2vw",
            fontSize: "1.8vh",
            opacity: 0.4,
            color: colors.text,
          }}
        >
          {mosqueSlug}.moschee.app/tv
        </div>

        {/* Slide-Inhalt mit Crossfade */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "opacity 300ms ease",
            opacity: transitioning ? 0 : 1,
          }}
        >
          {slideToRender && renderSlide(slideToRender, colors, showArabicPrayerNames, clientOffsetMs, timeContext.mosqueTimezone)}
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
  mosqueTimezone: string
) {
  switch (slide.type) {
    case "prayer":
      return (
        <PrayerSlide
          data={slide.data}
          colors={colors}
          showArabicPrayerNames={showArabicPrayerNames}
          clientOffsetMs={clientOffsetMs}
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
    case "announcement":
      return <AnnouncementSlide data={slide.data} colors={colors} />;
    default:
      return null;
  }
}
