"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useMosque } from "@/lib/mosque-context";
import { getClientPB } from "@/lib/pocketbase";
import {
  getMyMembershipFee,
  type MyMembershipFeeData,
} from "@/lib/actions/membership-fees";
import { cancelRecurringSubscription } from "@/lib/actions/recurring-donations";
import { formatCurrencyCents, formatDate } from "@/lib/utils";
import { Banknote, AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

export function MyMembershipFee() {
  const t = useTranslations("mitgliedsbeitraege");
  const tCommon = useTranslations("common");
  const { user } = useAuth();
  const { mosqueId, mosque } = useMosque();

  const [data, setData] = useState<MyMembershipFeeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [method, setMethod] = useState<"card" | "sepa_debit">("card");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user || !mosqueId) return;
    setIsLoading(true);
    const res = await getMyMembershipFee(mosqueId, user.id);
    setIsLoading(false);
    if (res.success && res.data) setData(res.data);
    else setError(res.error || "");
  }, [user, mosqueId]);

  useEffect(() => {
    load();
  }, [load]);

  async function activate() {
    if (!mosque?.slug) return;
    setBusy(true);
    setError("");
    try {
      const pb = getClientPB();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (pb.authStore.isValid && pb.authStore.token) {
        headers["Authorization"] = `Bearer ${pb.authStore.token}`;
      }
      const res = await fetch(
        `/api/${mosque.slug}/donations/stripe/create-subscription`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            purpose: "membership_fee",
            payment_method_type: method,
          }),
        }
      );
      const json = await res.json();
      if (json.success && json.checkout_url) {
        window.location.href = json.checkout_url;
        return;
      }
      setError(json.error || t("activateError"));
    } catch {
      setError(t("activateError"));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!user || !mosqueId || !data?.activeSubId) return;
    if (!confirm(t("cancelConfirm"))) return;
    setBusy(true);
    const res = await cancelRecurringSubscription(
      data.activeSubId,
      mosqueId,
      user.id,
      "member"
    );
    setBusy(false);
    if (res.success) load();
    else setError(res.error || "");
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (!data?.config) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center">
        <Banknote className="mx-auto mb-2 h-8 w-8 text-gray-200" />
        <p className="text-sm text-gray-500">{t("memberNoConfig")}</p>
      </div>
    );
  }

  const cfg = data.config;
  const intervalLabel = t(
    `interval${cfg.interval.charAt(0).toUpperCase()}${cfg.interval.slice(1)}` as never
  );

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-emerald-600" />
          <p className="font-semibold">
            {formatCurrencyCents(cfg.amount_cents)} / {intervalLabel}
          </p>
        </div>
        {cfg.exempt && (
          <p className="mt-1 text-xs text-amber-600">{t("memberExempt")}</p>
        )}

        {data.hasActiveSub ? (
          <div className="mt-3">
            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              {t("autoActive")}
            </span>
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="ml-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {busy ? <RefreshCw className="h-3 w-3 animate-spin" /> : t("cancelAuto")}
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "card" | "sepa_debit")}
              className="rounded border px-2 py-2 text-sm"
            >
              <option value="card">{t("payCard")}</option>
              <option value="sepa_debit">{t("paySepa")}</option>
            </select>
            <button
              type="button"
              onClick={activate}
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? tCommon("saving") : t("activateAuto")}
            </button>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">{t("memberPeriods")}</h3>
        {data.fees.length === 0 ? (
          <p className="text-sm text-gray-500">{t("empty")}</p>
        ) : (
          <div className="space-y-2">
            {data.fees.map((f) => (
              <div
                key={f.id}
                className={`flex items-center justify-between rounded-lg border p-3 text-sm ${
                  f.status === "open" || f.status === "failed"
                    ? "border-red-200 bg-red-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div>
                  <span className="font-medium">{f.period_key}</span>
                  <span className="ml-2 text-gray-500">
                    {formatCurrencyCents(f.amount_cents)}
                  </span>
                  {f.paid_at && (
                    <span className="ml-2 text-xs text-gray-400">
                      {formatDate(f.paid_at)}
                    </span>
                  )}
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                  {t(`status_${f.status}`)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {data.fees.some((f) => f.status === "failed") && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{t("memberFailedHint")}</span>
        </div>
      )}

      <p className="text-xs text-gray-400">{t("memberTransparency")}</p>
    </div>
  );
}
