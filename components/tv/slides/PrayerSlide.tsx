"use client";

import { useEffect, useMemo, useState } from "react";
import type { TVColors, TVPrayerName, TVPrayerSlideData } from "@/types";
import { useTVLocale } from "../LocaleAwareText";
import { tvT } from "../tv-i18n";
import { ARABIC_PRAYER_NAMES, wallClockToUtcMs } from "@/app/[slug]/tv/active-prayer";
import { getNextPrayerKey } from "@/lib/prayer/highlight";
import type { PrayerTimes } from "@/lib/prayer";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

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

function nextDayYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Prayer-Focus-Slide (Hero):
 * Nächstes Gebet — Arabisch riesig + lokalisierter Name + Countdown.
 *
 * WICHTIG: Das "nächste" Gebet wird CLIENT-SEITIG live berechnet
 * (getNextPrayerKey, identisch zur Rail/Homepage). Vorher kam der Wert
 * statisch aus dem Server-Snapshot → bei lange offenem Tab driftete er
 * (z.B. "Fajr" am Mittag). Jetzt single source of truth.
 */
export function PrayerSlide({
  data,
  colors: _colors,
  showArabicPrayerNames,
  clientOffsetMs,
  mosqueTimezone,
  currentDateYmd,
}: {
  data: TVPrayerSlideData;
  colors: TVColors;
  showArabicPrayerNames: boolean;
  clientOffsetMs: number;
  mosqueTimezone: string;
  currentDateYmd: string;
}) {
  const { mode, currentLocale, secondary } = useTVLocale();
  const t = tvT(currentLocale);
  const tSec = mode === "bilingual" && secondary !== "none" ? tvT(secondary) : null;
  const [nowMs, setNowMs] = useState(() => Date.now() + clientOffsetMs);

  const timesLookup = useMemo(() => buildTimesLookup(data.times), [data.times]);

  useEffect(() => {
    const i = setInterval(() => setNowMs(Date.now() + clientOffsetMs), 1000);
    return () => clearInterval(i);
  }, [clientOffsetMs]);

  // Live nächstes Gebet + dessen Startzeit (UTC ms).
  const { nextName, nextAtMs } = useMemo(() => {
    const key = getNextPrayerKey(timesLookup, new Date(nowMs), mosqueTimezone) as TVPrayerName | null;
    if (key) {
      const time = timesLookup[key];
      return { nextName: key, nextAtMs: time ? wallClockToUtcMs(currentDateYmd, time, mosqueTimezone) : null };
    }
    // Alle Gebete heute vorbei → Fajr des Folgetags
    const fajr = timesLookup.fajr;
    return {
      nextName: "fajr" as TVPrayerName,
      nextAtMs: fajr ? wallClockToUtcMs(nextDayYmd(currentDateYmd), fajr, mosqueTimezone) : null,
    };
  }, [timesLookup, nowMs, mosqueTimezone, currentDateYmd]);

  const remainingMs = nextAtMs ? nextAtMs - nowMs : 0;

  if (!nextName) return null;

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        gap: "4vh",
        textAlign: "center",
        width: "100%",
      }}
    >
      <div className="tv-eyebrow">
        {mode === "bilingual" && tSec ? `${t.nextPrayer} · ${tSec.nextPrayer}` : t.nextPrayer}
      </div>

      {showArabicPrayerNames && (
        <div
          dir="rtl"
          style={{
            fontFamily: "var(--font-arabic)",
            fontSize: "var(--t-hero)",
            fontWeight: 700,
            color: "var(--accent)",
            lineHeight: 1,
          }}
        >
          {ARABIC_PRAYER_NAMES[nextName]}
        </div>
      )}

      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "var(--t-xl)",
          fontWeight: 600,
          color: "var(--text)",
          letterSpacing: "-0.01em",
        }}
      >
        {mode === "bilingual" && tSec ? (
          <>
            {t.prayers[nextName]}
            <span style={{ margin: "0 1.5vw", color: "var(--accent-hair)" }}>·</span>
            {tSec.prayers[nextName]}
          </>
        ) : (
          t.prayers[nextName]
        )}
      </div>

      {remainingMs > 0 && (
        <div style={{ display: "grid", placeItems: "center", gap: "1vh", marginTop: "1vh" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--t-small)",
              color: "var(--text-dim)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {mode === "bilingual" && tSec ? `${t.remaining} · ${tSec.remaining}` : t.remaining}
          </div>
          <div
            className="tv-stat"
            style={{
              fontSize: "var(--t-2xl)",
              color: "var(--accent)",
              lineHeight: 1,
            }}
          >
            {formatCountdown(remainingMs)}
          </div>
        </div>
      )}
    </div>
  );
}
