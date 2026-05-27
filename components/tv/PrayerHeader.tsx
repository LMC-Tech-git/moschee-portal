"use client";

import { useEffect, useState } from "react";
import type { TVPrayerSlideData } from "@/types";
import { ARABIC_PRAYER_NAMES } from "@/app/[slug]/tv/active-prayer";
import { tvT } from "./tv-i18n";
import { useTVLocale } from "./LocaleAwareText";

function formatCountdownShort(ms: number): string {
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function PrayerHeader({
  prayerData,
  mosqueName,
  mosqueLogoUrl,
  showArabicPrayerNames,
  clientOffsetMs,
  currentPrayer,
}: {
  prayerData: TVPrayerSlideData | null;
  mosqueName: string;
  mosqueLogoUrl: string | null;
  showArabicPrayerNames: boolean;
  clientOffsetMs: number;
  currentPrayer: string | null;
}) {
  const { currentLocale } = useTVLocale();
  const t = tvT(currentLocale);
  const [nowMs, setNowMs] = useState(() => Date.now() + clientOffsetMs);

  useEffect(() => {
    const i = setInterval(() => setNowMs(Date.now() + clientOffsetMs), 1000);
    return () => clearInterval(i);
  }, [clientOffsetMs]);

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

  const remainingMs = prayerData.nextPrayerAtMs ? prayerData.nextPrayerAtMs - nowMs : 0;
  const nextLabel = prayerData.nextPrayer ? t.prayers[prayerData.nextPrayer] : "";

  return (
    <header className="tv-header">
      {/* Top strip: Brand + Hijri + Countdown */}
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

        {prayerData.nextPrayer && remainingMs > 0 && (
          <div className="tv-countdown">
            <span className="tv-countdown-dot" />
            <span>{nextLabel}</span>
            <span>·</span>
            <span>{formatCountdownShort(remainingMs)}</span>
          </div>
        )}
      </div>

      {/* Prayer grid */}
      <div className="tv-prayer-grid">
        {prayerData.times.map((p) => {
          const isCurrent = currentPrayer === p.name;
          return (
            <div
              key={p.name}
              className={`tv-prayer-cell${isCurrent ? " is-current" : ""}`}
            >
              {showArabicPrayerNames && (
                <div className="tv-prayer-arabic">{ARABIC_PRAYER_NAMES[p.name]}</div>
              )}
              <div className="tv-prayer-name">{t.prayers[p.name]}</div>
              <div className="tv-prayer-time">{p.time || "--:--"}</div>
            </div>
          );
        })}
      </div>
    </header>
  );
}
