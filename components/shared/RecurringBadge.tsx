import { Heart } from "lucide-react";

export function RecurringBadge({ label }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700"
      title={label || "Wiederkehrend"}
    >
      <Heart className="h-3 w-3" />
      {label || "Wiederkehrend"}
    </span>
  );
}
