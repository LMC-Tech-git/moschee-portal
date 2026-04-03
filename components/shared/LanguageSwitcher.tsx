"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

const LOCALES = [
  { code: "de", label: "DE", flag: "🇩🇪", name: "Deutsch" },
  { code: "tr", label: "TR", flag: "🇹🇷", name: "Türkçe" },
] as const;

interface LanguageSwitcherProps {
  /** Kompaktes Layout: nur Flagge + Kürzel. Default: false */
  compact?: boolean;
}

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchLocale(newLocale: string) {
    if (newLocale === locale) return;
    // Locale im Cookie speichern (next-intl liest diesen Cookie automatisch)
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Sprache wählen">
      {LOCALES.map(({ code, label, flag, name }) => {
        const isActive = locale === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => switchLocale(code)}
            disabled={isPending || isActive}
            aria-pressed={isActive}
            title={name}
            className={[
              "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              isActive
                ? "bg-emerald-100 text-emerald-700 cursor-default"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
              isPending ? "opacity-50" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span aria-hidden="true">{flag}</span>
            {!compact && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
