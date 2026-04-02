// ============================================================
// Moschee-Portal Service Worker
// Strategie: Mandanten-sicher, kein Cache-Mixing
// ============================================================

const CACHE_VERSION = "v3";
const STATIC_CACHE = `moschee-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `moschee-runtime-${CACHE_VERSION}`;

// Statische Assets die beim Install gecacht werden
const PRECACHE_URLS = [
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
      .then((cache) => cache.addAll(PRECACHE_URLS))
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
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
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

  // 1. Nur Same-Origin Requests behandeln
  if (url.origin !== self.location.origin) return;

  // 2. Nur GET-Requests cachen (POST/PUT/DELETE = Mutationen)
  if (request.method !== "GET") return;

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
