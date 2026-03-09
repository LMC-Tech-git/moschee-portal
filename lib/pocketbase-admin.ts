import PocketBase from "pocketbase";

/**
 * Server-seitiger PocketBase Admin-Client.
 * Authentifiziert sich mit Admin-Credentials für privilegierte Operationen.
 *
 * WICHTIG: NUR in Server Actions, Route Handlers und Server Components nutzen.
 * NIEMALS in Client Components importieren.
 */

let _adminPB: PocketBase | null = null;
let _adminAuthExpiry = 0;

/**
 * Authentifiziert per fetch über den alten /api/admins Endpunkt (PB < 0.23)
 * und setzt den Token manuell auf der PB-Instanz.
 */
async function authViaAdminsEndpoint(
  pb: PocketBase,
  url: string,
  email: string,
  password: string
): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/admins/auth-with-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: email, password }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    // Token manuell auf der PB-Instanz setzen
    pb.authStore.save(data.token, data.admin);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gibt eine authentifizierte Admin-PocketBase-Instanz zurück.
 * Token wird für 10 Minuten gecacht.
 */
export async function getAdminPB(): Promise<PocketBase> {
  const now = Date.now();

  if (_adminPB && _adminAuthExpiry > now) {
    return _adminPB;
  }

  const url = process.env.POCKETBASE_URL || process.env.NEXT_PUBLIC_POCKETBASE_URL;
  const email = process.env.PB_ADMIN_EMAIL;
  const password = process.env.PB_ADMIN_PASSWORD;

  if (!url) {
    throw new Error("POCKETBASE_URL oder NEXT_PUBLIC_POCKETBASE_URL fehlt");
  }

  if (!email || !password) {
    throw new Error(
      "PB_ADMIN_EMAIL und PB_ADMIN_PASSWORD müssen gesetzt sein"
    );
  }

  const pb = new PocketBase(url);

  // Auto-Cancellation deaktivieren: Das PB JS-SDK cancelled parallele Requests
  // zur selben Collection automatisch. Auf dem Server ist das schädlich, weil
  // z.B. computeProgress() für mehrere Kampagnen gleichzeitig läuft und alle
  // dieselbe Singleton-Instanz teilen. Ohne diesen Fix werden 2 von 3 Requests
  // still abgebrochen → raised_cents = 0.
  pb.autoCancellation(false);

  // Versuche zuerst alten Endpunkt (PB < 0.23), dann neuen (PB v0.23+)
  const oldAuth = await authViaAdminsEndpoint(pb, url, email, password);
  if (!oldAuth) {
    await pb.collection("_superusers").authWithPassword(email, password);
  }

  _adminPB = pb;
  _adminAuthExpiry = now + 10 * 60 * 1000; // 10 Minuten Cache

  return pb;
}
