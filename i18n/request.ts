import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  // Locale aus Cookie oder Accept-Language-Header (vom Middleware gesetzt)
  let locale = await requestLocale;

  // Fallback auf Default wenn Locale unbekannt
  if (!locale || !(routing.locales as readonly string[]).includes(locale)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
