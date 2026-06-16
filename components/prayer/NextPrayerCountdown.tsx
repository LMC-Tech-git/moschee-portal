"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Timer } from "lucide-react";

/**
 * Live-Countdown bis zum nächsten Gebet (HH:MM:SS) auf dem öffentlichen Portal.
 *
 * Robustheit:
 *  - `serverNowMs` korrigiert die (evtl. falsch gehende) Client-Uhr → Offset einmal beim Mount,
 *    danach `Date.now() + offset` (verhindert sofortiges diff<=0 + Refresh-Loop).
 *  - `router.refresh()` nur beim ÜBERGANG >0 → <=0 (nicht bei initialem <=0), `didRefresh`-Ref
 *    gegen Mehrfach-Auslösung. Bei neuem `targetMs` (nach Refresh) Guard zurücksetzen.
 *  - Grenzfall „beim Mount schon <=0": auf 00:00:00 klemmen + EIN verzögerter Refresh (~8 s).
 *  - Jeder Tick rechnet `diff` frisch (kein Dekrement) → korrekt nach Tab-Sleep/Drosselung.
 */
export function NextPrayerCountdown({
  targetMs,
  serverNowMs,
  prayerLabel,
}: {
  targetMs: number;
  serverNowMs: number;
  prayerLabel: string;
}) {
  const t = useTranslations("mosque.dashboard");
  const router = useRouter();

  // Offset zwischen Server- und Client-Uhr, einmalig beim Mount festgehalten.
  const offsetRef = useRef<number | null>(null);
  const didRefreshRef = useRef(false);
  const prevDiffRef = useRef<number | null>(null);

  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    offsetRef.current = serverNowMs - Date.now();
    const correctedNow = () => Date.now() + (offsetRef.current ?? 0);
    setNowMs(correctedNow());
    const id = setInterval(() => setNowMs(correctedNow()), 1000);
    return () => clearInterval(id);
    // serverNowMs ändert sich mit jedem Server-Render (neues targetMs) → Offset neu eichen.
  }, [serverNowMs]);

  // Guard bei neuem Ziel zurücksetzen (nächster 0-Durchlauf soll wieder refreshen können).
  useEffect(() => {
    didRefreshRef.current = false;
    prevDiffRef.current = null;
  }, [targetMs]);

  // Übergangs-Refresh + Grenzfall-Refresh.
  useEffect(() => {
    if (nowMs === null) return;
    const diff = targetMs - nowMs;
    const prev = prevDiffRef.current;

    if (prev === null) {
      // Erster Tick nach Mount/Ziel-Wechsel.
      if (diff <= 0 && !didRefreshRef.current) {
        // Ziel bereits vorbei (Render-Lag/grenzwertig) → verzögert einmal neu laden.
        didRefreshRef.current = true;
        const to = setTimeout(() => router.refresh(), 8000);
        prevDiffRef.current = diff;
        return () => clearTimeout(to);
      }
    } else if (prev > 0 && diff <= 0 && !didRefreshRef.current) {
      // Sauberer Übergang ins nächste Gebet.
      didRefreshRef.current = true;
      router.refresh();
    }
    prevDiffRef.current = diff;
  }, [nowMs, targetMs, router]);

  if (nowMs === null) return null;

  const diff = Math.max(0, targetMs - nowMs);
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="mb-4 flex flex-col items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-100 px-4 py-3 text-center sm:flex-row sm:gap-3">
      <div className="flex items-center gap-2 text-emerald-700">
        <Timer className="h-4 w-4" aria-hidden="true" />
        <span className="text-sm font-semibold">
          {t("nextPrayer")}: {prayerLabel}
        </span>
      </div>
      <span
        className="font-mono text-2xl font-bold tabular-nums text-emerald-900"
        aria-hidden="true"
      >
        {pad(h)}:{pad(m)}:{pad(s)}
      </span>
    </div>
  );
}
