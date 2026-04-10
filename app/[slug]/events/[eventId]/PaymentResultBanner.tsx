"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Smartphone } from "lucide-react";

interface PaymentResultBannerProps {
  result: "success" | "cancelled" | null;
  slug: string;
  eventId: string;
}

export function PaymentResultBanner({ result, slug, eventId }: PaymentResultBannerProps) {
  const [isStandalone, setIsStandalone] = useState(true);
  const [visible, setVisible] = useState(!!result);

  useEffect(() => {
    // PWA-Standalone-Modus erkennen
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // URL-Parameter bereinigen ohne Seite neu zu laden
    if (result) {
      const url = new URL(window.location.href);
      url.searchParams.delete("payment_success");
      url.searchParams.delete("payment_cancelled");
      window.history.replaceState({}, "", url.toString());
    }
  }, [result]);

  if (!visible || !result) return null;

  const appUrl = `/${slug}/events/${eventId}`;

  return (
    <div
      className={`mx-4 mt-4 rounded-xl border p-4 sm:mx-0 ${
        result === "success"
          ? "border-emerald-200 bg-emerald-50"
          : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex items-start gap-3">
        {result === "success" ? (
          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${result === "success" ? "text-emerald-800" : "text-amber-800"}`}>
            {result === "success"
              ? "Zahlung erfolgreich — Dein Platz ist reserviert ✓"
              : "Zahlung abgebrochen"}
          </p>
          <p className={`mt-0.5 text-xs ${result === "success" ? "text-emerald-600" : "text-amber-600"}`}>
            {result === "success"
              ? "Du erhältst eine Bestätigung per E-Mail."
              : "Du kannst jederzeit erneut zahlen oder Barzahlung wählen."}
          </p>

          {/* PWA-Hinweis: nur anzeigen wenn NICHT im Standalone-Modus */}
          {!isStandalone && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-current/20 bg-white/60 p-3">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
              <div>
                <p className="text-xs font-medium text-gray-700">
                  Du befindest dich im Browser.
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Wechsle zurück zur App, um fortzufahren.
                </p>
                <a
                  href={appUrl}
                  className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
                >
                  <Smartphone className="h-3 w-3" />
                  Zur App wechseln
                </a>
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="shrink-0 text-gray-400 hover:text-gray-600"
          aria-label="Schließen"
        >
          ×
        </button>
      </div>
    </div>
  );
}
