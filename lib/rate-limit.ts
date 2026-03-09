/**
 * Einfacher In-Memory Rate Limiter.
 * Für Produktion: Redis-basiertes Rate Limiting empfohlen.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number; // ms-Timestamp
}

const store = new Map<string, RateLimitEntry>();

// Alten Einträge alle 5 Minuten aufräumen
setInterval(() => {
  const now = Date.now();
  store.forEach((entry, key) => {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  });
}, 5 * 60 * 1000);

/**
 * Prüft ob ein Request das Rate Limit überschreitet.
 *
 * @param key - Eindeutiger Schlüssel (z.B. IP-Hash + Action)
 * @param maxRequests - Max. erlaubte Requests im Zeitfenster
 * @param windowMs - Zeitfenster in Millisekunden (Default: 1 Stunde)
 * @returns RateLimitResult mit allowed, remaining, limit, resetAt
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs = 60 * 60 * 1000
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, limit: maxRequests, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, limit: maxRequests, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, limit: maxRequests, resetAt: entry.resetAt };
}

/**
 * Erstellt Standard-HTTP-Headers für Rate-Limit-Antworten.
 * Auf 429-Responses wird zusätzlich Retry-After gesetzt.
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
  if (!result.allowed) {
    const retryAfter = Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000));
    headers["Retry-After"] = String(retryAfter);
  }
  return headers;
}

/**
 * Erstellt einen SHA-256-Hash einer IP-Adresse (für Datenschutz).
 */
export async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + (process.env.RATE_LIMIT_SALT || "moschee-portal"));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
