"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import {
  getDonorOverview,
  exportDonorOverviewCSV,
  cancelRecurringSubscription,
  type DonorOverview,
  type DonorOverviewRow,
} from "@/lib/actions/recurring-donations";
import { formatCurrencyCents, formatDateTime } from "@/lib/utils";
import {
  ChevronLeft,
  Users,
  Banknote,
  Heart,
  Repeat,
  Download,
  User,
  Mail,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { PaymentHealthBadge } from "@/components/shared/PaymentHealthBadge";

export default function SpenderOverviewPage() {
  const t = useTranslations("donations");
  const tCommon = useTranslations("common");
  const { user } = useAuth();
  const { mosqueId } = useMosque();

  const now = new Date();
  const [year, setYear] = useState<number | "all">(now.getFullYear());
  const [month, setMonth] = useState<number | "all">("all");

  const [data, setData] = useState<DonorOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!mosqueId) return;
    setIsLoading(true);
    setError("");
    const result = await getDonorOverview(mosqueId, { year, month });
    setIsLoading(false);
    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error || t("overview.loadError"));
    }
  }, [mosqueId, year, month, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleExport() {
    if (!mosqueId) return;
    setIsExporting(true);
    const result = await exportDonorOverviewCSV(mosqueId, { year, month });
    setIsExporting(false);
    if (result.success && result.data) {
      const blob = new Blob([result.data.content], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  async function handleCancel(row: DonorOverviewRow) {
    if (!row.active_subscription_id || !user || !mosqueId) return;
    if (!confirm(t("overview.cancelConfirm"))) return;
    setCancelingId(row.active_subscription_id);
    const res = await cancelRecurringSubscription(
      row.active_subscription_id,
      mosqueId,
      user.id,
      "admin"
    );
    setCancelingId(null);
    if (res.success) {
      load();
    } else {
      setError(res.error || t("overview.cancelError"));
    }
  }

  if (!user) return null;

  const years: number[] = [];
  for (let y = now.getFullYear(); y >= 2024; y--) years.push(y);
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const monthLabels = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/spenden"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("overview.backToDonations")}
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("overview.title")}</h1>
          <p className="text-sm text-gray-500">{t("overview.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(e.target.value === "all" ? "all" : parseInt(e.target.value, 10))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="all">{t("overview.allYears")}</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value === "all" ? "all" : parseInt(e.target.value, 10))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="all">{t("overview.allMonths")}</option>
            {months.map((m) => <option key={m} value={m}>{monthLabels[m - 1]}</option>)}
          </select>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || !data || data.rows.length === 0}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {t("export")}
          </button>
        </div>
      </div>

      {/* KPI-Kacheln */}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Users className="h-4 w-4 text-emerald-600" />
              {t("overview.kpi.donors")}
            </div>
            <p className="mt-1 text-xl font-bold text-gray-900">{data.kpis.totalDonors}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Banknote className="h-4 w-4 text-emerald-600" />
              {t("overview.kpi.total")}
            </div>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {formatCurrencyCents(data.kpis.totalCents)}
            </p>
          </div>
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
            <div className="flex items-center gap-2 text-xs text-purple-700">
              <Repeat className="h-4 w-4" />
              {t("overview.kpi.activeSubs")}
            </div>
            <p className="mt-1 text-xl font-bold text-purple-900">{data.kpis.activeSubscriptions}</p>
          </div>
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
            <div className="flex items-center gap-2 text-xs text-purple-700">
              <Heart className="h-4 w-4" />
              {t("overview.kpi.mrr")}
            </div>
            <p className="mt-1 text-xl font-bold text-purple-900">
              {formatCurrencyCents(data.kpis.mrrCents)}
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Tabelle */}
      <div className="rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-gray-200" />
            <p className="font-medium text-gray-500">{t("overview.empty")}</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">{t("overview.col.donor")}</th>
                    <th className="px-4 py-3">{t("overview.col.email")}</th>
                    <th className="px-4 py-3">{t("overview.col.type")}</th>
                    <th className="px-4 py-3 text-right" title={t("overview.col.totalHint")}>
                      {t("overview.col.total")}
                    </th>
                    <th className="px-4 py-3 text-right">{t("overview.col.count")}</th>
                    <th className="px-4 py-3">{t("overview.col.last")}</th>
                    <th className="px-4 py-3" title={t("overview.col.subHint")}>
                      {t("overview.col.sub")}
                    </th>
                    <th className="px-4 py-3">{t("overview.col.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.rows.map((row) => (
                    <tr key={row.key} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                            <User className="h-3.5 w-3.5 text-gray-400" />
                          </div>
                          <p className="font-medium text-gray-900">{row.donor_name || row.donor_email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{row.donor_email}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.donor_type === "member" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                          {row.donor_type === "member" ? t("overview.member") : t("overview.guest")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatCurrencyCents(row.total_cents)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{row.donation_count}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                        {row.last_paid_at ? formatDateTime(row.last_paid_at) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {row.active_subscription_id ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                              <Heart className="h-3 w-3" />
                              {formatCurrencyCents(row.active_subscription_amount_cents)}/Mo
                            </span>
                            {row.active_subscription_last_payment_status === "failed" && (
                              <PaymentHealthBadge status="failed" />
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {row.active_subscription_id && (
                            <button
                              type="button"
                              onClick={() => handleCancel(row)}
                              disabled={cancelingId === row.active_subscription_id}
                              className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              {cancelingId === row.active_subscription_id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                t("overview.cancel")
                              )}
                            </button>
                          )}
                          {row.donor_type === "member" && row.user_id && (
                            <Link
                              href={`/admin/mitglieder/${row.user_id}`}
                              className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                            >
                              →
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="divide-y divide-gray-100 sm:hidden">
              {data.rows.map((row) => (
                <div key={row.key} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">
                        {row.donor_name || row.donor_email}
                      </p>
                      <p className="truncate text-xs text-gray-500 flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {row.donor_email}
                      </p>
                    </div>
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${row.donor_type === "member" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                      {row.donor_type === "member" ? t("overview.member") : t("overview.guest")}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-gray-900">
                      {formatCurrencyCents(row.total_cents)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {row.donation_count} {t("overview.donations")}
                    </span>
                  </div>
                  {row.active_subscription_id && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                        <Heart className="h-3 w-3" />
                        {formatCurrencyCents(row.active_subscription_amount_cents)}/Mo
                      </span>
                      {row.active_subscription_last_payment_status === "failed" && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      <button
                        type="button"
                        onClick={() => handleCancel(row)}
                        disabled={cancelingId === row.active_subscription_id}
                        className="ml-auto rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50"
                      >
                        {t("overview.cancel")}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-gray-400">{tCommon("mosqueIdNote") || ""}</p>
    </div>
  );
}
