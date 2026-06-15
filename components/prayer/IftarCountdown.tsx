"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Moon } from "lucide-react";

/**
 * Ramadan-Countdown auf dem Dashboard.
 * Wählt automatisch das relevante Ziel:
 *  - vor Suhur-Ende (Fajr): Countdown bis Suhur-Ende
 *  - vor Iftar (Maghrib):   Countdown bis Iftar
 *  - nach Iftar:            Countdown bis zum nächsten Suhur (morgen Fajr)
 * Alle Zeitstempel sind epoch ms (server-seitig in Moschee-TZ berechnet).
 */
export function IftarCountdown({
  suhurMs,
  iftarMs,
  nextSuhurMs,
}: {
  suhurMs: number;
  iftarMs: number;
  nextSuhurMs: number;
}) {
  const t = useTranslations("mosque.dashboard.ramadan");
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Erst nach Mount rendern (vermeidet Hydration-Mismatch durch Date.now()).
  if (nowMs === null) return null;

  let targetMs: number;
  let label: string;
  if (Number.isFinite(suhurMs) && nowMs < suhurMs) {
    targetMs = suhurMs;
    label = t("countdownToSuhur");
  } else if (Number.isFinite(iftarMs) && nowMs < iftarMs) {
    targetMs = iftarMs;
    label = t("countdownToIftar");
  } else if (Number.isFinite(nextSuhurMs)) {
    targetMs = nextSuhurMs;
    label = t("countdownToSuhur");
  } else {
    return null;
  }

  const diff = Math.max(0, targetMs - nowMs);
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="mb-4 flex flex-col items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-amber-50 to-amber-100 px-4 py-3 text-center sm:flex-row sm:gap-3">
      <div className="flex items-center gap-2 text-amber-700">
        <Moon className="h-4 w-4" aria-hidden="true" />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <span className="font-mono text-2xl font-bold tabular-nums text-amber-900">
        {pad(h)}:{pad(m)}:{pad(s)}
      </span>
    </div>
  );
}
