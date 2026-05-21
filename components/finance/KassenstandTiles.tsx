"use client";

import { TrendingUp, TrendingDown, Scale, Coins, Landmark } from "lucide-react";
import { useTranslations } from "next-intl";
import { KPITile } from "@/components/shared/KPITile";
import { formatCurrencyCents } from "@/lib/utils";
import type { FinanceKPIs } from "@/types";

/** KPI-Kacheln für das Kassenbuch. Kassenstand = Jahres-Endbestand (carryover). */
export function KassenstandTiles({ kpis, year }: { kpis: FinanceKPIs; year: number }) {
  const t = useTranslations("finanzen");
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <KPITile
        icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
        label={t("kpi.einnahmen")}
        value={formatCurrencyCents(kpis.einnahmen_cents)}
      />
      <KPITile
        icon={<TrendingDown className="h-5 w-5 text-red-600" />}
        label={t("kpi.ausgaben")}
        value={formatCurrencyCents(kpis.ausgaben_cents)}
      />
      <KPITile
        icon={<Scale className="h-5 w-5 text-blue-600" />}
        label={t("kpi.saldo")}
        value={formatCurrencyCents(kpis.saldo_cents)}
      />
      <KPITile
        icon={<Coins className="h-5 w-5 text-amber-600" />}
        label={t("kpi.kassenstandBar", { year })}
        value={formatCurrencyCents(kpis.kassenstand_bar_cents)}
      />
      <KPITile
        icon={<Landmark className="h-5 w-5 text-violet-600" />}
        label={t("kpi.kassenstandBank", { year })}
        value={formatCurrencyCents(kpis.kassenstand_bank_cents)}
      />
    </div>
  );
}
