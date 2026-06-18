import { getLocale } from "next-intl/server";
import { getAuthFromCookie } from "@/lib/auth-cookie";
import { getAdminPB } from "@/lib/pocketbase-admin";
import {
  getMosqueAcceptanceStatus,
  getUserAcceptanceStatus,
} from "@/lib/actions/legal";
import type { LegalDocType, LegalLocale } from "@/lib/legal";
import AuthShell from "./AuthShell";

// Nur Gemeinde-Admins (Vorstand) müssen Verträge akzeptieren. Der
// super_admin ist der Plattform-Betreiber und schließt keinen Vertrag mit
// sich selbst — daher von beiden Gates ausgenommen.
const MOSQUE_ADMIN_ROLES = new Set(["admin"]);

/**
 * Server-Layout: löst den Rechts-Gate-Status server-seitig auf (aus dem
 * pb_auth-Cookie), damit das blockierende Modal ohne Flash erscheint.
 * Die eigentliche Auth-Weiterleitung bleibt in der Client-Hülle (AuthShell).
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = ((await getLocale()) as LegalLocale) || "de";
  const { isLoggedIn, userId } = getAuthFromCookie();

  let mosqueOutstanding: LegalDocType[] = [];
  let userOutstanding: LegalDocType[] = [];

  if (isLoggedIn && userId) {
    let role = "";
    let mosqueId = "";
    try {
      const pb = await getAdminPB();
      const u = await pb.collection("users").getOne(userId, {
        fields: "role,mosque_id",
      });
      role = (u as { role?: string }).role || "";
      mosqueId = (u as { mosque_id?: string }).mosque_id || "";
    } catch {
      // Cookie kann veraltet sein → Gates bleiben leer, AuthShell leitet um
    }

    // super_admin = Betreiber → kein Gate (weder Vorstand noch Nutzer)
    if (role !== "super_admin") {
      if (mosqueId && MOSQUE_ADMIN_ROLES.has(role)) {
        mosqueOutstanding = (await getMosqueAcceptanceStatus(mosqueId)).outstanding;
      }
      userOutstanding = (await getUserAcceptanceStatus(userId)).outstanding;
    }
  }

  return (
    <AuthShell
      mosqueOutstanding={mosqueOutstanding}
      userOutstanding={userOutstanding}
      locale={locale}
    >
      {children}
    </AuthShell>
  );
}
