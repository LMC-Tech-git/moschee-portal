import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://moschee.app").replace(/\/$/, "");

  return {
    rules: [
      {
        // Alle Crawler: öffentliche Seiten erlauben
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/admin/",    // Admin-Panel
          "/member/",   // Mitglieder-Bereich
          "/lehrer/",   // Lehrer-Panel
          "/api/",      // API-Routen
          "/login",     // Login-Seite (kein SEO-Wert)
          "/register",  // Registrierung (kein SEO-Wert)
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
