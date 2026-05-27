"use client";

import type { TVColors } from "@/types";
import { useTVLocale } from "../LocaleAwareText";

export function AnnouncementSlide({
  data,
  colors,
}: {
  data: { textPrimary: string; textSecondary: string };
  colors: TVColors;
}) {
  const { mode, currentLocale, primary, secondary } = useTVLocale();
  const showBoth = mode === "bilingual" && secondary !== "none";
  const textForLocale = currentLocale === primary ? data.textPrimary : data.textSecondary || data.textPrimary;

  if (showBoth) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-[5vh] px-[6vw] py-[4vh] text-center">
        <div
          className="font-bold leading-tight"
          style={{ color: colors.text, fontSize: "clamp(2rem, 7vw, 9rem)" }}
          dir={primary === "ar" ? "rtl" : "ltr"}
        >
          {data.textPrimary}
        </div>
        {data.textSecondary && (
          <div
            className="font-medium leading-tight opacity-85"
            style={{ color: colors.text, fontSize: "clamp(1.5rem, 5vw, 7rem)" }}
            dir={secondary === "ar" ? "rtl" : "ltr"}
          >
            {data.textSecondary}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center px-[6vw] py-[4vh] text-center">
      <div
        className="font-bold leading-tight"
        style={{ color: colors.text, fontSize: "clamp(2.5rem, 9vw, 12rem)" }}
        dir={currentLocale === "ar" ? "rtl" : "ltr"}
      >
        {textForLocale}
      </div>
    </div>
  );
}
