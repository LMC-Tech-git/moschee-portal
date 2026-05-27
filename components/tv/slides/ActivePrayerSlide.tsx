"use client";

import type { TVColors, TVPrayerName } from "@/types";
import { tvT } from "../tv-i18n";

export function ActivePrayerSlide({
  data,
  colors: _colors,
}: {
  data: { prayer: TVPrayerName; arabicName: string };
  colors: TVColors;
}) {
  const tDe = tvT("de");
  const tTr = tvT("tr");

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        gap: "6vh",
        textAlign: "center",
        width: "100%",
      }}
    >
      {/* Big arabic, pulsing glow */}
      <div
        className="tv-active-pulse"
        dir="rtl"
        style={{
          fontFamily: "var(--font-arabic)",
          fontSize: "var(--t-hero)",
          fontWeight: 700,
          color: "var(--accent)",
          lineHeight: 1,
        }}
      >
        {data.arabicName}
      </div>

      {/* DE · TR */}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--t-2xl)",
          fontWeight: 700,
          color: "var(--text)",
          letterSpacing: "-0.02em",
        }}
      >
        {tDe.prayers[data.prayer]}
        <span style={{ margin: "0 2vw", color: "var(--accent)", opacity: 0.5 }}>·</span>
        {tTr.prayers[data.prayer]}
      </div>

      {/* "Zeit zum Gebet" */}
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--t-lg)",
          color: "var(--text-dim)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {tDe.prayerTimeNow}
        <span style={{ margin: "0 2vw", color: "var(--accent-hair)" }}>·</span>
        {tTr.prayerTimeNow}
      </div>
    </div>
  );
}
