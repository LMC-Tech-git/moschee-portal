"use client";

import { useEffect, useState } from "react";
import type { TVColors, TVPrayerSlideData } from "@/types";
import { useTVLocale } from "../LocaleAwareText";
import { tvT } from "../tv-i18n";
import { ARABIC_PRAYER_NAMES } from "@/app/[slug]/tv/active-prayer";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Prayer-Focus-Slide:
 * Da PrayerHeader bereits alle Zeiten kompakt oben zeigt, fokussiert dieser
 * Slide auf das nächste Gebet: Arabisch riesig + lokalisierter Name + Countdown.
 */
export function PrayerSlide({
  data,
  colors: _colors,
  showArabicPrayerNames,
  clientOffsetMs,
}: {
  data: TVPrayerSlideData;
  colors: TVColors;
  showArabicPrayerNames: boolean;
  clientOffsetMs: number;
}) {
  const { mode, currentLocale, secondary } = useTVLocale();
  const t = tvT(currentLocale);
  const tSec = mode === "bilingual" && secondary !== "none" ? tvT(secondary) : null;
  const [nowMs, setNowMs] = useState(() => Date.now() + clientOffsetMs);

  useEffect(() => {
    const i = setInterval(() => setNowMs(Date.now() + clientOffsetMs), 1000);
    return () => clearInterval(i);
  }, [clientOffsetMs]);

  const remainingMs = data.nextPrayerAtMs ? data.nextPrayerAtMs - nowMs : 0;
  const nextName = data.nextPrayer;

  if (!nextName) return null;

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        gap: "5vh",
        textAlign: "center",
        width: "100%",
      }}
    >
      <div className="tv-eyebrow">
        {mode === "bilingual" && tSec ? `${t.nextPrayer} · ${tSec.nextPrayer}` : t.nextPrayer}
      </div>

      {/* Arabic giant */}
      {showArabicPrayerNames && (
        <div
          dir="rtl"
          style={{
            fontFamily: "var(--font-arabic)",
            fontSize: "var(--t-hero)",
            fontWeight: 700,
            color: "var(--accent)",
            lineHeight: 1,
            textShadow: "0 0 60px var(--accent-glow)",
          }}
        >
          {ARABIC_PRAYER_NAMES[nextName]}
        </div>
      )}

      {/* Localized name */}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--t-xl)",
          fontWeight: 700,
          color: "var(--text)",
          letterSpacing: "-0.02em",
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

      {/* Countdown */}
      {remainingMs > 0 && (
        <div style={{ display: "grid", placeItems: "center", gap: "1vh", marginTop: "2vh" }}>
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
              fontSize: "var(--t-hero)",
              color: "var(--accent)",
              textShadow: "0 0 50px var(--accent-glow)",
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
