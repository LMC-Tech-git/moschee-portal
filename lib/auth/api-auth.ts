import type { NextRequest } from "next/server";
import { getAdminPB } from "@/lib/pocketbase-admin";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  mosque_id: string;
  status: string;
}

/**
 * Liest den Auth-Bearer-Token aus der Request, dekodiert das JWT
 * und verifiziert den User via Admin-PB.
 * Gibt null zurück bei ungültigem/abgelaufenem Token.
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);

  let userId: string;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    if (!payload.id || payload.type !== "authRecord") return null;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    userId = payload.id;
  } catch {
    return null;
  }

  try {
    const pb = await getAdminPB();
    const user = await pb.collection("users").getOne(userId);
    if (user.status !== "active") return null;
    return {
      id: user.id,
      email: user.email,
      role: user.role || "member",
      mosque_id: user.mosque_id || "",
      status: user.status,
    };
  } catch {
    return null;
  }
}

/**
 * Verifiziert dass der eingeloggte User Admin der spezifizierten
 * Moschee ist (oder super_admin).
 *
 * mosque_id wird gegen die Session validiert — kein trust auf Body/Query.
 */
export async function requireMosqueAdmin(
  request: NextRequest,
  mosqueId: string
): Promise<{ user: AuthenticatedUser; error?: never } | { user?: never; error: { status: number; message: string } }> {
  const user = await authenticateRequest(request);
  if (!user) {
    return { error: { status: 401, message: "Nicht angemeldet." } };
  }
  if (user.role === "super_admin") {
    return { user };
  }
  if (user.role !== "admin") {
    return { error: { status: 403, message: "Keine Admin-Berechtigung." } };
  }
  if (user.mosque_id !== mosqueId) {
    return { error: { status: 403, message: "Kein Zugriff auf diese Moschee." } };
  }
  return { user };
}
