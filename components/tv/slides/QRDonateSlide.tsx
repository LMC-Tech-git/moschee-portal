"use client";

import type { TVColors } from "@/types";
import { useTVLocale } from "../LocaleAwareText";
import { tvT } from "../tv-i18n";

export function QRDonateSlide({
  data,
  colors: _colors,
}: {
  data: { url: string; svg: string };
  colors: TVColors;
}) {
  const { mode, currentLocale, secondary } = useTVLocale();
  const t = tvT(currentLocale);
  const tSec = mode === "bilingual" && secondary !== "none" ? tvT(secondary) : null;

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        gap: "3vh",
        width: "100%",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h2
          className="tv-headline"
          style={{ fontSize: "clamp(2.5rem, 6vh, 5rem)" }}
        >
          {t.donateCta}
        </h2>
        {mode === "bilingual" && tSec && (
          <p
            className="tv-eyebrow"
            style={{ marginTop: "1vh", opacity: 0.75 }}
          >
            {tSec.donateCta}
          </p>
        )}
      </div>

      {data.svg ? (
        <div
          className="tv-qr-card"
          dangerouslySetInnerHTML={{ __html: data.svg }}
        />
      ) : (
        <div className="tv-qr-card">
          <div
            style={{
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              fontFamily: "var(--font-mono)",
              fontSize: "clamp(1rem, 2vh, 1.5rem)",
              color: "#0a0a0a",
              padding: "2vh",
              wordBreak: "break-all",
            }}
          >
            {data.url}
          </div>
        </div>
      )}

      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--t-small)",
          color: "var(--text-dim)",
          letterSpacing: "0.04em",
        }}
      >
        {data.url}
      </div>
    </div>
  );
}
