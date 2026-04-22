"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import {
  getRecurringSubscriptionsByMosque,
  cancelRecurringSubscription,
  type GetSubscriptionsOptions,
} from "@/lib/actions/recurring-donations";
import type { RecurringSubscription } from "@/types";
import { formatCurrencyCents, formatDateTime, formatDate } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Repeat,
  RefreshCw,
  User,
  Search,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { PaymentHealthBadge } from "@/components/shared/PaymentHealthBadge";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  cancelled: "bg-gray-100 text-gray-600",
  abandoned: "bg-slate-100 text-slate-500",
};

export default function DaueraufträgePage() {
  const t = useTranslations("donations");
  const tCommon = useTranslations("common");
  const { user } = useAuth();
  const { mosqueId } = useMosque();

  const [items, setItems] = useState<RecurringSubscription[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<GetSubscriptionsOptions["status"]>("all");
  const [search, setSearch] = useState("");
  const [orderBy, setOrderBy] = useState<GetSubscriptionsOptions["orderBy"]>("started_at");
  const [orderDirection, setOrderDirection] = useState<GetSubscriptionsOptions["orderDirection"]>("desc");

  const load = useCallback(async (p = 1) => {
    if (!mosqueId) return;
    setIsLoading(true);
    setError("");
    const result = await getRecurringSubscriptionsByMosque(mosqueId, {
      status: statusFilter,
      search: search || undefined,
      orderBy,
      orderDirection,
      page: p,
      limit: 25,
    });
    setIsLoading(false);
    if (result.success && result.data) {
      setItems(result.data.items);
      setTotalItems(result.data.totalItems);
      setTotalPages(result.data.totalPages);
      setPage(result.data.page);
    } else {
      setError(result.error || t("sub.loadError"));
    }
  }, [mosqueId, statusFilter, search, orderBy, orderDirection, t]);

  useEffect(() => { load(1); }, [load]);

  async function handleCancel(sub: RecurringSubscription) {
    if (!user || !mosqueId) return;
    if (!confirm(t("sub.cancelConfirm"))) return;
    setCancelingId(sub.id);
    const res = await cancelRecurringSubscription(sub.id, mosqueId, user.id, "admin");
    setCancelingId(null);
    if (res.success) {
      load(page);
    } else {
      setError(res.error || t("sub.cancelError"));
    }
  }

  function toggleSort(field: GetSubscriptionsOptions["orderBy"]) {
    if (orderBy === field) {
      setOrderDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setOrderBy(field);
      setOrderDirection("desc");
    }
  }

  function SortIcon({ field }: { field: GetSubscriptionsOptions["orderBy"] }) {
    if (orderBy !== field) return <ChevronDown className="ml-1 inline h-3 w-3 opacity-30" />;
    return orderDirection === "asc"
      ? <ChevronUp className="ml-1 inline h-3 w-3 text-emerald-600" />
      : <ChevronDown className="ml-1 inline h-3 w-3 text-emerald-600" />;
  }

  if (!user) return null;

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

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("sub.title")}</h1>
        <p className="text-sm text-gray-500">{t("sub.subtitle")}</p>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as GetSubscriptionsOptions["status"])}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="all">{t("filterAllStatus")}</option>
          <option value="active">{t("sub.status.active")}</option>
          <option value="pending">{t("sub.status.pending")}</option>
          <option value="cancelled">{t("sub.status.cancelled")}</option>
          <option value="abandoned">{t("sub.status.abandoned")}</option>
        </select>
        <button
          type="button"
          onClick={() => load(page)}
          className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
          title={tCommon("refresh")}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Tabelle */}
      <div className="rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <Repeat className="mx-auto mb-3 h-10 w-10 text-gray-200" />
            <p className="font-medium text-gray-500">{t("sub.empty")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort("donor_name")} className="flex items-center hover:text-gray-700">
                      {t("sub.col.donor")}<SortIcon field="donor_name" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button type="button" onClick={() => toggleSort("amount_cents")} className="flex items-center ml-auto hover:text-gray-700">
                      {t("sub.col.amount")}<SortIcon field="amount_cents" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort("started_at")} className="flex items-center hover:text-gray-700">
                      {t("sub.col.start")}<SortIcon field="started_at" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort("last_payment_at")} className="flex items-center hover:text-gray-700">
                      {t("sub.col.lastPayment")}<SortIcon field="last_payment_at" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort("current_period_end")} className="flex items-center hover:text-gray-700">
                      {t("sub.col.activeUntil")}<SortIcon field="current_period_end" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort("status")} className="flex items-center hover:text-gray-700">
                      {t("sub.col.status")}<SortIcon field="status" />
                    </button>
                  </th>
                  <th className="px-4 py-3">{t("sub.col.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                          <User className="h-3.5 w-3.5 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{s.donor_name || s.donor_email}</p>
                          {s.donor_name && (
                            <p className="text-xs text-gray-400">{s.donor_email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-900">
                      {formatCurrencyCents(s.amount_cents)}/Mo
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {s.started_at ? formatDate(s.started_at) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <PaymentHealthBadge status={s.last_payment_status} />
                        {s.last_payment_at && (
                          <span className="text-xs text-gray-400">{formatDateTime(s.last_payment_at)}</span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {s.current_period_end ? formatDate(s.current_period_end) : "—"}
                      {s.cancel_at_period_end && (
                        <div className="text-xs text-amber-600">{t("sub.willEnd")}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status] || "bg-gray-100 text-gray-600"}`}>
                        {t(`sub.status.${s.status}` as Parameters<typeof t>[0]) || s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {s.status === "active" && !s.cancel_at_period_end && (
                          <button
                            type="button"
                            onClick={() => handleCancel(s)}
                            disabled={cancelingId === s.id}
                            className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            {cancelingId === s.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              t("overview.cancel")
                            )}
                          </button>
                        )}
                        {s.donor_type === "member" && s.user_id && (
                          <Link
                            href={`/admin/mitglieder/${s.user_id}`}
                            className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          >
                            {t("sub.toMember")}
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              {tCommon("pageOf", { page, total: totalPages })} · {totalItems}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => load(page - 1)}
                disabled={page <= 1 || isLoading}
                className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => load(page + 1)}
                disabled={page >= totalPages || isLoading}
                className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
