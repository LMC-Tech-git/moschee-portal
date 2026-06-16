"use client";

import { useEffect, useMemo, useState } from "react";
import type { TVPrayerName, TVPrayerSlideData } from "@/types";
import { getNextPrayerKey } from "@/lib/prayer/highlight";
import type { PrayerTimes } from "@/lib/prayer";
import { tvT } from "./tv-i18n";
import { ARABIC_PRAYER_NAMES } from "@/app/[slug]/tv/active-prayer";
import { useTVLocale } from "./LocaleAwareText";

const INTL_LOCALE: Record<string, string> = { de: "de-DE", tr: "tr-TR", ar: "ar", en: "en-GB" };

/**
 * Rekonstruiert ein `PrayerTimes`-Subset aus `prayerData.times`
 * (Rail braucht es nur als HH:mm-Lookup für getNextPrayerKey).
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

/**
 * Schlanke Top-Bar: Brand links, Wochentag + Hijri rechts.
 */
export function TVTopBar({
  mosqueName,
  mosqueLogoUrl,
  hijriDate,
  mosqueTimezone,
  clientOffsetMs,
}: {
  mosqueName: string;
  mosqueLogoUrl: string | null;
  hijriDate: string | null;
  mosqueTimezone: string;
  clientOffsetMs: number;
}) {
  const { currentLocale } = useTVLocale();
  const [nowMs, setNowMs] = useState(() => Date.now() + clientOffsetMs);

  useEffect(() => {
    const i = setInterval(() => setNowMs(Date.now() + clientOffsetMs), 30_000);
    return () => clearInterval(i);
  }, [clientOffsetMs]);

  const weekday = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(INTL_LOCALE[currentLocale] || "de-DE", {
        timeZone: mosqueTimezone,
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date(nowMs));
    } catch {
      return "";
    }
  }, [currentLocale, mosqueTimezone, nowMs]);

  return (
    <header className="tv-topbar">
      <div className="tv-brand">
        {mosqueLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mosqueLogoUrl} alt="" className="tv-brand-logo" />
        )}
        <span className="tv-brand-name">{mosqueName}</span>
      </div>
      <div className="tv-topbar-date">
        {weekday && <span className="tv-topbar-weekday">{weekday}</span>}
        {hijriDate && <span className="tv-topbar-hijri">{hijriDate}</span>}
      </div>
    </header>
  );
}

/**
 * Gebets-Raster als Leiste unten. Hebt das nächste anstehende Gebet hervor
 * (live nachgezogen via getNextPrayerKey — single source of truth mit Homepage).
 */
export function PrayerRail({
  prayerData,
  showArabicPrayerNames,
  clientOffsetMs,
  mosqueTimezone,
}: {
  prayerData: TVPrayerSlideData | null;
  showArabicPrayerNames: boolean;
  clientOffsetMs: number;
  mosqueTimezone: string;
}) {
  const { primary, secondary } = useTVLocale();
  const tPrim = tvT(primary);
  const tSec = secondary !== "none" && secondary !== primary ? tvT(secondary) : null;

  const timesLookup = useMemo(
    () => (prayerData ? buildTimesLookup(prayerData.times) : null),
    [prayerData]
  );

  const [nextKey, setNextKey] = useState<TVPrayerName | null>(() => {
    if (!timesLookup) return null;
    return (getNextPrayerKey(timesLookup, new Date(Date.now() + clientOffsetMs), mosqueTimezone) as TVPrayerName | null) ?? null;
  });

  useEffect(() => {
    let last = nextKey;
    const tick = () => {
      if (!timesLookup) return;
      const newNext = getNextPrayerKey(timesLookup, new Date(Date.now() + clientOffsetMs), mosqueTimezone) as TVPrayerName | null;
      if (newNext !== last) {
        last = newNext;
        setNextKey(newNext);
      }
    };
    const i = setInterval(tick, 5000);
    return () => clearInterval(i);
  }, [clientOffsetMs, timesLookup, mosqueTimezone, nextKey]);

  if (!prayerData) return null;

  return (
    <div className="tv-rail">
      {prayerData.times.map((p) => {
        const isNext = nextKey === p.name;
        return (
          <div key={p.name} className={`tv-rail-cell${isNext ? " is-next" : ""}`}>
            {showArabicPrayerNames && (
              <div className="tv-prayer-arabic">{ARABIC_PRAYER_NAMES[p.name]}</div>
            )}
            <div className="tv-prayer-name">{tPrim.prayers[p.name]}</div>
            {tSec && (
              <div className="tv-prayer-name-secondary">{tSec.prayers[p.name]}</div>
            )}
            <div className="tv-prayer-time">{p.time || "--:--"}</div>
          </div>
        );
      })}
    </div>
  );
}
