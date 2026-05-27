"use client";

import type { TVColors, TVCampaignItem } from "@/types";
import { useTVLocale } from "../LocaleAwareText";
import { tvT, formatTvCurrency } from "../tv-i18n";

export function CampaignsSlide({ data, colors }: { data: TVCampaignItem; colors: TVColors }) {
  const { mode, currentLocale, secondary } = useTVLocale();
  const t = tvT(currentLocale);
  const tSec = mode === "bilingual" && secondary !== "none" ? tvT(secondary) : null;

  const pct = data.goalCents > 0 ? Math.min(100, Math.round((data.raisedCents / data.goalCents) * 100)) : 0;
  const raised = formatTvCurrency(data.raisedCents, currentLocale);
  const goal = formatTvCurrency(data.goalCents, currentLocale);

  return (
    <div className="flex h-full w-full flex-col justify-center gap-[4vh] px-[8vw] py-[4vh]">
      <h2 className="text-[4vh] font-semibold opacity-70" style={{ color: colors.accent }}>
        {mode === "bilingual" && tSec ? `${t.currentCampaign} · ${tSec.currentCampaign}` : t.currentCampaign}
      </h2>

      <div className="text-[7vh] font-bold leading-tight" style={{ color: colors.text }}>
        {data.title}
      </div>

      <div className="flex flex-col gap-[2vh]">
        <div
          className="relative h-[6vh] w-full overflow-hidden rounded-full"
          style={{ backgroundColor: colors.text + "22" }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: colors.accent }}
          />
        </div>
        <div className="flex items-baseline justify-between text-[3.5vh]" style={{ color: colors.text }}>
          <span className="font-bold tabular-nums" style={{ color: colors.accent }}>
            {raised}
          </span>
          <span className="opacity-70 tabular-nums">{goal}</span>
        </div>
        <div className="text-right text-[3vh] font-bold tabular-nums" style={{ color: colors.accent }}>
          {pct}%
        </div>
      </div>
    </div>
  );
}
