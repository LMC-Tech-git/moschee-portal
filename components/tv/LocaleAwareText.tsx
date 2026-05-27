"use client";

import { createContext, useContext } from "react";
import type { TVLocale, TVLocaleMode } from "@/types";

export type TVLocaleContextValue = {
  mode: TVLocaleMode;
  currentLocale: TVLocale;
  primary: TVLocale;
  secondary: TVLocale | "none";
};

const Ctx = createContext<TVLocaleContextValue>({
  mode: "single",
  currentLocale: "de",
  primary: "de",
  secondary: "none",
});

export const TVLocaleProvider = Ctx.Provider;
export const useTVLocale = () => useContext(Ctx);

/**
 * Rendert Text gemäß aktuellem Sprach-Modus:
 * - single / rotate: nur aktuelle Locale
 * - bilingual: beide Sprachen gleichzeitig (primary groß, secondary kleiner)
 */
export function BilingualText({
  textPrimary,
  textSecondary,
  className = "",
  secondaryClassName = "",
  separator = "·",
  stacked = false,
}: {
  textPrimary: string;
  textSecondary?: string;
  className?: string;
  secondaryClassName?: string;
  separator?: string;
  stacked?: boolean;
}) {
  const { mode, currentLocale, primary, secondary } = useTVLocale();

  if (mode === "bilingual" && textSecondary && secondary !== "none") {
    if (stacked) {
      return (
        <span className={className}>
          <span>{textPrimary}</span>
          <span className={`block ${secondaryClassName}`} dir={secondary === "ar" ? "rtl" : "ltr"}>
            {textSecondary}
          </span>
        </span>
      );
    }
    return (
      <span className={className}>
        <span>{textPrimary}</span>
        <span className="mx-3 opacity-50">{separator}</span>
        <span className={secondaryClassName} dir={secondary === "ar" ? "rtl" : "ltr"}>
          {textSecondary}
        </span>
      </span>
    );
  }

  // single oder rotate: zeige Text der aktuellen Locale
  const text = currentLocale === primary ? textPrimary : textSecondary || textPrimary;
  return (
    <span className={className} dir={currentLocale === "ar" ? "rtl" : "ltr"}>
      {text}
    </span>
  );
}
