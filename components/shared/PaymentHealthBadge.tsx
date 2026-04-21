import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

interface Props {
  status?: "paid" | "failed" | "pending" | string;
  label?: string;
}

export function PaymentHealthBadge({ status, label }: Props) {
  if (status === "failed") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
        title={label || "Letzte Zahlung fehlgeschlagen — Stripe versucht automatisch erneut"}
      >
        <AlertTriangle className="h-3 w-3" />
        {label || "Fehlgeschlagen"}
      </span>
    );
  }
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        {label || "Bezahlt"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
      <Clock className="h-3 w-3" />
      {label || "Ausstehend"}
    </span>
  );
}
