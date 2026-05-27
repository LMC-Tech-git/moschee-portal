"use client";

import type { TVColors } from "@/types";
import { useTVLocale } from "../LocaleAwareText";
import { tvT } from "../tv-i18n";

export function QRDonateSlide({
  data,
  colors,
}: {
  data: { url: string; svg: string };
  colors: TVColors;
}) {
  const { mode, currentLocale, secondary } = useTVLocale();
  const t = tvT(currentLocale);
  const tSec = mode === "bilingual" && secondary !== "none" ? tvT(secondary) : null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[3vh] px-[4vw] py-[4vh]">
      <h2 className="text-center text-[5vh] font-bold" style={{ color: colors.accent }}>
        {mode === "bilingual" && tSec ? (
          <>
            {t.donateCta}
            <br />
            <span className="text-[4vh] opacity-80">{tSec.donateCta}</span>
          </>
        ) : (
          t.donateCta
        )}
      </h2>

      {data.svg ? (
        <div
          className="rounded-2xl bg-white p-[2vh]"
          style={{ width: "50vh", height: "50vh" }}
          dangerouslySetInnerHTML={{ __html: data.svg }}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-2xl bg-white p-[4vh] text-center text-[3vh] font-mono text-black"
          style={{ width: "50vh", height: "50vh" }}
        >
          {data.url}
        </div>
      )}

      <div className="text-[2.5vh] opacity-80" style={{ color: colors.text }}>
        {data.url}
      </div>
    </div>
  );
}
