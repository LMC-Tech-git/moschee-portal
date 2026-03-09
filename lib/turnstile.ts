/**
 * Server-seitige Turnstile-Token-Verifikation.
 * Cloudflare Turnstile ist kostenlos und DSGVO-freundlich.
 *
 * Wenn kein TURNSTILE_SECRET_KEY konfiguriert ist, wird CAPTCHA übersprungen
 * (für lokale Entwicklung).
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Kein Secret = CAPTCHA deaktiviert (Entwicklung)
  if (!secret) {
    return true;
  }

  if (!token) {
    return false;
  }

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
      }),
    });

    const data = await res.json();
    return data.success === true;
  } catch (error) {
    console.error("[Turnstile] Verifikation fehlgeschlagen:", error);
    return false;
  }
}
