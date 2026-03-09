interface KPITileProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}

export function KPITile({ icon, label, value }: KPITileProps) {
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-xl border border-gray-100 bg-gray-50 p-4 text-center transition-colors hover:bg-gray-100"
      aria-label={`${label}: ${value}`}
    >
      <span aria-hidden="true">{icon}</span>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
