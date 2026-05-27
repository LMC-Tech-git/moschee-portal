"use client";

import type { TVColors, TVPrayerName } from "@/types";
import { tvT } from "../tv-i18n";

export function ActivePrayerSlide({
  data,
  colors,
}: {
  data: { prayer: TVPrayerName; arabicName: string };
  colors: TVColors;
}) {
  const tDe = tvT("de");
  const tTr = tvT("tr");

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[5vh] px-[6vw] py-[4vh] text-center">
      <div className="font-bold opacity-90" dir="rtl" style={{ color: colors.text, fontSize: "clamp(4rem, 14vw, 18rem)" }}>
        {data.arabicName}
      </div>

      <div className="text-[6vh] font-bold" style={{ color: colors.accent }}>
        {tDe.prayers[data.prayer]}
        <span className="mx-4 opacity-50">·</span>
        {tTr.prayers[data.prayer]}
      </div>

      <div className="text-[4vh] opacity-80" style={{ color: colors.text }}>
        {tDe.prayerTimeNow}
        <span className="mx-4 opacity-50">·</span>
        {tTr.prayerTimeNow}
      </div>
    </div>
  );
}
