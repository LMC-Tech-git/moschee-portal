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
import { useAuth } from "@/lib/auth-context";
import { getMosqueById, getMosqueBySlug } from "@/lib/actions/mosques";
import { getFeatureFlags } from "@/lib/actions/settings";
import type { Mosque } from "@/types";

interface MosqueContextType {
  mosque: Mosque | null;
  mosqueId: string;
  isLoading: boolean;
  setMosqueOverride: (mosqueId: string | null) => void;
  overrideMosqueId: string | null;
  refreshMosque: () => void;
  /** Setzt Moschee-Daten direkt (z.B. von server-seitig aufgelöster Moschee in Slug-Layout) */
  setMosqueData: (mosque: Mosque | null) => void;
  /** Feature-Flags aus Settings (vom Slug-Layout befüllt) */
  teamEnabled: boolean;
  setTeamEnabled: (val: boolean) => void;
  sponsorsEnabled: boolean;
  setSponsorsEnabled: (val: boolean) => void;
}

const MosqueContext = createContext<MosqueContextType | null>(null);


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
  const [teamEnabled, setTeamEnabled] = useState(false);
  const [sponsorsEnabled, setSponsorsEnabled] = useState(false);

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
        // Server Actions verwenden getAdminPB() → umgeht PB viewRule-Beschränkungen
        if (user?.role === "super_admin") {
          if (overrideMosqueId) {
            const m = await getMosqueById(overrideMosqueId);
            setMosque(m);
            if (m) {
              const flags = await getFeatureFlags(m.id);
              setTeamEnabled(flags.team_enabled);
              setSponsorsEnabled(flags.sponsors_enabled);
            }
          } else {
            setMosque(null);
          }
        } else if (isAuthenticated && user?.mosque_id) {
          const m = await getMosqueById(user.mosque_id);
          setMosque(m);
          if (m) {
            const flags = await getFeatureFlags(m.id);
            setTeamEnabled(flags.team_enabled);
            setSponsorsEnabled(flags.sponsors_enabled);
          }
        } else {
          // Nicht eingeloggt: Moschee aus URL-Slug laden (für öffentliche Seiten)
          const parts = pathname.split("/").filter(Boolean);
          const slugFromPath =
            parts.length > 0 && !RESERVED_PATHS.includes(parts[0])
              ? parts[0]
              : null;

          if (slugFromPath) {
            const m = await getMosqueBySlug(slugFromPath);
            setMosque(m);
          } else {
            // Kein Slug in URL — prüfen ob Demo-Subdomain (für /login, /register etc.)
            const demoSlug = process.env.NEXT_PUBLIC_DEMO_SLUG || "demo";
            const demoDomain = `demo.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "moschee.app"}`;
            if (typeof window !== "undefined" && window.location.hostname === demoDomain) {
              const m = await getMosqueBySlug(demoSlug);
              setMosque(m);
            } else {
              // Keine Moschee für Landing Page, Login etc.
              setMosque(null);
            }
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
    <MosqueContext.Provider value={{ mosque, mosqueId: mosque?.id || user?.mosque_id || "", isLoading, setMosqueOverride, overrideMosqueId, refreshMosque, setMosqueData, teamEnabled, setTeamEnabled, sponsorsEnabled, setSponsorsEnabled }}>
      {children}
    </MosqueContext.Provider>
  );
}

export function useMosque() {
  const context = useContext(MosqueContext);
  if (!context) throw new Error("useMosque muss innerhalb eines MosqueProvider verwendet werden");
  return context;
}
