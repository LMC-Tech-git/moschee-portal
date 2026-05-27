"use client";

import { useEffect, useMemo, useState } from "react";
import type { TVPrayerName, TVPrayerSlideData } from "@/types";
import { ARABIC_PRAYER_NAMES, wallClockToUtcMs } from "@/app/[slug]/tv/active-prayer";
import { getNextPrayerKey } from "@/lib/prayer/highlight";
import type { PrayerTimes } from "@/lib/prayer";
import { tvT } from "./tv-i18n";
import { useTVLocale } from "./LocaleAwareText";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Rekonstruiert ein `PrayerTimes`-Subset aus `prayerData.times`
 * (Header braucht es nur als HH:mm-Lookup für getNextPrayerKey).
 */
function buildTimesLookup(times: TVPrayerSlideData["times"]): PrayerTimes {
  const out: Partial<Record<TVPrayerName, string>> = {};
  for (const p of times) out[p.name] = p.time;
  return {
    fajr: out.fajr || "",
    sabah: out.sabah,
    sunrise: out.sunrise || "",
    dhuhr: out.dhuhr || "",
    asr: out.asr || "",
    maghrib: out.maghrib || "",
    isha: out.isha || "",
    date: "",
    hijriDate: "",
    provider: "aladhan",
  };
}

export function PrayerHeader({
  prayerData,
  mosqueName,
  mosqueLogoUrl,
  showArabicPrayerNames,
  clientOffsetMs,
  mosqueTimezone,
  currentDateYmd,
}: {
  prayerData: TVPrayerSlideData | null;
  mosqueName: string;
  mosqueLogoUrl: string | null;
  showArabicPrayerNames: boolean;
  clientOffsetMs: number;
  mosqueTimezone: string;
  currentDateYmd: string;
}) {
  const { primary, secondary } = useTVLocale();
  const tPrim = tvT(primary);
  const tSec = secondary !== "none" && secondary !== primary ? tvT(secondary) : null;

  const timesLookup = useMemo(
    () => (prayerData ? buildTimesLookup(prayerData.times) : null),
    [prayerData]
  );

  // Initial-Highlight + Countdown vom Server-Snapshot (für SSR), dann clientseitig live nachziehen
  const [nowMs, setNowMs] = useState(() => Date.now() + clientOffsetMs);
  const [nextKey, setNextKey] = useState<TVPrayerName | null>(() => {
    if (!timesLookup) return null;
    return (getNextPrayerKey(timesLookup, new Date(Date.now() + clientOffsetMs), mosqueTimezone) as TVPrayerName | null) ?? null;
  });

  useEffect(() => {
    let lastNextKey = nextKey;
    const tick = () => {
      const now = Date.now() + clientOffsetMs;
      setNowMs(now);
      if (timesLookup) {
        const newNext = getNextPrayerKey(timesLookup, new Date(now), mosqueTimezone) as TVPrayerName | null;
        if (newNext !== lastNextKey) {
          lastNextKey = newNext;
          setNextKey(newNext);
        }
      }
    };
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [clientOffsetMs, timesLookup, mosqueTimezone, nextKey]);

  // Countdown ms zum nächsten Gebet
  const nextPrayerAtMs: number | null = useMemo(() => {
    if (!nextKey || !timesLookup) return null;
    const t = timesLookup[nextKey];
    if (!t) return null;
    return wallClockToUtcMs(currentDateYmd, t, mosqueTimezone);
  }, [nextKey, timesLookup, currentDateYmd, mosqueTimezone]);

  const remainingMs = nextPrayerAtMs ? nextPrayerAtMs - nowMs : 0;

  if (!prayerData) {
    return (
      <header className="tv-header">
        <div className="tv-header-top">
          <div className="tv-brand">
            {mosqueLogoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mosqueLogoUrl} alt="" className="tv-brand-logo" />
            )}
            <span className="tv-brand-name">{mosqueName}</span>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="tv-header">
      {/* Top strip: Brand + Hijri */}
      <div className="tv-header-top">
        <div className="tv-brand">
          {mosqueLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mosqueLogoUrl} alt="" className="tv-brand-logo" />
          )}
          <span className="tv-brand-name">{mosqueName}</span>
        </div>

        {prayerData.hijriDate && (
          <div className="tv-hijri">{prayerData.hijriDate}</div>
        )}
      </div>

      {/* Prayer grid */}
      <div className="tv-prayer-grid">
        {prayerData.times.map((p) => {
          const isNext = nextKey === p.name;
          const showCountdown = isNext && remainingMs > 0;
          return (
            <div
              key={p.name}
              className={`tv-prayer-cell${isNext ? " is-next" : ""}`}
            >
              {showArabicPrayerNames && (
                <div className="tv-prayer-arabic">{ARABIC_PRAYER_NAMES[p.name]}</div>
              )}
              <div className="tv-prayer-name">{tPrim.prayers[p.name]}</div>
              {tSec && (
                <div className="tv-prayer-name-secondary">{tSec.prayers[p.name]}</div>
              )}
              <div className="tv-prayer-time">{p.time || "--:--"}</div>
              {showCountdown && (
                <div className="tv-prayer-countdown">
                  <span className="tv-prayer-countdown-dot" />
                  <span>{formatRemaining(remainingMs)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </header>
  );
}
