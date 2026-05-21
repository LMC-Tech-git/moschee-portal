"use client";

import { useTranslations } from "next-intl";
import { formatCurrencyCents } from "@/lib/utils";
import type { EURReport } from "@/types";

/** EÜR-Tabelle: Einnahmen/Ausgaben je Kategorie + Überschuss. */
export function EurTable({ eur }: { eur: EURReport }) {
  const t = useTranslations("finanzen");

  const Section = ({
    title,
    rows,
    total,
    positive,
  }: {
    title: string;
    rows: { kategorie: string; cents: number }[];
    total: number;
    positive: boolean;
  }) => (
    <div className="overflow-hidden rounded-xl border border-gray-100">
      <div className="bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-700">{title}</div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.kategorie}>
              <td className="px-4 py-2 text-gray-700">{t(`kategorie.${r.kategorie}`)}</td>
              <td
                className={`px-4 py-2 text-right tabular-nums ${
                  positive ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {formatCurrencyCents(r.cents)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
            <td className="px-4 py-2.5 text-gray-800">{t("eur.summe")}</td>
            <td className={`px-4 py-2.5 text-right tabular-nums ${positive ? "text-emerald-700" : "text-red-700"}`}>
              {formatCurrencyCents(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={t("eur.einnahmen")} rows={eur.einnahmen} total={eur.einnahmen_total_cents} positive />
        <Section title={t("eur.ausgaben")} rows={eur.ausgaben} total={eur.ausgaben_total_cents} positive={false} />
      </div>
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <span className="font-semibold text-gray-800">{t("eur.ueberschuss")}</span>
        <span
          className={`text-lg font-bold tabular-nums ${
            eur.ueberschuss_cents >= 0 ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {formatCurrencyCents(eur.ueberschuss_cents)}
        </span>
      </div>
    </div>
  );
}
