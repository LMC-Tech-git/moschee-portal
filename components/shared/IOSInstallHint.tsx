"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Share, Plus, X } from "lucide-react";

const STORAGE_KEY = "pwa_ios_hint_dismissed";

/**
 * iOS Safari unterstützt `beforeinstallprompt` nicht.
 * Diese Komponente zeigt iOS-Nutzern eine manuelle Installationsanleitung.
 * Erscheint nur auf iPhone/iPad-Safari, nicht im bereits installierten App-Modus.
 */
export function IOSInstallHint() {
  const t = useTranslations("pwa.ios");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    // iPadOS 13+ meldet sich als Mac — zusätzlich Touch prüfen
    const isIPadOS =
      navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    if (!isIOS && !isIPadOS) return;

    // Nur Safari (kein Chrome/Firefox auf iOS — die haben "CriOS"/"FxiOS")
    const isSafari = /^((?!crios|fxios|edgios).)*safari/i.test(ua);
    if (!isSafari) return;

    // Bereits als App installiert?
    const standalone =
      "standalone" in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    if (localStorage.getItem(STORAGE_KEY)) return;

    // Leicht verzögert zeigen, damit die Seite zuerst rendert
    const timer = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-hint-title"
      onClick={handleDismiss}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <Share className="h-5 w-5 text-emerald-700" />
            </div>
            <h2 id="ios-hint-title" className="text-base font-semibold text-gray-900">
              {t("title")}
            </h2>
          </div>
          <button
            onClick={handleDismiss}
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label={t("close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-sm text-gray-600">{t("description")}</p>

        <ol className="mt-4 space-y-3">
          <li className="flex items-center gap-3 text-sm text-gray-800">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
              1
            </span>
            <span className="flex items-center gap-1.5">
              {t("step1")}
              <Share className="inline h-4 w-4 text-emerald-600" />
            </span>
          </li>
          <li className="flex items-center gap-3 text-sm text-gray-800">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
              2
            </span>
            <span className="flex items-center gap-1.5">
              {t("step2")}
              <Plus className="inline h-4 w-4 text-emerald-600" />
            </span>
          </li>
          <li className="flex items-center gap-3 text-sm text-gray-800">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
              3
            </span>
            <span>{t("step3")}</span>
          </li>
        </ol>

        <button
          onClick={handleDismiss}
          className="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
        >
          {t("close")}
        </button>
      </div>
    </div>
  );
}
