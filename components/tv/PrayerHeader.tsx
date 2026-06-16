"use client";

import { useEffect, useMemo, useState } from "react";
import type { TVPrayerName, TVPrayerSlideData } from "@/types";
import { getNextPrayerKey } from "@/lib/prayer/highlight";
import { wallClockToUtcMs } from "@/app/[slug]/tv/active-prayer";
import type { PrayerTimes } from "@/lib/prayer";
import { tvT } from "./tv-i18n";
import { useTVLocale } from "./LocaleAwareText";

/** YYYY-MM-DD eines Zeitpunkts in der angegebenen IANA-Zeitzone. */
function ymdInTz(date: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

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
  clientOffsetMs,
  mosqueTimezone,
}: {
  prayerData: TVPrayerSlideData | null;
  clientOffsetMs: number;
  mosqueTimezone: string;
}) {
  const { currentLocale } = useTVLocale();
  const t = tvT(currentLocale);

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

  // Sekündlicher Countdown-Tick (server-korrigiert via clientOffsetMs).
  const [nowMs, setNowMs] = useState(() => Date.now() + clientOffsetMs);
  useEffect(() => {
    const i = setInterval(() => setNowMs(Date.now() + clientOffsetMs), 1000);
    return () => clearInterval(i);
  }, [clientOffsetMs]);

  // Ziel-Timestamp des nächsten Gebets (heute, oder morgen Fajr wenn alle vorbei).
  const countdown = useMemo(() => {
    if (!timesLookup) return null;
    const name: TVPrayerName = nextKey ?? "fajr";
    const time = timesLookup[name];
    if (!time) return null;
    const ymd = nextKey
      ? ymdInTz(new Date(nowMs), mosqueTimezone)
      : ymdInTz(new Date(nowMs + 86_400_000), mosqueTimezone);
    const targetMs = wallClockToUtcMs(ymd, time, mosqueTimezone);
    if (!Number.isFinite(targetMs)) return null;
    const totalSec = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      name,
      text: `${pad(Math.floor(totalSec / 3600))}:${pad(Math.floor((totalSec % 3600) / 60))}:${pad(totalSec % 60)}`,
    };
  }, [timesLookup, nextKey, nowMs, mosqueTimezone]);

  if (!prayerData) return null;

  return (
    <>
      {countdown && (
        <div className="tv-countdown">
          <span className="tv-countdown-label">
            {t.nextPrayer}: {t.prayers[countdown.name]}
          </span>
          <span className="tv-countdown-time" aria-hidden="true">
            {countdown.text}
          </span>
        </div>
      )}
      <div className="tv-rail">
        {prayerData.times.map((p) => {
          const isNext = nextKey === p.name;
          return (
            <div key={p.name} className={`tv-rail-cell${isNext ? " is-next" : ""}`}>
              <div className="tv-prayer-name">{t.prayers[p.name]}</div>
              <div className="tv-prayer-time">{p.time || "--:--"}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
