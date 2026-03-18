"use client";

import { useEffect } from "react";
import { toast } from "sonner";

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

          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // Neuer SW wartet — User benachrichtigen
                toast.info("App-Update verfügbar", {
                  description: "Eine neue Version ist bereit.",
                  duration: Infinity,
                  action: {
                    label: "Neu laden",
                    onClick: () => window.location.reload(),
                  },
                });
              }
            });
          });
        })
        .catch((error) => {
          console.error("[SW] Registrierung fehlgeschlagen:", error);
        });

      // Nach Controller-Wechsel (z.B. skipWaiting) automatisch neu laden
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  return null;
}
