/** @type {import('next').NextConfig} */
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// PocketBase-URL aus Env — wird in CSP-Header referenziert.
// Lokal: http://91.98.142.128:8090
// Produktion: https://api.moschee.app
const pbUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://91.98.142.128:8090";
// Für CSP nur den Origin verwenden (ohne Pfad), damit Subpfade wie /pb/api/... erlaubt sind
const pbCspOrigin = (() => { try { return new URL(pbUrl).origin; } catch { return pbUrl; } })();

const nextConfig = {
  // Router Cache (client-seitig) für dynamische Seiten deaktivieren.
  // Ohne dies würden Seiten wie das Dashboard 30 Sekunden lang gecacht
  // und Echtzeit-Daten (Spenden, Kampagnenfortschritt etc.) würden veraltet angezeigt.
  experimental: {
    staleTimes: {
      dynamic: 0, // Dynamische Seiten (cookies/headers) immer frisch laden
      static: 180, // Statische Seiten 3 Minuten cachen
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '91.98.142.128',
        port: '8090',
        pathname: '/api/files/**',
      },
      {
        protocol: 'https',
        hostname: 'moschee.app',
        pathname: '/pb/api/files/**',
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Clickjacking-Schutz
          { key: "X-Frame-Options", value: "DENY" },
          // MIME-Sniffing verhindern
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer nur bei gleicher Origin vollständig senden
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // XSS-Filter des Browsers (deaktiviert, da CSP moderner ist)
          { key: "X-XSS-Protection", value: "0" },
          // HSTS: 2 Jahre, inkl. Subdomänen, HSTS Preload-fähig
          // .app-Domains erfordern HTTPS sowieso (HSTS Preload Liste)
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Berechtigungen einschränken
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
          // Content Security Policy
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js benötigt unsafe-inline/eval; Stripe JS für Checkout
              `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://challenges.cloudflare.com`,
              "style-src 'self' 'unsafe-inline'",
              // PB-URL dynamisch (Bilder aus PocketBase-Storage)
              `img-src 'self' data: blob: https: ${pbCspOrigin}`,
              "font-src 'self' https://fonts.gstatic.com",
              // API-Verbindungen: eigene App, Stripe, AlAdhan (Gebetszeiten), PocketBase
              `connect-src 'self' https://api.stripe.com https://api.aladhan.com ${pbCspOrigin}`,
              // Stripe Checkout-Iframe + Cloudflare Turnstile
              "frame-src https://js.stripe.com https://challenges.cloudflare.com",
              "worker-src 'self'",
              "manifest-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
