"use client";

import type { TVColors, TVCampaignItem } from "@/types";
import { useTVLocale } from "../LocaleAwareText";
import { tvT, formatTvCurrency } from "../tv-i18n";

export function CampaignsSlide({ data, colors: _colors }: { data: TVCampaignItem; colors: TVColors }) {
  const { mode, currentLocale, secondary } = useTVLocale();
  const t = tvT(currentLocale);
  const tSec = mode === "bilingual" && secondary !== "none" ? tvT(secondary) : null;

  const pct = data.goalCents > 0 ? Math.min(100, Math.round((data.raisedCents / data.goalCents) * 100)) : 0;
  const raised = formatTvCurrency(data.raisedCents, currentLocale);
  const goal = formatTvCurrency(data.goalCents, currentLocale);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4vh",
        width: "100%",
        maxWidth: "85vw",
      }}
    >
      <div className="tv-eyebrow">
        {mode === "bilingual" && tSec
          ? `${t.currentCampaign} · ${tSec.currentCampaign}`
          : t.currentCampaign}
      </div>

      <h2 className="tv-headline">{data.title}</h2>

      {/* Progress bar */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2vh", marginTop: "2vh" }}>
        <div
          style={{
            position: "relative",
            height: "5vh",
            width: "100%",
            borderRadius: "999px",
            overflow: "hidden",
            background: "var(--bg-elev)",
            border: "1px solid var(--hairline-x)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              width: `${pct}%`,
              background: `linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 70%, white))`,
              boxShadow: "0 0 40px var(--accent-glow)",
              transition: "width 600ms ease",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <div>
            <div className="tv-eyebrow" style={{ opacity: 0.7, fontSize: "var(--t-micro)" }}>
              {mode === "bilingual" && tSec ? `${t.raised} · ${tSec.raised}` : t.raised}
            </div>
            <div
              className="tv-stat"
              style={{
                fontSize: "var(--t-xl)",
                color: "var(--accent)",
                textShadow: "0 0 30px var(--accent-glow)",
              }}
            >
              {raised}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div className="tv-eyebrow" style={{ opacity: 0.5, fontSize: "var(--t-micro)" }}>
              {mode === "bilingual" && tSec ? `${t.goal} · ${tSec.goal}` : t.goal}
            </div>
            <div
              className="tv-stat"
              style={{
                fontSize: "var(--t-lg)",
                color: "var(--text-dim)",
              }}
            >
              {goal}
            </div>
          </div>
        </div>

        <div
          className="tv-stat"
          style={{
            fontSize: "var(--t-lg)",
            color: "var(--accent)",
            textAlign: "right",
            marginTop: "1vh",
          }}
        >
          {pct}%
        </div>
      </div>
    </div>
  );
}
