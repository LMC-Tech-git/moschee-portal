"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useTranslations } from "next-intl";

interface Monat {
  month: string; // "2026-03"
  einnahmen_cents: number;
  ausgaben_cents: number;
}

function shortMonth(key: string): string {
  const [year, month] = key.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleString("de-DE", { month: "short" });
}

function euro(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}

/** Monatsverlauf Einnahmen vs. Ausgaben (recharts, 2 Bars). */
export function JahresberichtChart({ monate }: { monate: Monat[] }) {
  const t = useTranslations("finanzen");
  const data = monate.map((m) => ({
    label: shortMonth(m.month),
    einnahmen: m.einnahmen_cents / 100,
    ausgaben: m.ausgaben_cents / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
        />
        <Tooltip
          formatter={(value, name) => [euro(Number(value ?? 0) * 100), name === "einnahmen" ? t("kpi.einnahmen") : t("kpi.ausgaben")]}
          contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
        />
        <Legend
          formatter={(v) => (v === "einnahmen" ? t("kpi.einnahmen") : t("kpi.ausgaben"))}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="einnahmen" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="ausgaben" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
