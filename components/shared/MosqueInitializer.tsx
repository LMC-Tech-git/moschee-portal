"use client";

import { useEffect } from "react";
import { useMosque } from "@/lib/mosque-context";
import type { Mosque, Settings } from "@/types";

/**
 * MosqueInitializer — übergibt die server-seitig aufgelöste Moschee an den
 * Root-MosqueProvider, damit der Header sofort die korrekte Branding anzeigt
 * (kein client-seitiger Fetch, kein Flash).
 *
 * Wird im Slug-Layout eingebunden.
 */
export function MosqueInitializer({
  mosque,
  settings,
}: {
  mosque: Mosque;
  settings?: Settings | null;
}) {
  const { setMosqueData, setTeamEnabled } = useMosque();

  useEffect(() => {
    setMosqueData(mosque);
    setTeamEnabled(settings?.team_enabled ?? false);
    // Cleanup: Moschee zurücksetzen wenn Slug-Seite verlassen wird
    return () => {
      setMosqueData(null);
      setTeamEnabled(false);
    };
  }, [mosque.id, settings?.team_enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
