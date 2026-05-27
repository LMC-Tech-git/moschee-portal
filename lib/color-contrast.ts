/**
 * WCAG 2.1 Kontrast-Helper für TV-Anzeige.
 * Liefert Kontrast-Verhältnis zwischen zwei HEX-Farben + AA-Validierung.
 */

import type { TVColors } from "@/types";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace(/^#/, "");
  if (cleaned.length !== 6) return null;
  const num = Number.parseInt(cleaned, 16);
  if (Number.isNaN(num)) return null;
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  // WCAG-Formel: sRGB → lineare Werte → gewichtete Summe
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** Kontrast-Verhältnis zwischen zwei HEX-Farben (1.0 = identisch, 21.0 = max). */
export function getContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 0;
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export type TVColorWarning = string;
export type TVColorValidationResult =
  | { ok: true; ratios: { textBg: number; accentBg: number } }
  | { ok: false; warnings: TVColorWarning[]; ratios: { textBg: number; accentBg: number } };

/**
 * Validiert TV-Farben gegen WCAG-AA (Text 4.5:1, Akzent 3:1).
 * Leere Override-Felder werden durch resolvedDefaults ersetzt.
 * Liefert nur Warnungen — Admin darf bewusst speichern.
 */
export function validateTVColors(
  bg: string,
  text: string,
  accent: string,
  resolvedDefaults: TVColors
): TVColorValidationResult {
  const finalBg = bg || resolvedDefaults.bg;
  const finalText = text || resolvedDefaults.text;
  const finalAccent = accent || resolvedDefaults.accent;

  const textBg = getContrastRatio(finalBg, finalText);
  const accentBg = getContrastRatio(finalBg, finalAccent);
  const warnings: TVColorWarning[] = [];

  if (textBg > 0 && textBg < 4.5) {
    warnings.push(`Text-/Hintergrund-Kontrast ${textBg.toFixed(1)}:1 unter WCAG-AA (4.5:1)`);
  }
  if (accentBg > 0 && accentBg < 3) {
    warnings.push(`Akzent-/Hintergrund-Kontrast ${accentBg.toFixed(1)}:1 unter 3:1`);
  }

  if (warnings.length === 0) return { ok: true, ratios: { textBg, accentBg } };
  return { ok: false, warnings, ratios: { textBg, accentBg } };
}
