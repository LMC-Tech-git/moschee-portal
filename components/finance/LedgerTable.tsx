"use client";

import { Undo2, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatCurrencyCents, formatDate } from "@/lib/utils";
import type { LedgerAtom } from "@/types";

/** Desktop-Tabelle der gemergten LedgerAtoms (read-only Events + manuelle Buchungen). */
export function LedgerTable({
  atoms,
  onStorno,
}: {
  atoms: LedgerAtom[];
  onStorno?: (id: string) => void;
}) {
  const t = useTranslations("finanzen");

  if (atoms.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">{t("ledger.empty")}</p>;
  }

  return (
    <div className="hidden overflow-hidden rounded-xl border border-gray-100 lg:block">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500">
          <tr>
            <th className="px-4 py-2.5">{t("col.datum")}</th>
            <th className="px-4 py-2.5">{t("col.beleg")}</th>
            <th className="px-4 py-2.5">{t("col.kategorie")}</th>
            <th className="px-4 py-2.5">{t("col.konto")}</th>
            <th className="px-4 py-2.5">{t("col.quelle")}</th>
            <th className="px-4 py-2.5 text-right">{t("col.betrag")}</th>
            <th className="px-4 py-2.5 text-right">{t("col.aktion")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {atoms.map((a) => {
            const isIncome = a.classification === "income";
            const manual = a.source_system === "manual_transaction";
            return (
              <tr key={`${a.source_system}-${a.id}`} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{formatDate(a.datum)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap font-mono text-xs text-gray-500">
                  {a.beleg_nummer || "—"}
                </td>
                <td className="px-4 py-2.5 text-gray-700">{t(`kategorie.${a.kategorie}`)}</td>
                <td className="px-4 py-2.5 text-gray-500">{t(`konto.${a.konto_typ}`)}</td>
                <td className="px-4 py-2.5">
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
                </td>
                <td
                  className={`px-4 py-2.5 text-right font-medium tabular-nums ${
                    isIncome ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {isIncome ? "+" : "−"}
                  {formatCurrencyCents(Math.abs(a.signed_amount_cents))}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {manual && onStorno ? (
                    <button
                      type="button"
                      onClick={() => onStorno(a.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      {t("action.storno")}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
