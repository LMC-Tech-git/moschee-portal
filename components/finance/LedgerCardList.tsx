"use client";

import { Undo2, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatCurrencyCents, formatDate } from "@/lib/utils";
import type { LedgerAtom } from "@/types";

/** Mobile Card-Liste der LedgerAtoms (grid-cols-1, kein overflow-x). */
export function LedgerCardList({
  atoms,
  onStorno,
}: {
  atoms: LedgerAtom[];
  onStorno?: (id: string) => void;
}) {
  const t = useTranslations("finanzen");

  if (atoms.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500 lg:hidden">{t("ledger.empty")}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:hidden">
      {atoms.map((a) => {
        const isIncome = a.classification === "income";
        const manual = a.source_system === "manual_transaction";
        return (
          <div
            key={`${a.source_system}-${a.id}`}
            className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-800">{t(`kategorie.${a.kategorie}`)}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {formatDate(a.datum)} · {t(`konto.${a.konto_typ}`)}
                  {a.beleg_nummer ? ` · ${a.beleg_nummer}` : ""}
                </p>
              </div>
              <p
                className={`shrink-0 font-semibold tabular-nums ${
                  isIncome ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {isIncome ? "+" : "−"}
                {formatCurrencyCents(Math.abs(a.signed_amount_cents))}
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between">
              {manual ? (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  {t("source.manual")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  <Lock className="h-3 w-3" />
                  {t("source.event")}
                </span>
              )}
              {manual && onStorno && (
                <button
                  type="button"
                  onClick={() => onStorno(a.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  {t("action.storno")}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
