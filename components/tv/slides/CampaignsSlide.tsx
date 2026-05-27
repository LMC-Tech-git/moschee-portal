"use client";

import type { TVColors, TVCampaignItem } from "@/types";
import { useTVLocale } from "../LocaleAwareText";
import { tvT, formatTvCurrency } from "../tv-i18n";

export function CampaignsSlide({ data, colors: _colors }: { data: TVCampaignItem[]; colors: TVColors }) {
  const { mode, currentLocale, secondary } = useTVLocale();
  const t = tvT(currentLocale);
  const tSec = mode === "bilingual" && secondary !== "none" ? tvT(secondary) : null;

  if (!data || data.length === 0) return null;
  const isList = data.length > 1;

  // ── Hero (single campaign) ──
  if (!isList) {
    const c = data[0];
    const pct = c.goalCents > 0 ? Math.min(100, Math.round((c.raisedCents / c.goalCents) * 100)) : 0;
    const raised = formatTvCurrency(c.raisedCents, currentLocale);
    const goal = formatTvCurrency(c.goalCents, currentLocale);

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

        <h2 className="tv-headline">{c.title}</h2>

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

  // ── List (multiple campaigns) ──
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "3vh",
        width: "100%",
        maxWidth: "90vw",
      }}
    >
      <div className="tv-eyebrow">
        {mode === "bilingual" && tSec
          ? `${t.currentCampaigns} · ${tSec.currentCampaigns}`
          : t.currentCampaigns}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2.5vh" }}>
        {data.map((c) => {
          const pct = c.goalCents > 0 ? Math.min(100, Math.round((c.raisedCents / c.goalCents) * 100)) : 0;
          const raised = formatTvCurrency(c.raisedCents, currentLocale);
          const goal = formatTvCurrency(c.goalCents, currentLocale);
          return (
            <div
              key={c.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gridTemplateRows: "auto auto",
                columnGap: "3vw",
                rowGap: "1.2vh",
                padding: "2.5vh 3vw",
                borderRadius: "2vh",
                background: "var(--bg-elev)",
                borderLeft: "4px solid var(--accent)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              {/* Title */}
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--t-lg)",
                  fontWeight: 700,
                  color: "var(--text)",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.15,
                }}
              >
                {c.title}
              </div>

              {/* Amounts (right) */}
              <div
                style={{
                  textAlign: "right",
                  fontFamily: "var(--font-mono)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--t-base)",
                    fontWeight: 700,
                    color: "var(--accent)",
                  }}
                >
                  {raised}
                </span>
                <span style={{ color: "var(--text-faint)", margin: "0 0.6vw" }}>/</span>
                <span style={{ fontSize: "var(--t-base)", color: "var(--text-dim)" }}>
                  {goal}
                </span>
                <span
                  style={{
                    marginLeft: "1.2vw",
                    fontSize: "var(--t-base)",
                    fontWeight: 700,
                    color: "var(--accent)",
                  }}
                >
                  {pct}%
                </span>
              </div>

              {/* Progress bar — spans both columns */}
              <div
                style={{
                  gridColumn: "1 / -1",
                  position: "relative",
                  height: "2.2vh",
                  width: "100%",
                  borderRadius: "999px",
                  overflow: "hidden",
                  background: "var(--bg)",
                  border: "1px solid var(--hairline-x)",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 70%, white))`,
                    boxShadow: "0 0 24px var(--accent-glow)",
                    transition: "width 600ms ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
