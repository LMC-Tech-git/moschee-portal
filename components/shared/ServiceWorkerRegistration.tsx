"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          console.log("[SW] Registriert:", registration.scope);

          // Auto-Update: Bei neuem SW sofort aktivieren
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "activated" &&
                navigator.serviceWorker.controller
              ) {
                console.log("[SW] Neuer Service Worker aktiviert");
              }
            });
          });
        })
        .catch((error) => {
          console.error("[SW] Registrierung fehlgeschlagen:", error);
        });
    }
  }, []);

  return null;
}
