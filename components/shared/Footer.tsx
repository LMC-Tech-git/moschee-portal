import Link from "next/link";
import { Heart } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function Footer() {
  const t = await getTranslations();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-100 bg-gray-900 text-white print:hidden">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Über uns */}
          <div>
            <h3 className="mb-4 text-lg font-bold text-emerald-400">
              {t("footer.mosquePortal")}
            </h3>
            <p className="text-sm leading-relaxed text-gray-300">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Schnelllinks */}
          <nav aria-label={t("footer.quickLinks")}>
            <h3 className="mb-4 text-lg font-bold text-emerald-400">
              {t("footer.quickLinks")}
            </h3>
            <ul className="space-y-2">
              {[
                { label: t("nav.home"), href: "/" },
                { label: t("footer.contact"), href: "/kontakt" },
                { label: t("nav.login"), href: "/login" },
                { label: t("nav.register"), href: "/register" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-300 transition-colors hover:text-emerald-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Rechtliches */}
          <nav aria-label={t("footer.legal")}>
            <h3 className="mb-4 text-lg font-bold text-emerald-400">
              {t("footer.legal")}
            </h3>
            <ul className="space-y-2">
              {[
                { label: t("footer.imprint"), href: "/impressum" },
                { label: t("footer.privacy"), href: "/datenschutz" },
                { label: t("footer.terms"), href: "/agb" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-300 transition-colors hover:text-emerald-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Copyright */}
        <div className="mt-8 border-t border-gray-800 pt-8 text-center">
          <p className="flex flex-wrap items-center justify-center gap-x-1 text-sm text-gray-400">
            <span className="whitespace-nowrap">&copy; {currentYear} {t("footer.copyright")}</span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              Mit <Heart className="h-3 w-3 text-red-400" aria-hidden="true" /> gebaut für die Gemeinde.
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
