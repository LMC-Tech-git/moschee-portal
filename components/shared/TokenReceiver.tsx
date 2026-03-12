"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getClientPB } from "@/lib/pocketbase";

/**
 * TokenReceiver: Liest _token + _model URL-Params nach Cross-Domain-Redirect
 * (z.B. von moschee.app nach demo.moschee.app).
 * Speichert den Token im PocketBase authStore und bereinigt die URL.
 */
export function TokenReceiver() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get("_token");
    const model = searchParams.get("_model");

    if (token && model) {
      try {
        const record = JSON.parse(decodeURIComponent(model));
        getClientPB().authStore.save(token, record);
      } catch {
        // Ungültige Params — ignorieren
      }

      // URL-Params bereinigen
      const url = new URL(window.location.href);
      url.searchParams.delete("_token");
      url.searchParams.delete("_model");
      router.replace(url.pathname + url.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
