// ============================================================
// Moschee-Portal Service Worker
// Strategie: Mandanten-sicher, kein Cache-Mixing
// ============================================================

// WICHTIG: Bei jeder Änderung an dieser Datei CACHE_VERSION hochzählen,
// sonst bleibt der alte Service Worker bei Clients aktiv.
const CACHE_VERSION = "v8";
const STATIC_CACHE = `moschee-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `moschee-runtime-${CACHE_VERSION}`;
const IMAGE_CACHE = `moschee-images-${CACHE_VERSION}`;

// Max. Einträge im Cross-Origin-Bilder-Cache (PocketBase-Dateien)
const IMAGE_CACHE_MAX = 80;

// Statische Assets die beim Install gecacht werden
const PRECACHE_URLS = [
  "/",
  "/offline",
  "/icons/icon-192x192.png",
  "/icons/icon-180x180.png",
  "/icons/icon.png",
  "/manifest.json",
];

// Muster die NIEMALS gecacht werden dürfen
const NO_CACHE_PATTERNS = [
  /\/admin(\/|$)/,        // Admin-Bereich
  /\/member(\/|$)/,       // Member-Bereich
  /\/login(\/|$)/,        // Login
  /\/register(\/|$)/,     // Register
  /\/api\//,              // API-Routen (inkl. Webhooks)
  /\/_next\/data\//,      // Next.js Data-Fetches (enthalten user-spezifische Daten)
];

// Statische Asset-Muster (Cache First)
const STATIC_ASSET_PATTERN = /\.(js|css|woff2?|ttf|svg|png|jpg|jpeg|webp|ico|gif)$/;

// ============================================================
// Install: Statische Assets vorab cachen
// ============================================================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        // Einzeln cachen statt addAll: ein 4xx/5xx (z.B. "/") darf
        // die gesamte Installation nicht abbrechen.
        Promise.all(
          PRECACHE_URLS.map((u) =>
            cache.add(u).catch((err) => {
              console.warn("[SW] Precache fehlgeschlagen:", u, err);
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

// ============================================================
// Activate: Alte Caches löschen
// ============================================================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key !== STATIC_CACHE &&
                key !== RUNTIME_CACHE &&
                key !== IMAGE_CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ============================================================
// Fetch: Caching-Strategien
// ============================================================
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 0. Nur GET-Requests behandeln (POST/PUT/DELETE = Mutationen)
  if (request.method !== "GET") return;

  // 1. Cross-Origin: nur PocketBase-Dateien (Bilder/Logos) cachen.
  //    Mandanten-sicher, da Cache-Key die volle URL ist (inkl. Collection+Record-ID).
  //    PB-Dateien sind public; verschiedene Moscheen haben verschiedene URLs.
  if (url.origin !== self.location.origin) {
    if (url.pathname.includes("/api/files/")) {
      event.respondWith(imageStaleWhileRevalidate(request));
    }
    return;
  }

  // 3. Niemals Auth/Admin/API cachen
  if (NO_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname))) return;

  // 4. Strategie wählen
  if (STATIC_ASSET_PATTERN.test(url.pathname) || url.pathname.startsWith("/_next/static/")) {
    // --- Cache First: Statische Assets ---
    event.respondWith(cacheFirst(request));
  } else {
    // --- Network First: HTML-Seiten und dynamische Inhalte ---
    event.respondWith(networkFirst(request));
  }
});

// ============================================================
// Cache First (für statische Assets)
// ============================================================
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

// ============================================================
// Network First (für HTML-Seiten)
// Mandanten-sicher: Cache-Key = volle URL inkl. Slug
// ============================================================
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
      // HTML-Seiten im Runtime-Cache speichern
      // Der Cache-Key ist die volle URL (inkl. /ditib-ulm/events etc.)
      // → Dadurch werden verschiedene Moscheen automatisch getrennt
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline: Versuche gecachte Version
    const cached = await caches.match(request);
    if (cached) return cached;

    // Fallback: Offline-Seite
    const offlinePage = await caches.match("/offline");
    if (offlinePage) return offlinePage;

    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/html" },
    });
  }
}

// ============================================================
// Stale-While-Revalidate (Cross-Origin PocketBase-Bilder)
// Sofort aus Cache liefern, im Hintergrund aktualisieren.
// ============================================================
async function imageStaleWhileRevalidate(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).then(() => trimImageCache(cache));
      }
      return response;
    })
    .catch(() => null);

  // Cache zuerst (schnell), sonst auf Netzwerk warten
  return cached || (await network) || new Response("", { status: 504 });
}

// Einfache LRU-artige Begrenzung: älteste Einträge entfernen
async function trimImageCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= IMAGE_CACHE_MAX) return;
  const overflow = keys.length - IMAGE_CACHE_MAX;
  for (let i = 0; i < overflow; i++) {
    await cache.delete(keys[i]);
  }
}

// ============================================================
// Push: eingehende Benachrichtigung anzeigen
// ============================================================
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Moschee-Portal", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Moschee-Portal";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192x192.png",
    badge: data.badge || "/icons/icon-192x192.png",
    tag: data.tag || "moschee-push",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ============================================================
// Notification-Klick: vorhandenen Tab fokussieren oder neuen öffnen
// ============================================================
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Sicherheit: nur interne, relative Pfade zulassen (kein Open-Redirect /
  // Phishing über manipulierte Payloads). Protokoll-relative "//host" sperren.
  const raw = (event.notification.data && event.notification.data.url) || "/";
  const target =
    typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")
      ? raw
      : "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          // Gleiche Origin → fokussieren und navigieren
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client && target) {
              return client.navigate(target).catch(() => {});
            }
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(target);
        }
      })
  );
});
