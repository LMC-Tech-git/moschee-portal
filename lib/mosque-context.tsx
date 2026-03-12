"use client";
// MosqueContext v2 — refreshMosque support

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { getClientPB } from "@/lib/pocketbase";
import { useAuth } from "@/lib/auth-context";
import type { Mosque } from "@/types";
import type { RecordModel } from "pocketbase";

interface MosqueContextType {
  mosque: Mosque | null;
  mosqueId: string;
  isLoading: boolean;
  setMosqueOverride: (mosqueId: string | null) => void;
  overrideMosqueId: string | null;
  refreshMosque: () => void;
  /** Setzt Moschee-Daten direkt (z.B. von server-seitig aufgelöster Moschee in Slug-Layout) */
  setMosqueData: (mosque: Mosque | null) => void;
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
  initialMosque?: Mosque | null;
}

// Routen die keinen Moschee-Slug in der URL haben
const RESERVED_PATHS = [
  "admin", "member", "lehrer", "imam", "login", "register", "api", "invite",
];

export function MosqueProvider({ children, initialMosque }: MosqueProviderProps) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const pathname = usePathname();
  const [mosque, setMosque] = useState<Mosque | null>(initialMosque ?? null);
  const [isLoading, setIsLoading] = useState(!initialMosque);
  const [overrideMosqueId, setOverrideMosqueIdState] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("superAdminMosqueId");
    }
    return null;
  });

  const [refreshKey, setRefreshKey] = useState(0);

  const refreshMosque = useCallback(() => setRefreshKey(k => k + 1), []);

  const setMosqueOverride = useCallback((mosqueId: string | null) => {
    setOverrideMosqueIdState(mosqueId);
    if (typeof window !== "undefined") {
      if (mosqueId) {
        localStorage.setItem("superAdminMosqueId", mosqueId);
      } else {
        localStorage.removeItem("superAdminMosqueId");
      }
    }
  }, []);

  // Direktes Setzen der Moschee (z.B. vom MosqueInitializer in Slug-Layouts)
  const setMosqueData = useCallback((m: Mosque | null) => {
    setMosque(m);
    if (m) setIsLoading(false);
  }, []);

  useEffect(() => {
    if (initialMosque) return;
    if (authLoading) return;

    async function loadMosque() {
      setIsLoading(true);
      try {
        const pb = getClientPB();
        if (user?.role === "super_admin") {
          if (overrideMosqueId) {
            const record = await pb.collection("mosques").getOne(overrideMosqueId);
            setMosque(mapRecordToMosque(record));
          } else {
            setMosque(null);
          }
        } else if (isAuthenticated && user?.mosque_id) {
          const record = await pb.collection("mosques").getOne(user.mosque_id);
          setMosque(mapRecordToMosque(record));
        } else {
          // Nicht eingeloggt: Moschee aus URL-Slug laden (für öffentliche Seiten)
          const parts = pathname.split("/").filter(Boolean);
          const slugFromPath =
            parts.length > 0 && !RESERVED_PATHS.includes(parts[0])
              ? parts[0]
              : null;

          if (slugFromPath) {
            try {
              const result = await pb.collection("mosques").getList(1, 1, {
                filter: `slug="${slugFromPath}"`,
              });
              setMosque(
                result.items.length > 0
                  ? mapRecordToMosque(result.items[0])
                  : null
              );
            } catch {
              setMosque(null);
            }
          } else {
            // Keine Moschee für Landing Page, Login etc.
            setMosque(null);
          }
        }
      } catch (error) {
        console.error("Fehler beim Laden der Moschee:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadMosque();
  }, [initialMosque, authLoading, isAuthenticated, user?.mosque_id, user?.role, overrideMosqueId, refreshKey, pathname]);

  return (
    <MosqueContext.Provider value={{ mosque, mosqueId: mosque?.id || "", isLoading, setMosqueOverride, overrideMosqueId, refreshMosque, setMosqueData }}>
      {children}
    </MosqueContext.Provider>
  );
}

export function useMosque() {
  const context = useContext(MosqueContext);
  if (!context) throw new Error("useMosque muss innerhalb eines MosqueProvider verwendet werden");
  return context;
}
