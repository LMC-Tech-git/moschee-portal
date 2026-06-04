"use server";

import { getAuthFromCookie } from "@/lib/auth-cookie";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { hasFinancePermission } from "@/lib/finance-permissions-shared";
import type { FinancePermission } from "@/lib/finance-permissions-shared";

export type { FinancePermission };

/**
 * Finance-Schreibzugriff-Guard (Sprint 4, Q4 — leichtgewichtig).
 *
 * Prüft serverseitig: eingeloggt + Rolle ∈ {admin, super_admin, treasurer} +
 * mosque-match (super_admin darf mandantenübergreifend). Wird in den
 * UI-aufgerufenen Geld-Write-Pfaden genutzt (Settings-Update, Buchung erfassen,
 * Storno). NICHT in den Domain-Funktionen selbst — die müssen für Test-/Seed-/
 * System-Aufrufe ohne Cookie nutzbar bleiben.
 *
 * Feingranulare `FinancePermission` (view/create/storno/export) via
 * `assertFinancePermission` (Sprint 6). Phase 1: alle Perms an dieselben Rollen.
 */

const FINANCE_WRITE_ROLES = new Set(["admin", "super_admin", "treasurer"]);

/**
 * Lädt User + prüft Rolle/Mandant. Gemeinsamer Kern für assertFinanceAccess +
 * assertFinancePermission.
 */
async function loadFinanceUser(mosqueId: string): Promise<{ userId: string; role: string }> {
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
  // super_admin darf mandantenübergreifend; sonst strikter mosque-match.
  if (role !== "super_admin" && user.mosque_id !== mosqueId) {
    throw new Error("forbidden");
  }

  return { userId: auth.userId, role };
}

export async function assertFinanceAccess(mosqueId: string): Promise<{ userId: string }> {
  const { userId, role } = await loadFinanceUser(mosqueId);
  if (!FINANCE_WRITE_ROLES.has(role)) {
    throw new Error("forbidden");
  }
  return { userId };
}

/**
 * Feingranularer Permission-Guard (Sprint 6). = assertFinanceAccess-Logik +
 * zusätzlich `hasFinancePermission(role, perm)`-Check. Phase 1 verhält sich
 * identisch (alle Perms an admin/super_admin/treasurer), aber die granulare
 * Prüfung ist im Code dokumentiert für Sprint-7-Differenzierung.
 */
export async function assertFinancePermission(
  mosqueId: string,
  perm: FinancePermission
): Promise<{ userId: string }> {
  const { userId, role } = await loadFinanceUser(mosqueId);
  if (!hasFinancePermission(role, perm)) {
    throw new Error("forbidden");
  }
  return { userId };
}
