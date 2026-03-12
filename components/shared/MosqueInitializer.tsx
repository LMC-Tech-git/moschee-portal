"use client";

import { useEffect } from "react";
import { useMosque } from "@/lib/mosque-context";
import type { Mosque } from "@/types";

/**
 * MosqueInitializer — übergibt die server-seitig aufgelöste Moschee an den
 * Root-MosqueProvider, damit der Header sofort die korrekte Branding anzeigt
 * (kein client-seitiger Fetch, kein Flash).
 *
 * Wird im Slug-Layout eingebunden.
 */
export function MosqueInitializer({ mosque }: { mosque: Mosque }) {
  const { setMosqueData } = useMosque();

  useEffect(() => {
    setMosqueData(mosque);
    // Cleanup: Moschee zurücksetzen wenn Slug-Seite verlassen wird
    return () => {
      setMosqueData(null);
    };
  }, [mosque.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
