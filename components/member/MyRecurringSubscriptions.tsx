"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useMosque } from "@/lib/mosque-context";
import {
  getMySubscriptions,
  cancelRecurringSubscription,
  cancelRecurringSubscriptionImmediately,
} from "@/lib/actions/recurring-donations";
import type { RecurringSubscription } from "@/types";
import { formatCurrencyCents, formatDate } from "@/lib/utils";
import { Heart, RefreshCw, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { PaymentHealthBadge } from "@/components/shared/PaymentHealthBadge";

export function MyRecurringSubscriptions() {
  const t = useTranslations("donations");
  const { user } = useAuth();
  const { mosqueId } = useMosque();

  const [subs, setSubs] = useState<RecurringSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !mosqueId) return;
    setIsLoading(true);
    const res = await getMySubscriptions(user.id, mosqueId);
    setIsLoading(false);
    if (res.success && res.data) {
      setSubs(res.data);
    } else {
      setError(res.error || t("mySub.loadError"));
    }
  }, [user, mosqueId, t]);

  useEffect(() => { load(); }, [load]);

  async function handleCancel(sub: RecurringSubscription, immediate: boolean) {
    if (!user || !mosqueId) return;
    const msg = immediate ? t("mySub.cancelImmediateConfirm") : t("mySub.cancelConfirm");
    if (!confirm(msg)) return;
    setCancelingId(sub.id);
    const fn = immediate ? cancelRecurringSubscriptionImmediately : cancelRecurringSubscription;
    const res = await fn(sub.id, mosqueId, user.id, "member");
    setCancelingId(null);
    if (res.success) {
      load();
    } else {
      setError(res.error || t("mySub.cancelError"));
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (subs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center">
        <Heart className="mx-auto mb-2 h-8 w-8 text-gray-200" />
        <p className="text-sm text-gray-500">{t("mySub.empty")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}
      {subs.map((s) => (
        <div
          key={s.id}
          className="rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-purple-600" />
                <p className="font-semibold text-gray-900">
                  {formatCurrencyCents(s.amount_cents)} / {t("mySub.month")}
                </p>
              </div>
              {s.started_at && (
                <p className="mt-1 text-xs text-gray-500">
                  {t("mySub.startedAt")}: {formatDate(s.started_at)}
                </p>
              )}
              {s.current_period_end && s.status === "active" && (
                <p className="mt-0.5 text-xs text-gray-500">
                  {s.cancel_at_period_end
                    ? t("mySub.endsAt", { date: formatDate(s.current_period_end) })
                    : `${t("mySub.activeUntil")}: ${formatDate(s.current_period_end)}`}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                s.status === "active" ? "bg-emerald-100 text-emerald-700"
                : s.status === "cancelled" ? "bg-gray-100 text-gray-600"
                : "bg-amber-100 text-amber-700"
              }`}>
                {t(`sub.status.${s.status}` as Parameters<typeof t>[0]) || s.status}
              </span>
              {s.last_payment_status === "failed" && (
                <PaymentHealthBadge status="failed" />
              )}
            </div>
          </div>

          {s.last_payment_status === "failed" && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{t("mySub.failedHint")}</span>
            </div>
          )}

          {s.status === "active" && !s.cancel_at_period_end && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleCancel(s, false)}
                disabled={cancelingId === s.id}
                className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                {cancelingId === s.id ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  t("mySub.cancelPeriodEnd")
                )}
              </button>
              <button
                type="button"
                onClick={() => handleCancel(s, true)}
                disabled={cancelingId === s.id}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {t("mySub.cancelNow")}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
