"use client";

import { useEffect, useState, useCallback } from "react";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import {
  getMembershipFeeOverview,
  getMembershipConfigs,
  createPeriodFees,
  markMembershipFeePaid,
  markMembershipFeeWaived,
  upsertMembershipConfig,
  type MembershipFeeOverviewRow,
  type MembershipConfigRow,
} from "@/lib/actions/membership-fees";
import { getMembershipFeeSettings } from "@/lib/actions/settings";
import { formatCurrencyCents } from "@/lib/utils";
import {
  Banknote,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertCircle,
  Settings2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { MembershipInterval } from "@/types";

type Interval = MembershipInterval;

function periodKeyFor(interval: Interval, d: Date): string {
  const y = d.getUTCFullYear();
  if (interval === "yearly") return String(y);
  if (interval === "quarterly")
    return `${y}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
  return `${y}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function shiftPeriod(interval: Interval, d: Date, dir: 1 | -1): Date {
  const n = new Date(d);
  if (interval === "yearly") n.setUTCFullYear(n.getUTCFullYear() + dir);
  else if (interval === "quarterly") n.setUTCMonth(n.getUTCMonth() + dir * 3);
  else n.setUTCMonth(n.getUTCMonth() + dir);
  return n;
}

function fmtPeriod(interval: Interval, d: Date, locale: string): string {
  if (interval === "yearly") return String(d.getUTCFullYear());
  if (interval === "quarterly")
    return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
  return d.toLocaleDateString(locale === "tr" ? "tr-TR" : "de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function AdminMembershipFeesPage() {
  const { mosqueId } = useMosque();
  const { user } = useAuth();
  const t = useTranslations("mitgliedsbeitraege");
  const tCommon = useTranslations("common");

  const [interval, setInterval] = useState<Interval>("monthly");
  const [refDate, setRefDate] = useState(() => new Date());
  const [rows, setRows] = useState<MembershipFeeOverviewRow[]>([]);
  const [configs, setConfigs] = useState<MembershipConfigRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "config">("overview");
  const [isCreating, setIsCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ created: number; skipped: number } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [defaultCents, setDefaultCents] = useState(1200);
  const [defaultInterval, setDefaultInterval] = useState<Interval>("monthly");

  const periodKey = periodKeyFor(interval, refDate);

  const loadOverview = useCallback(async () => {
    if (!mosqueId) return;
    setIsLoading(true);
    const res = await getMembershipFeeOverview(mosqueId, periodKey);
    if (res.success && res.data) setRows(res.data);
    else setError(res.error || "");
    setIsLoading(false);
  }, [mosqueId, periodKey]);

  const loadConfigs = useCallback(async () => {
    if (!mosqueId) return;
    const res = await getMembershipConfigs(mosqueId);
    if (res.success && res.data) setConfigs(res.data);
  }, [mosqueId]);

  useEffect(() => {
    if (!mosqueId) return;
    getMembershipFeeSettings(mosqueId).then((r) => {
      if (r.success && r.data) {
        setDefaultCents(r.data.membership_default_fee_cents);
        setDefaultInterval(r.data.membership_default_interval);
        setInterval(r.data.membership_default_interval);
      }
    });
  }, [mosqueId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  async function handleBulk() {
    if (!mosqueId || !user) return;
    setIsCreating(true);
    setCreateResult(null);
    const res = await createPeriodFees(mosqueId, user.id, periodKey);
    if (res.success && res.data) setCreateResult(res.data);
    else setError(res.error || "");
    setIsCreating(false);
    loadOverview();
  }

  async function handlePay(feeId: string, method: "cash" | "transfer") {
    if (!mosqueId || !user) return;
    setBusyId(feeId);
    const res = await markMembershipFeePaid(mosqueId, user.id, { feeId }, method);
    if (!res.success) setError(res.error || "");
    setBusyId(null);
    loadOverview();
  }

  async function handleWaive(feeId: string) {
    if (!mosqueId || !user) return;
    const reason = window.prompt(t("waiveReasonPrompt"));
    if (!reason || !reason.trim()) return;
    setBusyId(feeId);
    const res = await markMembershipFeeWaived(mosqueId, user.id, { feeId }, reason);
    if (!res.success) setError(res.error || "");
    setBusyId(null);
    loadOverview();
  }

  const kpi = {
    open: rows.filter((r) => r.fee?.status === "open").length,
    pending: rows.filter((r) => r.fee?.status === "pending").length,
    paid: rows.filter((r) => r.fee?.status === "paid").length,
    failed: rows.filter((r) => r.fee?.status === "failed").length,
    waived: rows.filter((r) => r.fee?.status === "waived").length,
    auto: rows.filter((r) => r.hasActiveSub).length,
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Banknote className="w-6 h-6 text-emerald-600" />
        <h1 className="text-xl md:text-2xl font-bold">{t("title")}</h1>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("overview")}
          className={`px-3 py-2 rounded text-sm ${tab === "overview" ? "bg-emerald-600 text-white" : "bg-gray-100"}`}
        >
          {t("tabOverview")}
        </button>
        <button
          onClick={() => setTab("config")}
          className={`px-3 py-2 rounded text-sm ${tab === "config" ? "bg-emerald-600 text-white" : "bg-gray-100"}`}
        >
          <Settings2 className="w-4 h-4 inline mr-1" />
          {t("tabConfig")}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {tab === "overview" && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value as Interval)}
              className="border rounded px-2 py-2 text-sm"
            >
              <option value="monthly">{t("intervalMonthly")}</option>
              <option value="quarterly">{t("intervalQuarterly")}</option>
              <option value="yearly">{t("intervalYearly")}</option>
            </select>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRefDate(shiftPeriod(interval, refDate, -1))}
                className="p-2 border rounded"
                aria-label={tCommon("back")}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-medium min-w-[10rem] text-center">
                {fmtPeriod(interval, refDate, "de")}
              </span>
              <button
                onClick={() => setRefDate(shiftPeriod(interval, refDate, 1))}
                className="p-2 border rounded"
                aria-label={tCommon("next")}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handleBulk}
              disabled={isCreating}
              className="ml-auto bg-emerald-600 text-white px-3 py-2 rounded text-sm flex items-center gap-1 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {isCreating ? tCommon("saving") : t("bulkCreate")}
            </button>
          </div>

          {createResult && (
            <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 rounded text-sm">
              {t("bulkResult", { created: createResult.created, skipped: createResult.skipped })}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
            {([
              ["open", kpi.open],
              ["pending", kpi.pending],
              ["paid", kpi.paid],
              ["failed", kpi.failed],
              ["waived", kpi.waived],
              ["auto", kpi.auto],
            ] as const).map(([k, v]) => (
              <div key={k} className="bg-white border rounded p-3 text-center">
                <div className="text-2xl font-bold">{v}</div>
                <div className="text-xs text-gray-500">{t(`kpi_${k}`)}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-2">{t("colMember")}</th>
                  <th className="p-2">{t("colAmount")}</th>
                  <th className="p-2">{t("colStatus")}</th>
                  <th className="p-2">{t("colMethod")}</th>
                  <th className="p-2">{t("colSource")}</th>
                  <th className="p-2">{t("colAuto")}</th>
                  <th className="p-2">{t("colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="p-4 text-center text-gray-400">{tCommon("loading")}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="p-4 text-center text-gray-400">{t("empty")}</td></tr>
                ) : (
                  rows.map((r) => {
                    const f = r.fee;
                    const overdue = f && (f.status === "open" || f.status === "failed");
                    return (
                      <tr key={r.user.id} className={`border-b ${overdue ? "bg-red-50" : ""}`}>
                        <td className="p-2">
                          {r.user.first_name} {r.user.last_name}
                        </td>
                        <td className="p-2">
                          {f ? formatCurrencyCents(f.amount_cents) : r.config ? formatCurrencyCents(r.config.amount_cents) : "—"}
                        </td>
                        <td className="p-2">
                          {f ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100">
                              {t(`status_${f.status}`)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">{t("status_none")}</span>
                          )}
                        </td>
                        <td className="p-2 text-xs">{f?.payment_method ? t(`method_${f.payment_method}`) : "—"}</td>
                        <td className="p-2 text-xs text-gray-500">{f?.source || "—"}</td>
                        <td className="p-2">
                          {r.hasActiveSub ? (
                            <span className="text-xs text-emerald-700">{t("autoYes")}</span>
                          ) : (
                            <span className="text-xs text-gray-400">{t("autoNo")}</span>
                          )}
                        </td>
                        <td className="p-2">
                          {f && (f.status === "open" || f.status === "failed" || f.status === "pending") ? (
                            <div className="flex gap-1 flex-wrap">
                              <button
                                disabled={busyId === f.id}
                                onClick={() => handlePay(f.id, "cash")}
                                className="text-xs px-2 py-1 bg-emerald-100 rounded disabled:opacity-50"
                              >
                                {t("actionCash")}
                              </button>
                              <button
                                disabled={busyId === f.id}
                                onClick={() => handlePay(f.id, "transfer")}
                                className="text-xs px-2 py-1 bg-blue-100 rounded disabled:opacity-50"
                              >
                                {t("actionTransfer")}
                              </button>
                              <button
                                disabled={busyId === f.id}
                                onClick={() => handleWaive(f.id)}
                                className="text-xs px-2 py-1 bg-gray-100 rounded disabled:opacity-50"
                              >
                                {t("actionWaive")}
                              </button>
                            </div>
                          ) : (
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "config" && (
        <ConfigSection
          configs={configs}
          defaultCents={defaultCents}
          defaultInterval={defaultInterval}
          onSaved={loadConfigs}
        />
      )}
    </div>
  );
}

function ConfigSection({
  configs,
  defaultCents,
  defaultInterval,
  onSaved,
}: {
  configs: MembershipConfigRow[];
  defaultCents: number;
  defaultInterval: Interval;
  onSaved: () => void;
}) {
  const { mosqueId } = useMosque();
  const { user } = useAuth();
  const t = useTranslations("mitgliedsbeitraege");
  const tCommon = useTranslations("common");
  const [editId, setEditId] = useState<string | null>(null);
  const [amountEur, setAmountEur] = useState("");
  const [intv, setIntv] = useState<Interval>(defaultInterval);
  const [active, setActive] = useState(true);
  const [exempt, setExempt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function startEdit(row: MembershipConfigRow) {
    setEditId(row.user.id);
    setErr("");
    setAmountEur(((row.config?.amount_cents ?? defaultCents) / 100).toFixed(2));
    setIntv(row.config?.interval ?? defaultInterval);
    setActive(row.config?.active ?? true);
    setExempt(row.config?.exempt ?? false);
  }

  async function save(userId: string) {
    if (!mosqueId || !user) return;
    setBusy(true);
    setErr("");
    const cents = Math.round(parseFloat(amountEur.replace(",", ".")) * 100);
    const res = await upsertMembershipConfig(mosqueId, user.id, userId, {
      amount_cents: cents,
      interval: intv,
      active,
      exempt,
    });
    setBusy(false);
    if (!res.success) {
      setErr(res.error || "");
      return;
    }
    setEditId(null);
    onSaved();
  }

  return (
    <div>
      {err && (
        <div className="mb-3 p-3 bg-red-50 text-red-700 rounded text-sm">{err}</div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">{t("colMember")}</th>
              <th className="p-2">{t("colAmount")}</th>
              <th className="p-2">{t("colInterval")}</th>
              <th className="p-2">{t("colActive")}</th>
              <th className="p-2">{t("colExempt")}</th>
              <th className="p-2">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((row) => {
              const editing = editId === row.user.id;
              return (
                <tr key={row.user.id} className="border-b align-top">
                  <td className="p-2">
                    {row.user.first_name} {row.user.last_name}
                    {row.hasActiveSub && row.config && !row.config.active && (
                      <span className="block text-xs text-amber-600">
                        {t("warnActiveSubInactiveCfg")}
                      </span>
                    )}
                  </td>
                  {editing ? (
                    <>
                      <td className="p-2">
                        <input
                          value={amountEur}
                          onChange={(e) => setAmountEur(e.target.value)}
                          className="border rounded px-2 py-1 w-20"
                          inputMode="decimal"
                          disabled={row.hasActiveSub}
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={intv}
                          onChange={(e) => setIntv(e.target.value as Interval)}
                          className="border rounded px-2 py-1"
                          disabled={row.hasActiveSub}
                        >
                          <option value="monthly">{t("intervalMonthly")}</option>
                          <option value="quarterly">{t("intervalQuarterly")}</option>
                          <option value="yearly">{t("intervalYearly")}</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                      </td>
                      <td className="p-2">
                        <input type="checkbox" checked={exempt} onChange={(e) => setExempt(e.target.checked)} />
                      </td>
                      <td className="p-2">
                        <button
                          onClick={() => save(row.user.id)}
                          disabled={busy}
                          className="text-xs px-2 py-1 bg-emerald-600 text-white rounded mr-1 disabled:opacity-50"
                        >
                          {busy ? tCommon("saving") : tCommon("save")}
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="text-xs px-2 py-1 bg-gray-100 rounded"
                        >
                          {tCommon("cancel")}
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-2">
                        {row.config ? formatCurrencyCents(row.config.amount_cents) : "—"}
                      </td>
                      <td className="p-2">
                        {row.config ? t(`interval${capitalize(row.config.interval)}`) : "—"}
                      </td>
                      <td className="p-2">{row.config?.active ? tCommon("yes") : tCommon("no")}</td>
                      <td className="p-2">{row.config?.exempt ? tCommon("yes") : tCommon("no")}</td>
                      <td className="p-2">
                        <button
                          onClick={() => startEdit(row)}
                          className={`text-xs px-2 py-1 rounded font-medium ${
                            row.config
                              ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                              : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          }`}
                        >
                          {row.config ? tCommon("edit") : t("configure")}
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
