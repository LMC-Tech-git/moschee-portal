"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import PocketBase, { type RecordModel } from "pocketbase";
import { getClientPB } from "@/lib/pocketbase";
import {
  loginAction,
  registerAction,
  refreshTokenAction,
} from "@/lib/actions/auth";

interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string; // Computed: first_name + last_name
  phone: string;
  address: string;
  member_no: string;
  mosque_id: string;
  role: "member" | "admin" | "teacher" | "imam" | "editor" | "super_admin" | "madrasa_admin" | "treasurer" | "secretary";
  status: "pending" | "active" | "blocked";
}

interface AuthContextType {
  user: AuthUser | null;
  pb: PocketBase;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (data: RegisterData) => Promise<void>;
  /** Holt frische User-Daten aus PocketBase und aktualisiert den Auth-State */
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  passwordConfirm: string;
  first_name: string;
  last_name: string;
  member_no?: string;
  mosque_id: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

function mapRecordToUser(record: RecordModel): AuthUser {
  const firstName = record.first_name || "";
  const lastName = record.last_name || "";
  return {
    id: record.id,
    email: record.email || "",
    first_name: firstName,
    last_name: lastName,
    full_name:
      record.full_name ||
      `${firstName} ${lastName}`.trim() ||
      record.email || "",
    phone: record.phone || "",
    address: record.address || "",
    member_no: record.member_no || record.membership_number || "",
    mosque_id: record.mosque_id || "",
    role: (["admin","teacher","imam","editor","super_admin","madrasa_admin","treasurer","secretary"] as const).includes(record.role) ? record.role as AuthUser["role"] : "member",
    status: record.status || "pending",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [pb] = useState(() => getClientPB());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // BFCache-Schutz: Wenn Seite aus bfcache wiederhergestellt wird aber Auth-Cookie fehlt
  // → Seite neu laden, damit Server den korrekten (ausgeloggten) Inhalt rendert.
  // Ohne dies sieht der User nach dem Logout beim Zurück-Button noch die alte Seite mit Mitglieder-Inhalten.
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted && !document.cookie.includes("pb_auth=")) {
        window.location.reload();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  // Auth-State beim Laden initialisieren
  useEffect(() => {
    if (pb.authStore.isValid && pb.authStore.record) {
      setUser(mapRecordToUser(pb.authStore.record));
    }
    setIsLoading(false);

    // Auth-Store-Änderungen überwachen
    const unsubscribe = pb.authStore.onChange((_token, record) => {
      if (record) {
        setUser(mapRecordToUser(record));
      } else {
        setUser(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [pb]);

  const login = useCallback(
    async (email: string, password: string) => {
      // Server Action: PB-Auth läuft server-seitig (kein Mixed-Content/CORS)
      const { token, record } = await loginAction(email, password);
      // Token client-seitig speichern → triggert onChange → Cookie + setUser
      pb.authStore.save(token, record as unknown as RecordModel);
    },
    [pb]
  );

  const logout = useCallback(() => {
    pb.authStore.clear();
    setUser(null);
    // Explizit Cookie löschen — nicht auf authStore.onChange-Timing verlassen
    // (ältere PB-SDK-Versionen können onChange vor dem eigentlichen Clear feuern)
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "moschee.app";
    document.cookie = `pb_auth=; path=/; domain=.${rootDomain}; max-age=0; SameSite=Lax`;
    document.cookie = `pb_auth=; path=/; max-age=0; SameSite=Lax`;
    // Hard redirect: loescht Next.js Router-Cache komplett, Middleware prueft Cookie neu
    window.location.href = '/login';
  }, [pb]);

  const refreshUser = useCallback(async () => {
    try {
      const { token, record } = await refreshTokenAction(pb.authStore.token);
      pb.authStore.save(token, record as unknown as RecordModel);
    } catch {
      // Token abgelaufen o.ä. → ausloggen
      pb.authStore.clear();
      setUser(null);
    }
  }, [pb]);

  const register = useCallback(
    async (data: RegisterData) => {
      // Server Action: Registrierung + Auto-Login (pending-User sehen Gate-Seite)
      const { token, record } = await registerAction(data);
      pb.authStore.save(token, record as unknown as RecordModel);
    },
    [pb]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        pb,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        register,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth muss innerhalb eines AuthProvider verwendet werden");
  }
  return context;
}
