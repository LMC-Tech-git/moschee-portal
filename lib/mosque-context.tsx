"use client";
// MosqueContext v2 — refreshMosque support

import {
  createContext,
  useContext,
  useEffect,
  useRef,
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
  teamVisibility: string;
  setTeamVisibility: (val: string) => void;
  sponsorsEnabled: boolean;
  setSponsorsEnabled: (val: boolean) => void;
}

const MosqueContext = createContext<MosqueContextType | null>(null);


interface MosqueProviderProps {
  children: ReactNode;
  initialMosque?: Mosque | null;
}

// Routen die keinen Moschee-Slug in der URL haben (öffentliche Seiten-Namen einschließen!)
const RESERVED_PATHS = [
  "admin", "member", "lehrer", "imam", "login", "register", "api", "invite",
  "impressum", "datenschutz", "agb", "kontakt", "offline",
  "passwort-vergessen", "passwort-zuruecksetzen",
  "events", "donate", "posts", "campaigns",
  "leitung", "foerderpartner",
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
  const [teamVisibility, setTeamVisibility] = useState("public");
  const [sponsorsEnabled, setSponsorsEnabled] = useState(false);

  // Verhindert, dass loadMosque() den Mosque überschreibt der vom MosqueInitializer gesetzt wurde
  const externallySetRef = useRef(false);

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

  // Direktes Setzen der Moschee (vom MosqueInitializer in Slug-Layouts)
  // Setzt externallySetRef damit loadMosque() den Mosque nicht überschreibt.
  const setMosqueData = useCallback((m: Mosque | null) => {
    externallySetRef.current = !!m;
    setMosque(m);
    if (m) setIsLoading(false);
  }, []);

  useEffect(() => {
    if (initialMosque) return;
    if (authLoading) return;

    let cancelled = false;

    async function loadMosque() {
      // Wenn MosqueInitializer bereits die Moschee gesetzt hat, nicht überschreiben
      if (externallySetRef.current) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        // Server Actions verwenden getAdminPB() → umgeht PB viewRule-Beschränkungen
        if (user?.role === "super_admin") {
          if (overrideMosqueId) {
            const m = await getMosqueById(overrideMosqueId);
            if (cancelled || externallySetRef.current) return;
            setMosque(m);
            if (m) {
              const flags = await getFeatureFlags(m.id);
              if (!cancelled) {
                setTeamEnabled(flags.team_enabled);
                setSponsorsEnabled(flags.sponsors_enabled);
              }
            }
          } else {
            if (!cancelled) setMosque(null);
          }
        } else if (isAuthenticated && user?.mosque_id) {
          const m = await getMosqueById(user.mosque_id);
          if (cancelled || externallySetRef.current) return;
          setMosque(m);
          if (m) {
            const flags = await getFeatureFlags(m.id);
            if (!cancelled) {
              setTeamEnabled(flags.team_enabled);
              setSponsorsEnabled(flags.sponsors_enabled);
            }
          }
        } else {
          // Nicht eingeloggt: Moschee ermitteln
          const parts = pathname.split("/").filter(Boolean);
          const slugFromPath =
            parts.length > 0 && !RESERVED_PATHS.includes(parts[0])
              ? parts[0]
              : null;

          if (slugFromPath) {
            // Slug direkt aus URL-Pfad (Hauptdomain: moschee.app/demo/events → "demo")
            const m = await getMosqueBySlug(slugFromPath);
            if (!cancelled && !externallySetRef.current) setMosque(m);
          } else if (typeof window !== "undefined") {
            // Kein Slug im Pfad — Subdomain auslesen (demo.moschee.app → "demo")
            const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "moschee.app";
            const hostname = window.location.hostname;
            if (hostname !== rootDomain && hostname !== `www.${rootDomain}` && hostname.endsWith(`.${rootDomain}`)) {
              const subSlug = hostname.slice(0, hostname.length - rootDomain.length - 1);
              if (subSlug) {
                const m = await getMosqueBySlug(subSlug);
                if (!cancelled && !externallySetRef.current) setMosque(m);
              } else {
                if (!cancelled) setMosque(null);
              }
            } else {
              // Hauptdomain ohne Slug (Landing Page, Login etc.)
              if (!cancelled) setMosque(null);
            }
          } else {
            if (!cancelled) setMosque(null);
          }
        }
      } catch (error) {
        console.error("Fehler beim Laden der Moschee:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadMosque();
    return () => { cancelled = true; };
  }, [initialMosque, authLoading, isAuthenticated, user?.mosque_id, user?.role, overrideMosqueId, refreshKey, pathname]);

  return (
    <MosqueContext.Provider value={{ mosque, mosqueId: mosque?.id || user?.mosque_id || "", isLoading, setMosqueOverride, overrideMosqueId, refreshMosque, setMosqueData, teamEnabled, setTeamEnabled, teamVisibility, setTeamVisibility, sponsorsEnabled, setSponsorsEnabled }}>
      {children}
    </MosqueContext.Provider>
  );
}

export function useMosque() {
  const context = useContext(MosqueContext);
  if (!context) throw new Error("useMosque muss innerhalb eines MosqueProvider verwendet werden");
  return context;
}
