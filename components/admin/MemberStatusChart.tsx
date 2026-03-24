"use client";

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  byStatus: {
    active: number;
    pending: number;
    inactive: number;
    blocked: number;
  };
}

const COLORS: Record<string, string> = {
  Aktiv: "#10b981",
  Ausstehend: "#f59e0b",
  Inaktiv: "#9ca3af",
  Gesperrt: "#ef4444",
};

export function MemberStatusChart({ byStatus }: Props) {
  const data = [
    { name: "Aktiv", value: byStatus.active },
    { name: "Ausstehend", value: byStatus.pending },
    { name: "Inaktiv", value: byStatus.inactive },
    { name: "Gesperrt", value: byStatus.blocked },
  ].filter((d) => d.value > 0);

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
            <Cell key={entry.name} fill={COLORS[entry.name] ?? "#9ca3af"} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [Number(value ?? 0), String(name)]}
          contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
        />
        <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
