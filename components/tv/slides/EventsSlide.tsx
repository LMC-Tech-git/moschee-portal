"use client";

import type { TVColors, TVEventItem } from "@/types";
import { useTVLocale } from "../LocaleAwareText";
import { tvT, formatTvDate } from "../tv-i18n";

export function EventsSlide({
  data,
  colors: _colors,
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4vh",
        width: "100%",
        maxWidth: "90vw",
      }}
    >
      <div className="tv-eyebrow">
        {mode === "bilingual" && tSec
          ? `${t.upcomingEvents} · ${tSec.upcomingEvents}`
          : t.upcomingEvents}
      </div>

      <ul style={{ display: "flex", flexDirection: "column", gap: "2.5vh", listStyle: "none", padding: 0, margin: 0 }}>
        {data.length === 0 && (
          <li style={{ fontSize: "var(--t-base)", color: "var(--text-dim)" }}>
            {t.noEvents}
          </li>
        )}
        {data.map((e) => (
          <li
            key={e.id}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "3vw",
              alignItems: "center",
              padding: "3vh 3vw",
              borderRadius: "2vh",
              background: "var(--bg-elev)",
              borderLeft: "4px solid var(--accent)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {/* Date chip — Mono, accent-tinted */}
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--t-lg)",
                color: "var(--accent)",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.02em",
                minWidth: "12vw",
                textAlign: "left",
              }}
            >
              {formatTvDate(e.startAtIso, currentLocale, mosqueTimezone)}
            </div>

            {/* Title + location */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5vh" }}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--t-lg)",
                  fontWeight: 700,
                  color: "var(--text)",
                  lineHeight: 1.1,
                  letterSpacing: "-0.01em",
                }}
              >
                {e.title}
              </div>
              {e.location && (
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--t-small)",
                    color: "var(--text-dim)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {e.location}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
