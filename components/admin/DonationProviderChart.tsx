"use client";

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";

interface ProviderData {
  provider: string;
  amountCents: number;
  count: number;
}

interface Props {
  byProvider: ProviderData[];
}

const PROVIDER_LABELS: Record<string, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  manual: "Manuell",
  extern: "Extern",
};

const PROVIDER_COLORS: Record<string, string> = {
  stripe: "#8b5cf6",
  paypal: "#3b82f6",
  manual: "#10b981",
  extern: "#9ca3af",
};

function getLabel(provider: string): string {
  return PROVIDER_LABELS[provider.toLowerCase()] ?? provider;
}

function getColor(provider: string): string {
  return PROVIDER_COLORS[provider.toLowerCase()] ?? "#9ca3af";
}

export function DonationProviderChart({ byProvider }: Props) {
  const data = byProvider.map((d) => ({
    name: getLabel(d.provider),
    value: d.amountCents,
    provider: d.provider,
    count: d.count,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">
        Keine Daten
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          outerRadius={70}
          dataKey="value"
          labelLine={false}
        >
          {data.map((entry) => (
            <Cell key={entry.provider} fill={getColor(entry.provider)} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [
            (Number(value ?? 0) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €",
            String(name),
          ]}
          contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
        />
        <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
