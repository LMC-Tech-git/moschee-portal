"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useMosque } from "@/lib/mosque-context";
import {
  getDonationsByMosque,
  getDonationKPIs,
  updateDonationStatus,
  createManualDonation,
  type DonationWithMeta,
  type DonationKPIs,
  type GetDonationsOptions,
} from "@/lib/actions/donations";
import { getPublicCampaigns } from "@/lib/actions/campaigns";
import { formatCurrencyCents, formatDateTime } from "@/lib/utils";
import type { CampaignWithProgress } from "@/types";
import {
  Banknote,
  Search,
  Filter,
  Plus,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  User,
  CreditCard,
} from "lucide-react";
import { useTranslations } from "next-intl";

// ── Status-Hilfsfunktionen ─────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  created: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-purple-100 text-purple-700",
  cancelled: "bg-gray-100 text-gray-600",
};

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("donations");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] || "bg-gray-100 text-gray-600"}`}
    >
      {t(`status.${status}` as Parameters<typeof t>[0]) || status}
    </span>
  );
}

// ── Manuelle Spende Dialog ────────────────────────────────────────────────

function ManualDonationDialog({
  campaigns,
  onClose,
  onSave,
}: {
  campaigns: CampaignWithProgress[];
  onClose: () => void;
  onSave: () => void;
}) {
  const t = useTranslations("donations");
  const tCommon = useTranslations("common");
  const { user } = useAuth();
  const { mosqueId } = useMosque();
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [amountEur, setAmountEur] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [notes, setNotes] = useState("");
  const [paidAt, setPaidAt] = useState(
    new Date().toISOString().slice(0, 16) // "YYYY-MM-DDTHH:MM"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const amount = parseFloat(amountEur);
    if (isNaN(amount) || amount < 0.01) {
      setError(t("manual.amountError"));
      return;
    }
    if (!donorName.trim()) {
      setError(t("manual.nameRequired"));
      return;
    }
    setIsSubmitting(true);
    const result = await createManualDonation(mosqueId, user!.id, {
      donor_name: donorName.trim(),
      donor_email: donorEmail.trim() || undefined,
      amount_cents: Math.round(amount * 100),
      campaign_id: campaignId || undefined,
      notes: notes.trim() || undefined,
      paid_at: new Date(paidAt).toISOString(),
    });
    setIsSubmitting(false);
    if (result.success) {
      onSave();
    } else {
      setError(result.error || t("manual.saveError"));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="font-bold text-gray-900">{t("manual.title")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("manual.donorName")}
              </label>
              <input
                type="text"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                placeholder={t("manual.donorNamePlaceholder")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("manual.donorEmail")}
              </label>
              <input
                type="email"
                value={donorEmail}
                onChange={(e) => setDonorEmail(e.target.value)}
                placeholder="spender@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("manual.amount")}
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amountEur}
                onChange={(e) => setAmountEur(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("manual.dateTime")}
              </label>
              <input
                type="datetime-local"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("manual.campaign")}
              </label>
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">{t("manual.generalDonation")}</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("manual.notes")}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("manual.notesPlaceholder")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSubmitting ? t("manual.submitting") : t("manual.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Hauptseite ────────────────────────────────────────────────────────────

export default function AdminSpendenPage() {
  const t = useTranslations("donations");
  const tCommon = useTranslations("common");
  const { user } = useAuth();
  const { mosqueId } = useMosque();

  const [kpis, setKpis] = useState<DonationKPIs | null>(null);
  const [donations, setDonations] = useState<DonationWithMeta[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPaidCents, setTotalPaidCents] = useState(0);
  const [campaigns, setCampaigns] = useState<CampaignWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter
  const [statusFilter, setStatusFilter] = useState<GetDonationsOptions["status"]>("all");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState<GetDonationsOptions["provider"]>("all");
  const [search, setSearch] = useState("");

  // UI
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const loadData = useCallback(async (page = 1) => {
    if (!mosqueId) return;
    setIsLoading(true);
    setActionError("");

    const [donResult, kpiResult] = await Promise.all([
      getDonationsByMosque(mosqueId, {
        status: statusFilter,
        campaign_id: campaignFilter || undefined,
        provider: providerFilter,
        search: search || undefined,
        page,
        limit: 25,
      }),
      getDonationKPIs(mosqueId),
    ]);

    if (donResult.success && donResult.data) {
      setDonations(donResult.data.items);
      setTotalItems(donResult.data.totalItems);
      setTotalPages(donResult.data.totalPages);
      setCurrentPage(donResult.data.page);
      setTotalPaidCents(donResult.data.totalPaidCents);
    }
    if (kpiResult.success && kpiResult.data) {
      setKpis(kpiResult.data);
    }
    setIsLoading(false);
  }, [mosqueId, statusFilter, campaignFilter, providerFilter, search]);

  // Kampagnen einmalig laden
  useEffect(() => {
    if (!mosqueId) return;
    getPublicCampaigns(mosqueId, 50).then((r) => {
      if (r.success && r.data) setCampaigns(r.data);
    });
  }, [mosqueId]);

  useEffect(() => {
    loadData(1);
  }, [loadData]);

  async function handleStatusChange(donationId: string, newStatus: "paid" | "failed" | "refunded" | "cancelled") {
    if (!user || !mosqueId) return;
    setUpdatingId(donationId);
    setActionError("");
    const result = await updateDonationStatus(donationId, mosqueId, user.id, newStatus);
    setUpdatingId(null);
    if (result.success) {
      loadData(currentPage);
    } else {
      setActionError(result.error || t("updateError"));
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">
            {t("subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowManualDialog(true)}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          {t("addManual")}
        </button>
      </div>

      {/* KPI-Kacheln */}
      {kpis && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Banknote className="h-4 w-4 text-emerald-600" />
              {t("kpi.total")}
            </div>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {formatCurrencyCents(kpis.totalPaidCents)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <RefreshCw className="h-4 w-4 text-blue-500" />
              {t("kpi.thisMonth")}
            </div>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {formatCurrencyCents(kpis.thisMonthCents)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <User className="h-4 w-4 text-purple-500" />
              {t("kpi.donors")}
            </div>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {kpis.donorCount}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock className="h-4 w-4 text-amber-500" />
              {t("kpi.open")}
            </div>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {kpis.pendingCount > 0
                ? `${kpis.pendingCount} (${formatCurrencyCents(kpis.pendingCents)})`
                : "—"}
            </p>
          </div>
        </div>
      )}

      {/* Filter-Leiste */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        {/* Suche */}
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

        {/* Status-Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as GetDonationsOptions["status"])}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        >
          <option value="all">{t("filterAllStatus")}</option>
          <option value="paid">{t("status.paid")}</option>
          <option value="pending">{t("status.pending")}</option>
          <option value="created">{t("status.created")}</option>
          <option value="failed">{t("status.failed")}</option>
          <option value="refunded">{t("status.refunded")}</option>
          <option value="cancelled">{t("status.cancelled")}</option>
        </select>

        {/* Kampagnen-Filter */}
        {campaigns.length > 0 && (
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="">{t("filterAllCampaigns")}</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        )}

        {/* Provider-Filter */}
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value as GetDonationsOptions["provider"])}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        >
          <option value="all">{t("filterAllSources" as Parameters<typeof t>[0])}</option>
          <option value="stripe">Stripe</option>
          <option value="manual">{t("source.manual" as Parameters<typeof t>[0])}</option>
          <option value="paypal_link">PayPal</option>
        </select>

        {/* Refresh */}
        <button
          type="button"
          onClick={() => loadData(currentPage)}
          className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
          title="Aktualisieren"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {actionError && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {/* Tabelle */}
      <div className="rounded-xl border border-gray-200 bg-white">
        {/* Tabellenheader + Summe */}
        {!isLoading && donations.length > 0 && (
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="text-sm text-gray-500">
              {t("entries" as Parameters<typeof t>[0], { count: totalItems })}
              {statusFilter === "all" || statusFilter === "paid"
                ? ` · ${t("paid" as Parameters<typeof t>[0])}: ${formatCurrencyCents(totalPaidCents)}`
                : ""}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          </div>
        ) : donations.length === 0 ? (
          <div className="py-16 text-center">
            <Banknote className="mx-auto mb-3 h-10 w-10 text-gray-200" />
            <p className="font-medium text-gray-500">{t("noData" as Parameters<typeof t>[0])}</p>
            <p className="mt-1 text-sm text-gray-400">
              {t("noDataHint" as Parameters<typeof t>[0])}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">{t("colDate" as Parameters<typeof t>[0])}</th>
                  <th className="px-4 py-3">{t("colDonor" as Parameters<typeof t>[0])}</th>
                  <th className="px-4 py-3">{t("colCampaign" as Parameters<typeof t>[0])}</th>
                  <th className="px-4 py-3 text-right">{t("colAmount" as Parameters<typeof t>[0])}</th>
                  <th className="px-4 py-3">{t("colSource" as Parameters<typeof t>[0])}</th>
                  <th className="px-4 py-3">{t("colStatus" as Parameters<typeof t>[0])}</th>
                  <th className="px-4 py-3">{t("colAction" as Parameters<typeof t>[0])}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {donations.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {d.paid_at
                        ? formatDateTime(d.paid_at)
                        : formatDateTime(d.created)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                          <User className="h-3.5 w-3.5 text-gray-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">
                            {d.donor_display}
                          </p>
                          {d.donor_email && d.donor_name && (
                            <p className="truncate text-xs text-gray-400">
                              {d.donor_email}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {d.campaign_title ? (
                        <span className="truncate text-xs text-gray-600">
                          {d.campaign_title}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">{t("general" as Parameters<typeof t>[0])}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-900">
                      {formatCurrencyCents(d.amount_cents)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <CreditCard className="h-3 w-3" />
                        {t(`source.${d.provider}` as Parameters<typeof t>[0]) || d.provider}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-4 py-3">
                      {(d.status === "pending" || d.status === "created") && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(d.id, "paid")}
                          disabled={updatingId === d.id}
                          className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          title={t("markAsPaid" as Parameters<typeof t>[0])}
                        >
                          {updatingId === d.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle className="h-3 w-3" />
                          )}
                          {t("paid")}
                        </button>
                      )}
                      {d.status === "paid" && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(d.id, "refunded")}
                          disabled={updatingId === d.id}
                          className="flex items-center gap-1 rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                          title={t("markAsRefunded" as Parameters<typeof t>[0])}
                        >
                          <RefreshCw className="h-3 w-3" />
                          {t("refund")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              {tCommon("pageOf", { page: currentPage, total: totalPages })}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => loadData(currentPage - 1)}
                disabled={currentPage <= 1 || isLoading}
                className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => loadData(currentPage + 1)}
                disabled={currentPage >= totalPages || isLoading}
                className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manuelle Spende Dialog */}
      {showManualDialog && (
        <ManualDonationDialog
          campaigns={campaigns}
          onClose={() => setShowManualDialog(false)}
          onSave={() => {
            setShowManualDialog(false);
            loadData(1);
          }}
        />
      )}
    </div>
  );
}
