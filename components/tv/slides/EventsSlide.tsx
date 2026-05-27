"use client";

import type { TVColors, TVEventItem } from "@/types";
import { useTVLocale } from "../LocaleAwareText";
import { tvT, formatTvDate } from "../tv-i18n";

export function EventsSlide({
  data,
  colors,
  mosqueTimezone,
}: {
  data: TVEventItem[];
  colors: TVColors;
  mosqueTimezone: string;
}) {
  const { mode, currentLocale, secondary } = useTVLocale();
  const t = tvT(currentLocale);
  const tSec = mode === "bilingual" && secondary !== "none" ? tvT(secondary) : null;

  return (
    <div className="flex h-full w-full flex-col gap-[3vh] px-[6vw] py-[4vh]">
      <h2 className="text-[5vh] font-bold" style={{ color: colors.accent }}>
        {mode === "bilingual" && tSec ? (
          <>
            {t.upcomingEvents}
            <span className="mx-4 opacity-50">·</span>
            {tSec.upcomingEvents}
          </>
        ) : (
          t.upcomingEvents
        )}
      </h2>

      <ul className="flex flex-col gap-[3vh]">
        {data.length === 0 && (
          <li className="text-[3vh] opacity-60" style={{ color: colors.text }}>
            {t.noEvents}
          </li>
        )}
        {data.map((e) => (
          <li
            key={e.id}
            className="flex flex-col gap-[1vh] rounded-2xl border px-[2vw] py-[2vh]"
            style={{ borderColor: colors.text + "33", color: colors.text }}
          >
            <div className="text-[4vh] font-semibold">{e.title}</div>
            <div className="flex items-center gap-[2vw] text-[2.5vh] opacity-80">
              <span style={{ color: colors.accent }}>
                {formatTvDate(e.startAtIso, currentLocale, mosqueTimezone)}
              </span>
              {e.location && <span>· {e.location}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
