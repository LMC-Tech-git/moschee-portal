"use client";

import { useTranslations } from "next-intl";
import { formatCurrencyCents } from "@/lib/utils";
import type { KassenberichtReport, KontoBlock } from "@/types";

/** Kassenbericht: Anfang/Einnahmen/Ausgaben/Ende je Bar/Bank/Gesamt. */
export function KassenberichtTable({ report }: { report: KassenberichtReport }) {
  const t = useTranslations("finanzen");

  const rows: { label: string; block: KontoBlock; strong?: boolean }[] = [
    { label: t("konto.cash"), block: report.bar },
    { label: t("kasse.bankInklOther"), block: report.bank },
    { label: t("kasse.gesamt"), block: report.gesamt, strong: true },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500">
          <tr>
            <th className="px-4 py-2.5">{t("kasse.konto")}</th>
            <th className="px-4 py-2.5 text-right">{t("kasse.anfang")}</th>
            <th className="px-4 py-2.5 text-right">{t("kasse.einnahmen")}</th>
            <th className="px-4 py-2.5 text-right">{t("kasse.ausgaben")}</th>
            <th className="px-4 py-2.5 text-right">{t("kasse.ende")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.label} className={r.strong ? "bg-gray-50 font-semibold" : ""}>
              <td className="px-4 py-2.5 text-gray-700">{r.label}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{formatCurrencyCents(r.block.anfang_cents)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{formatCurrencyCents(r.block.einnahmen_cents)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-red-700">{formatCurrencyCents(r.block.ausgaben_cents)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900">{formatCurrencyCents(r.block.ende_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
