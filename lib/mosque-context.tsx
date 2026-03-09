"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getClientPB } from "@/lib/pocketbase";
import { useAuth } from "@/lib/auth-context";
import type { Mosque } from "@/types";
import type { RecordModel } from "pocketbase";

interface MosqueContextType {
  mosque: Mosque | null;
  mosqueId: string;
  isLoading: boolean;
}

const MosqueContext = createContext<MosqueContextType | null>(null);

function mapRecordToMosque(record: RecordModel): Mosque {
  return {
    id: record.id,
    name: record.name || "",
    slug: record.slug || "",
    city: record.city || "",
    address: record.address || "",
    latitude: record.latitude || 0,
    longitude: record.longitude || 0,
    timezone: record.timezone || "Europe/Berlin",
    phone: record.phone || "",
    email: record.email || "",
    public_enabled: record.public_enabled ?? true,
    donation_provider: record.donation_provider || "none",
    paypal_donate_url: record.paypal_donate_url || "",
    external_donation_url: record.external_donation_url || "",
    external_donation_label: record.external_donation_label || "",
    zip_code: record.zip_code || "",
    website: record.website || "",
    brand_logo: record.brand_logo || "",
    brand_primary_color: record.brand_primary_color || "",
    brand_accent_color: record.brand_accent_color || "",
    brand_theme: record.brand_theme || "default",
    created: record.created || "",
    updated: record.updated || "",
  };
}

interface MosqueProviderProps {
  children: ReactNode;
  /** Server-seitig aufgelöste Moschee (z.B. aus Slug-Layout) */
  initialMosque?: Mosque | null;
}

/**
 * MosqueProvider — stellt die aktuelle Moschee bereit.
 *
 * V1 Logik:
 * 1. Wenn initialMosque übergeben (Slug-Route) → direkt verwenden
 * 2. Wenn User eingeloggt und mosque_id hat → lade diese Moschee
 * 3. Sonst → lade die erste (Standard-)Moschee aus der DB
 */
export function MosqueProvider({
  children,
  initialMosque,
}: MosqueProviderProps) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [mosque, setMosque] = useState<Mosque | null>(initialMosque ?? null);
  const [isLoading, setIsLoading] = useState(!initialMosque);

  useEffect(() => {
    // Wenn Server-Props vorhanden → nichts laden
    if (initialMosque) return;

    // Warten bis Auth geladen ist
    if (authLoading) return;

    async function loadMosque() {
      try {
        const pb = getClientPB();

        if (isAuthenticated && user?.mosque_id) {
          // User hat mosque_id → lade diese Moschee
          const record = await pb
            .collection("mosques")
            .getOne(user.mosque_id);
          setMosque(mapRecordToMosque(record));
        } else {
          // Kein User oder keine mosque_id → lade Standard-Moschee
          try {
            const result = await pb
              .collection("mosques")
              .getList(1, 1, { sort: "created" });
            if (result.items.length > 0) {
              setMosque(mapRecordToMosque(result.items[0]));
            }
          } catch {
            console.warn("Mosques Collection nicht gefunden oder leer.");
          }
        }
      } catch (error) {
        console.error("Fehler beim Laden der Moschee:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadMosque();
  }, [initialMosque, authLoading, isAuthenticated, user?.mosque_id]);

  return (
    <MosqueContext.Provider
      value={{
        mosque,
        mosqueId: mosque?.id || "",
        isLoading,
      }}
    >
      {children}
    </MosqueContext.Provider>
  );
}

export function useMosque() {
  const context = useContext(MosqueContext);
  if (!context) {
    throw new Error(
      "useMosque muss innerhalb eines MosqueProvider verwendet werden"
    );
  }
  return context;
}
