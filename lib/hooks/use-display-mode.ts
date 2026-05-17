"use client";

import { useEffect, useState } from "react";

export type DisplayMode = "browser" | "standalone" | "window-controls-overlay";

/**
 * Erkennt den PWA-Anzeigemodus.
 * - "standalone": als App installiert (Homescreen / App-Fenster)
 * - "window-controls-overlay": Desktop-PWA mit Titlebar-Overlay
 * - "browser": normaler Browser-Tab
 *
 * SSR-sicher: liefert initial "browser", aktualisiert nach Mount.
 */
export function useDisplayMode(): DisplayMode {
  const [mode, setMode] = useState<DisplayMode>("browser");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const detect = (): DisplayMode => {
      // iOS Safari: navigator.standalone
      const iosStandalone =
        "standalone" in window.navigator &&
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (iosStandalone) return "standalone";

      if (window.matchMedia("(display-mode: window-controls-overlay)").matches) {
        return "window-controls-overlay";
      }
      if (window.matchMedia("(display-mode: standalone)").matches) {
        return "standalone";
      }
      return "browser";
    };

    setMode(detect());

    const standaloneMq = window.matchMedia("(display-mode: standalone)");
    const wcoMq = window.matchMedia("(display-mode: window-controls-overlay)");
    const onChange = () => setMode(detect());

    standaloneMq.addEventListener("change", onChange);
    wcoMq.addEventListener("change", onChange);
    return () => {
      standaloneMq.removeEventListener("change", onChange);
      wcoMq.removeEventListener("change", onChange);
    };
  }, []);

  return mode;
}

/** True wenn als installierte App geöffnet (nicht im Browser-Tab). */
export function useIsInstalledApp(): boolean {
  const mode = useDisplayMode();
  return mode !== "browser";
}
