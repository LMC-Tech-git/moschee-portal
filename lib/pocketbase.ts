import PocketBase from "pocketbase";

/**
 * PocketBase Client-Instanz.
 * Wird auf dem Client (Browser) verwendet.
 * Die URL kommt aus der Umgebungsvariable NEXT_PUBLIC_POCKETBASE_URL.
 *
 * Auth-Token wird zusätzlich als "pb_auth" Cookie gespeichert,
 * damit die Next.js Middleware (server-side) den Auth-Status prüfen kann.
 */
export function createPocketBase() {
  const url = process.env.NEXT_PUBLIC_POCKETBASE_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_POCKETBASE_URL ist nicht konfiguriert. Bitte in .env.local setzen."
    );
  }
  return new PocketBase(url);
}

// Singleton für Client-Nutzung (wird im AuthProvider verwendet)
let clientInstance: PocketBase | null = null;

export function getClientPB(): PocketBase {
  if (typeof window === "undefined") {
    // Server-Seite: Immer neue Instanz
    return createPocketBase();
  }
  // Client-Seite: Singleton
  if (!clientInstance) {
    clientInstance = createPocketBase();

    // Auth-Token als Cookie speichern, damit Middleware + Server Components ihn lesen kann.
    // domain=.moschee.app → Cookie gilt für alle Subdomains (demo.moschee.app, etc.)
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "moschee.app";
    const cookieDomain = `domain=.${rootDomain}; `;

    const setAuthCookie = (pb: PocketBase) => {
      if (pb.authStore.isValid && pb.authStore.record) {
        const cookieVal = JSON.stringify({
          token: pb.authStore.token,
          model: { id: pb.authStore.record.id },
        });
        document.cookie = `pb_auth=${encodeURIComponent(cookieVal)}; path=/; ${cookieDomain}max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      } else {
        document.cookie = `pb_auth=; path=/; ${cookieDomain}max-age=0; SameSite=Lax`;
      }
    };

    clientInstance.authStore.onChange(() => {
      setAuthCookie(clientInstance!);
    });

    // Falls bereits ein Token aus localStorage vorhanden ist, sofort Cookie setzen
    setAuthCookie(clientInstance);
  }
  return clientInstance;
}
