"use client";

import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useTranslations } from "next-intl";

interface Props {
  status?: "paid" | "failed" | "pending" | string;
}

export function PaymentHealthBadge({ status }: Props) {
  const t = useTranslations("donations.sub.paymentHealth");

  if (status === "failed") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
        title={t("failedTitle")}
      >
        <AlertTriangle className="h-3 w-3" />
        {t("failed")}
      </span>
    );
  }
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        {t("paid")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
      <Clock className="h-3 w-3" />
      {t("pending")}
    </span>
  );
}
