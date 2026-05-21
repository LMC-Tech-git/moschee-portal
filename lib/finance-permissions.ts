"use server";

import { getAuthFromCookie } from "@/lib/auth-cookie";
import { getAdminPB } from "@/lib/pocketbase-admin";

/**
 * Finance-Schreibzugriff-Guard (Sprint 4, Q4 — leichtgewichtig).
 *
 * Prüft serverseitig: eingeloggt + Rolle ∈ {admin, super_admin, treasurer} +
 * mosque-match (super_admin darf mandantenübergreifend). Wird in den
 * UI-aufgerufenen Geld-Write-Pfaden genutzt (Settings-Update, Buchung erfassen,
 * Storno). NICHT in den Domain-Funktionen selbst — die müssen für Test-/Seed-/
 * System-Aufrufe ohne Cookie nutzbar bleiben.
 *
 * Feingranulare `FinancePermission` (view/create/storno/export) = Sprint 6.
 */

const FINANCE_WRITE_ROLES = new Set(["admin", "super_admin", "treasurer"]);

export async function assertFinanceAccess(mosqueId: string): Promise<{ userId: string }> {
  const auth = getAuthFromCookie();
  if (!auth.isLoggedIn || !auth.userId) {
    throw new Error("forbidden");
  }
  if (!mosqueId || typeof mosqueId !== "string") {
    throw new Error("forbidden");
  }

  const pb = await getAdminPB();
  let user: { role?: string; mosque_id?: string };
  try {
    user = (await pb.collection("users").getOne(auth.userId, {
      fields: "role,mosque_id",
    })) as unknown as { role?: string; mosque_id?: string };
  } catch {
    throw new Error("forbidden");
  }

  const role = user.role ?? "";
  if (!FINANCE_WRITE_ROLES.has(role)) {
    throw new Error("forbidden");
  }
  // super_admin darf mandantenübergreifend; sonst strikter mosque-match.
  if (role !== "super_admin" && user.mosque_id !== mosqueId) {
    throw new Error("forbidden");
  }

  return { userId: auth.userId };
}
