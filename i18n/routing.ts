import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  /** Unterstützte Sprachen */
  locales: ["de", "tr"] as const,
  /** Standard: Deutsch */
  defaultLocale: "de" as const,
  /**
   * Kein URL-Präfix (z.B. kein /de/ oder /tr/ in der URL).
   * Die Sprache wird per Cookie `NEXT_LOCALE` oder Accept-Language-Header erkannt.
   */
  localePrefix: "never",
});

export type Locale = (typeof routing.locales)[number];
