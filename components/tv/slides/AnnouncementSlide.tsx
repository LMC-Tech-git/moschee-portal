"use client";

import type { TVColors } from "@/types";
import { useTVLocale } from "../LocaleAwareText";

export function AnnouncementSlide({
  data,
  colors: _colors,
}: {
  data: { textPrimary: string; textSecondary: string };
  colors: TVColors;
}) {
  const { mode, currentLocale, primary, secondary } = useTVLocale();
  const showBoth = mode === "bilingual" && secondary !== "none";
  const textForLocale =
    currentLocale === primary ? data.textPrimary : data.textSecondary || data.textPrimary;

  if (showBoth) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          gap: "5vh",
          width: "100%",
          maxWidth: "85vw",
          textAlign: "center",
        }}
      >
        <div
          className="tv-headline"
          dir={primary === "ar" ? "rtl" : "ltr"}
          style={{ fontSize: "var(--t-2xl)" }}
        >
          {data.textPrimary}
        </div>
        <div
          style={{
            width: "20vw",
            height: "2px",
            background: "var(--accent-hair)",
          }}
        />
        {data.textSecondary && (
          <div
            className="tv-headline"
            dir={secondary === "ar" ? "rtl" : "ltr"}
            style={{
              fontSize: "var(--t-xl)",
              color: "var(--text-dim)",
              fontWeight: 500,
            }}
          >
            {data.textSecondary}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        width: "100%",
        maxWidth: "85vw",
      }}
    >
      <div
        className="tv-headline"
        dir={currentLocale === "ar" ? "rtl" : "ltr"}
        style={{ fontSize: "var(--t-hero)", textAlign: "center" }}
      >
        {textForLocale}
      </div>
    </div>
  );
}
