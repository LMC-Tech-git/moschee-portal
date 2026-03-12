import Link from "next/link";
import { Heart } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-100 bg-gray-900 text-white print:hidden">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Über uns */}
          <div>
            <h3 className="mb-4 text-lg font-bold text-emerald-400">
              Moschee-Portal
            </h3>
            <p className="text-sm leading-relaxed text-gray-300">
              Die digitale Plattform für Ihre muslimische Gemeinde. Verwalten
              Sie Spenden, Mitglieder und vieles mehr an einem zentralen Ort.
            </p>
          </div>

          {/* Schnelllinks */}
          <nav aria-label="Schnelllinks">
            <h3 className="mb-4 text-lg font-bold text-emerald-400">
              Schnelllinks
            </h3>
            <ul className="space-y-2">
              {[
                { label: "Startseite", href: "/" },
                { label: "Anmelden", href: "/login" },
                { label: "Registrieren", href: "/register" },
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
          <nav aria-label="Rechtliches">
            <h3 className="mb-4 text-lg font-bold text-emerald-400">
              Rechtliches
            </h3>
            <ul className="space-y-2">
              {[
                { label: "Impressum", href: "/impressum" },
                { label: "Datenschutz", href: "/datenschutz" },
                { label: "AGB", href: "/agb" },
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
            <span className="whitespace-nowrap">&copy; {currentYear} Moschee-Portal.</span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              Mit <Heart className="h-3 w-3 text-red-400" aria-hidden="true" /> gebaut für die Gemeinde.
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
