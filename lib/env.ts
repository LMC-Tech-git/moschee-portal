import { z } from "zod";

/**
 * Validierung der Umgebungsvariablen beim App-Start.
 * Stellt sicher, dass alle benötigten Variablen korrekt gesetzt sind.
 *
 * Pflichtfelder für Produktion:
 *   NEXT_PUBLIC_POCKETBASE_URL, NEXT_PUBLIC_APP_URL,
 *   PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD
 */
const envSchema = z.object({
  // -------------------------------------------------------
  // Öffentlich (Client + Server)
  // -------------------------------------------------------
  NEXT_PUBLIC_POCKETBASE_URL: z
    .string()
    .url("NEXT_PUBLIC_POCKETBASE_URL muss eine gültige URL sein"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // -------------------------------------------------------
  // Server-only
  // -------------------------------------------------------
  // Interne PB-URL (optional, Fallback: NEXT_PUBLIC_POCKETBASE_URL)
  // In Produktion: https://api.moschee.app
  POCKETBASE_URL: z.string().url().optional(),

  // PocketBase Admin-Credentials — zur Laufzeit erforderlich, optional beim Build
  // Werden als Server-Umgebungsvariablen gesetzt (nicht in .env-Dateien)
  PB_ADMIN_EMAIL: z.string().email().optional(),
  PB_ADMIN_PASSWORD: z.string().min(8).optional(),

  // Stripe — optional (Portal funktioniert ohne Zahlungen)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // -------------------------------------------------------
  // CAPTCHA (Cloudflare Turnstile)
  // Ohne diese Keys wird CAPTCHA graceful deaktiviert
  // -------------------------------------------------------
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),

  // -------------------------------------------------------
  // E-Mail (Resend.com)
  // Ohne diese Keys werden E-Mails nur simuliert (Console-Log)
  // -------------------------------------------------------
  RESEND_API_KEY: z.string().optional(),
  // z.B. "Moschee Portal <noreply@moschee.app>"
  RESEND_FROM_EMAIL: z.string().optional(),

  // -------------------------------------------------------
  // Kontaktformular
  // Zieladresse für Admin-Benachrichtigungen (Standard: kontakt@moschee.app)
  // -------------------------------------------------------
  CONTACT_EMAIL: z.string().email().optional(),

  // -------------------------------------------------------
  // Rate Limiting (Salt für IP-Hashing, DSGVO-konform)
  // -------------------------------------------------------
  RATE_LIMIT_SALT: z.string().optional(),

  // -------------------------------------------------------
  // Cron-Jobs (Bearer-Token zum Schutz interner Endpunkte)
  // -------------------------------------------------------
  CRON_SECRET: z.string().optional(),

  // -------------------------------------------------------
  // Node-Umgebung (wird von Next.js automatisch gesetzt)
  // -------------------------------------------------------
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      "❌ Ungültige Umgebungsvariablen:",
      result.error.flatten().fieldErrors
    );
    throw new Error(
      "Umgebungsvariablen sind nicht korrekt konfiguriert. " +
      "Prüfe .env.local (lokal) oder die Vercel Environment Variables (Produktion)."
    );
  }
  return result.data;
}
