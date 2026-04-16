"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Löst einen Router-Refresh aus, wenn die App nach dem Hintergrund
 * wieder sichtbar wird (PWA Resume, Tab-Wechsel zurück).
 * Verhindert veraltete "Diese Woche"-Daten ohne Full-Reload.
 */
export function FocusRefresher() {
  const router = useRouter();
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [router]);
  return null;
}
