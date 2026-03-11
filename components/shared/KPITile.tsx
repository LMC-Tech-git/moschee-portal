interface KPITileProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}

export function KPITile({ icon, label, value }: KPITileProps) {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
      aria-label={`${label}: ${value}`}
    >
      <span className="rounded-lg bg-gray-50 p-2" aria-hidden="true">{icon}</span>
      <p className="text-2xl font-bold tabular-nums text-gray-900 leading-none">{value}</p>
      <p className="text-xs font-medium text-gray-500">{label}</p>
    </div>
  );
}
