/**
 * Demo-Modus Konfiguration
 *
 * Setzt NEXT_PUBLIC_DEMO_MOSQUE_ID in .env.local nach dem Seeden.
 * Demo-Accounts: demo-admin@moschee.app / demo-teacher@moschee.app / demo-member@moschee.app
 * Passwort: Demo1234!
 */

import { getAdminPB } from "@/lib/pocketbase-admin";

export const DEMO_MOSQUE_ID = process.env.NEXT_PUBLIC_DEMO_MOSQUE_ID ?? "";

export const DEMO_LIMITS = {
  events: 30,
  posts: 30,
  members: 50,
  students: 50,
} as const;

/** Gibt true zurück wenn die mosqueId die Demo-Moschee ist. */
export function isDemoMosque(mosqueId: string): boolean {
  return DEMO_MOSQUE_ID !== "" && mosqueId === DEMO_MOSQUE_ID;
}

/**
 * Prüft ob ein Datenlimit in der Demo-Moschee erreicht wurde.
 * Gibt { allowed: true } zurück wenn es keine Demo-Moschee ist oder das Limit noch nicht erreicht wurde.
 */
export async function checkDemoLimit(
  mosqueId: string,
  collection: keyof typeof DEMO_LIMITS
): Promise<{ allowed: boolean; error?: string }> {
  if (!isDemoMosque(mosqueId)) return { allowed: true };

  const pb = await getAdminPB();
  const pbCollection = collection === "members" ? "users" : collection;
  const limit = DEMO_LIMITS[collection];

  try {
    const result = await pb.collection(pbCollection).getList(1, 1, {
      filter: `mosque_id = "${mosqueId}"`,
      fields: "id",
    });

    if (result.totalItems >= limit) {
      return {
        allowed: false,
        error: `Demo-Limit erreicht (max. ${limit}). Daten werden regelmäßig zurückgesetzt.`,
      };
    }
  } catch {
    // Fail open: Im Fehlerfall erlauben
  }

  return { allowed: true };
}
