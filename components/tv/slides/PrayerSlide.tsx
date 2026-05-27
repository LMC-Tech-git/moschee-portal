"use client";

import { useEffect, useState } from "react";
import type { TVColors, TVPrayerSlideData } from "@/types";
import { useTVLocale } from "../LocaleAwareText";
import { tvT } from "../tv-i18n";
import { ARABIC_PRAYER_NAMES } from "@/app/[slug]/tv/active-prayer";

function formatCountdown(ms: number, locale: string): string {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function PrayerSlide({
  data,
  colors,
  showArabicPrayerNames,
  clientOffsetMs,
}: {
  data: TVPrayerSlideData;
  colors: TVColors;
  showArabicPrayerNames: boolean;
  clientOffsetMs: number;
}) {
  const { mode, currentLocale, primary, secondary } = useTVLocale();
  const t = tvT(currentLocale);
  const tSec = mode === "bilingual" && secondary !== "none" ? tvT(secondary) : null;
  const [nowMs, setNowMs] = useState(() => Date.now() + clientOffsetMs);

  useEffect(() => {
    const i = setInterval(() => setNowMs(Date.now() + clientOffsetMs), 1000);
    return () => clearInterval(i);
  }, [clientOffsetMs]);

  const remainingMs = data.nextPrayerAtMs ? data.nextPrayerAtMs - nowMs : 0;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[2vh] px-[4vw] py-[2vh]">
      {data.hijriDate && (
        <div className="text-[2vh] opacity-60" style={{ color: colors.text }}>
          {data.hijriDate}
        </div>
      )}

      <div className="grid w-full max-w-[90vw] grid-cols-6 gap-[1.5vw]">
        {data.times.map((p) => {
          const labelDe = tvT("de").prayers[p.name];
          const labelTr = tvT("tr").prayers[p.name];
          const labelPrimary = t.prayers[p.name];
          const labelSecondary = tSec?.prayers[p.name] || "";
          return (
            <div
              key={p.name}
              className="flex flex-col items-center rounded-2xl px-[1vw] py-[2vh] transition-all"
              style={{
                backgroundColor: p.isNext ? colors.accent : "transparent",
                color: p.isNext ? colors.bg : colors.text,
                border: `2px solid ${p.isNext ? colors.accent : colors.text + "33"}`,
              }}
            >
              {showArabicPrayerNames && (
                <div className="text-[2.5vh] opacity-80" dir="rtl">
                  {ARABIC_PRAYER_NAMES[p.name]}
                </div>
              )}
              <div className="text-[2.5vh] font-medium opacity-90">
                {mode === "bilingual" && tSec ? (
                  <>
                    {labelPrimary}
                    <span className="mx-2 opacity-50">·</span>
                    {labelSecondary}
                  </>
                ) : (
                  labelPrimary
                )}
              </div>
              <div className="mt-[1vh] text-[5vh] font-bold tabular-nums">{p.time || "--:--"}</div>
            </div>
          );
        })}
      </div>

      {data.nextPrayer && remainingMs > 0 && (
        <div className="mt-[3vh] flex flex-col items-center gap-[1vh]">
          <div className="text-[3vh] opacity-80" style={{ color: colors.text }}>
            {mode === "bilingual" && tSec ? (
              <>
                {t.nextPrayer}: {t.prayers[data.nextPrayer]}
                <span className="mx-3 opacity-50">·</span>
                {tSec.nextPrayer}: {tSec.prayers[data.nextPrayer]}
              </>
            ) : (
              <>
                {t.nextPrayer}: {t.prayers[data.nextPrayer]}
              </>
            )}
          </div>
          <div className="text-[8vh] font-bold tabular-nums" style={{ color: colors.accent }}>
            {formatCountdown(remainingMs, currentLocale)}
          </div>
        </div>
      )}
    </div>
  );
}
