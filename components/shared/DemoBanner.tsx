"use client";

import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { isDemoMosque } from "@/lib/demo";
import { DemoReturnButton } from "@/components/shared/DemoReturnButton";

export function DemoBanner() {
  const { user } = useAuth();

  if (!user || !isDemoMosque(user.mosque_id)) return null;

  return (
    <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          <strong>Demo-Modus</strong> — Alle Daten können jederzeit zurückgesetzt werden.
          Nutze die Zugangsdaten auf der Anmeldeseite zum Testen.
        </span>
      </div>
      <DemoReturnButton />
    </div>
  );
}
