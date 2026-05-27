/**
 * TV-Farben auflösen: Override-Felder haben Vorrang vor Brand-Farben.
 * Ausgelagert aus lib/actions/settings.ts (darf kein "use server" haben).
 */
import { getBrandColor } from "@/lib/constants";
import type { Mosque, TVColors } from "@/types";
import type { TVSettingsResolved } from "@/lib/actions/settings";

export function resolveTVColors(
  mosque: Pick<Mosque, "brand_theme" | "brand_primary_color">,
  tv: Pick<TVSettingsResolved, "tv_bg_color" | "tv_text_color" | "tv_accent_color">
): TVColors {
  const brand = getBrandColor(mosque.brand_theme, mosque.brand_primary_color);
  const defaults: TVColors = { bg: "#0a0a0a", text: "#fafafa", accent: brand };
  return {
    bg: tv.tv_bg_color || defaults.bg,
    text: tv.tv_text_color || defaults.text,
    accent: tv.tv_accent_color || defaults.accent,
  };
}
