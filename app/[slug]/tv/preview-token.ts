/**
 * HMAC-signierter Preview-Token für die TV-Vorschau aus dem Admin-Panel.
 * Erlaubt das Öffnen der /tv-Route auch wenn tv_enabled=false ist.
 * 15 Minuten gültig, gebunden an Mosque-ID + User-ID.
 */
import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 15 * 60 * 1000;

function getSecret(): string {
  return (
    process.env.TV_PREVIEW_SECRET ||
    process.env.CRON_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "default-tv-preview-secret-change-me"
  );
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payload: string): string {
  const sig = createHmac("sha256", getSecret()).update(payload).digest();
  return b64url(sig);
}

export function signPreviewToken(mosqueId: string, userId: string): string {
  const expiresMs = Date.now() + TTL_MS;
  const payload = `${mosqueId}:${userId}:${expiresMs}`;
  const sig = sign(payload);
  return `${b64url(Buffer.from(payload))}.${sig}`;
}

export function verifyPreviewToken(token: string, mosqueId: string): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sigB64] = parts;
  let payload: string;
  try {
    payload = fromB64url(payloadB64).toString("utf8");
  } catch {
    return false;
  }
  const expected = sign(payload);
  // Timing-safe compare
  const a = Buffer.from(sigB64);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!timingSafeEqual(a, b)) return false;

  const segments = payload.split(":");
  if (segments.length !== 3) return false;
  const [tokenMosqueId, _userId, expiresStr] = segments;
  if (tokenMosqueId !== mosqueId) return false;
  const expiresMs = Number(expiresStr);
  if (!Number.isFinite(expiresMs)) return false;
  if (Date.now() > expiresMs) return false;
  return true;
}
