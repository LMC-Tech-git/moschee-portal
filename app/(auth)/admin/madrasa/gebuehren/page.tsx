"use client";

import { useEffect, useState } from "react";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import {
  getMonthlyFeeOverview,
  createMonthlyFees,
  markFeePaid,
  markFeeWaived,
  type FeeOverviewRow,
} from "@/lib/actions/student-fees";
import { getMadrasaFeeSettings } from "@/lib/actions/settings";
import { sendFeeReminderEmail, sendBulkFeeReminders } from "@/lib/actions/email";
import { getCoursesByMosque } from "@/lib/actions/courses";
import { getEnrolledStudentIds } from "@/lib/actions/enrollments";
import { formatCurrencyCents } from "@/lib/utils";
import { Banknote, CheckCircle, X, ChevronLeft, ChevronRight, Plus, AlertCircle, Bell, Download } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { CourseWithStats } from "@/types";

function getCurrentMonthKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

function prevMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type ActionState = {
  feeId: string;
  type: "pay_cash" | "pay_transfer" | "waive";
} | null;

export default function AdminMadrasaGebuehrenPage() {
  const { mosqueId } = useMosque();
  const { user } = useAuth();
  const t = useTranslations("madrasa.gebuehren");
  const tCommon = useTranslations("common");

  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [rows, setRows] = useState<FeeOverviewRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [defaultFeeCents, setDefaultFeeCents] = useState(1000);
  const [customAmountCents, setCustomAmountCents] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ created: number; skipped: number } | null>(null);
  const [actionState, setActionState] = useState<ActionState>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [isActing, setIsActing] = useState(false);
  const [reminderFeeId, setReminderFeeId] = useState<string | null>(null);
  const [reminderResult, setReminderResult] = useState<{ feeId: string; success: boolean; msg: string } | null>(null);
  const [isBulkReminding, setIsBulkReminding] = useState(false);
  const [bulkReminderResult, setBulkReminderResult] = useState<{ sent: number; skippedNoContact: number; skippedAlreadyReminded: number; failed: number } | null>(null);
  const [error, setError] = useState("");

  // Kurs-Filter
  const [courses, setCourses] = useState<CourseWithStats[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");
  const [courseStudentIds, setCourseStudentIds] = useState<Set<string> | null>(null);
  const [isFilterLoading, setIsFilterLoading] = useState(false);

  useEffect(() => {
    if (!mosqueId) return;
    async function loadSettings() {
      const [settingsResult, coursesResult] = await Promise.all([
        getMadrasaFeeSettings(mosqueId),
        getCoursesByMosque(mosqueId, { status: "active" }),
      ]);
      if (settingsResult.success && settingsResult.data) {
        setDefaultFeeCents(settingsResult.data.madrasa_default_fee_cents);
        setCustomAmountCents(settingsResult.data.madrasa_default_fee_cents);
      }
      if (coursesResult.success && coursesResult.data) {
        setCourses(coursesResult.data);
      }
    }
    loadSettings();
  }, [mosqueId]);

  useEffect(() => {
    if (!mosqueId) return;
    if (selectedCourseId === "all") {
      setCourseStudentIds(null);
      return;
    }
    setIsFilterLoading(true);
    getEnrolledStudentIds(selectedCourseId, mosqueId).then((r) => {
      if (r.success && r.data) {
        setCourseStudentIds(new Set(r.data));
      } else {
        setCourseStudentIds(null);
      }
      setIsFilterLoading(false);
    });
  }, [selectedCourseId, mosqueId]);

  useEffect(() => {
    if (!mosqueId) return;
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mosqueId, monthKey]);

  async function loadData() {
    setIsLoading(true);
    setCreateResult(null);
    setBulkReminderResult(null);
    setError("");
    const result = await getMonthlyFeeOverview(mosqueId, monthKey);
    if (result.success && result.data) {
      setRows(result.data);
    } else {
      setError(result.error || "Fehler beim Laden");
    }
    setIsLoading(false);
  }

  async function handleCreateFees() {
    if (!user) return;
    const amount = customAmountCents ?? defaultFeeCents;
    setIsCreating(true);
    setError("");
    const result = await createMonthlyFees(mosqueId, user.id, monthKey, amount);
    setIsCreating(false);
    if (result.success && result.data) {
      await loadData();
      setCreateResult(result.data);
    } else {
      setError(result.error || "Fehler beim Erstellen");
    }
  }

  async function handleAction() {
    if (!actionState || !user) return;
    setIsActing(true);
    setError("");

    let result;
    if (actionState.type === "waive") {
      result = await markFeeWaived(mosqueId, user.id, actionState.feeId, actionNotes);
    } else {
      const method = actionState.type === "pay_cash" ? "cash" : "transfer";
      result = await markFeePaid(mosqueId, user.id, actionState.feeId, method, actionNotes);
    }

    setIsActing(false);
    if (result.success) {
      setActionState(null);
      setActionNotes("");
      await loadData();
    } else {
      setError(result.error || "Fehler beim Speichern");
    }
  }

  async function handleSendReminder(feeId: string) {
    if (!user) return;
    if (!confirm(t("reminderConfirm"))) return;
    setReminderFeeId(feeId);
    setReminderResult(null);
    const result = await sendFeeReminderEmail(mosqueId, user.id, feeId);
    setReminderFeeId(null);
    if (result.success) {
      await loadData(); // Zeile mit reminder_sent_at aktualisieren
    }
    setReminderResult({
      feeId,
      success: result.success,
      msg: result.success ? t("reminderSent") : (result.error || tCommon("error")),
    });
  }

  async function handleBulkReminder() {
    if (!user) return;
    if (!confirm(t("bulkReminderConfirm"))) return;
    setIsBulkReminding(true);
    setBulkReminderResult(null);
    const result = await sendBulkFeeReminders(mosqueId, user.id, monthKey);
    setIsBulkReminding(false);
    if (result.success) {
      await loadData(); // Zeilen mit reminder_sent_at aktualisieren
      setBulkReminderResult({ sent: result.sent, skippedNoContact: result.skippedNoContact, skippedAlreadyReminded: result.skippedAlreadyReminded, failed: result.failed });
    } else {
      setError(result.error || tCommon("error"));
    }
  }

  // Gefilterte Zeilen (nach Kurs)
  const filteredRows = courseStudentIds
    ? rows.filter((r) => courseStudentIds.has(r.student.id))
    : rows;

  const openCount = filteredRows.filter((r) => r.fee?.status === "open").length;
  const paidCount = filteredRows.filter((r) => r.fee?.status === "paid").length;
  const waivedCount = filteredRows.filter((r) => r.fee?.status === "waived").length;
  const noFeeCount = filteredRows.filter((r) => !r.fee).length;
  const amountCentsForDisplay = customAmountCents ?? defaultFeeCents;

  const selectedCourseName = courses.find((c) => c.id === selectedCourseId)?.title ?? "";

  function handleExportCSV() {
    const BOM = "\uFEFF";
    const sep = ";";

    function statusLabel(fee: FeeOverviewRow["fee"]): string {
      if (!fee) return t("statusNoEntry");
      if (fee.status === "paid") return t("statusPaid");
      if (fee.status === "waived") return t("statusWaived");
      return t("statusOpen");
    }
    function methodLabel(fee: FeeOverviewRow["fee"]): string {
      if (!fee?.payment_method) return "";
      const map: Record<string, string> = {
        cash: t("methodCash"),
        transfer: t("methodTransfer"),
        stripe: t("methodOnline"),
        waived: t("methodWaived"),
      };
      return map[fee.payment_method] ?? fee.payment_method;
    }
    function formatDate(iso: string): string {
      if (!iso) return "";
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleDateString("de-DE");
    }

    const headers = [
      "Nachname", "Vorname",
      ...(selectedCourseId !== "all" ? ["Kurs"] : []),
      "Betrag (€)", "Status", "Zahlungsart", "Bezahlt am", "Mahnung gesendet am", "Notiz",
    ];

    const dataRows = filteredRows.map((r) => {
      const row = [
        r.student.last_name,
        r.student.first_name,
        ...(selectedCourseId !== "all" ? [selectedCourseName] : []),
        r.fee ? (r.fee.amount_cents / 100).toFixed(2).replace(".", ",") : "",
        statusLabel(r.fee),
        methodLabel(r.fee),
        formatDate(r.fee?.paid_at ?? ""),
        formatDate(r.fee?.reminder_sent_at ?? ""),
        r.fee?.notes ?? "",
      ];
      return row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(sep);
    });

    const csv = BOM + [headers.map((h) => `"${h}"`).join(sep), ...dataRows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const filename = `gebuehren_${monthKey}${selectedCourseId !== "all" ? `_${selectedCourseName.replace(/\s+/g, "_")}` : ""}.csv`;
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Kurs-Filter */}
          {courses.length > 0 && (
            <div className="relative">
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                disabled={isFilterLoading}
                className="rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              >
                <option value="all">{t("allCourses")}</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              {isFilterLoading && (
                <span className="absolute right-8 top-1/2 -translate-y-1/2">
                  <span className="h-3 w-3 block animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                </span>
              )}
            </div>
          )}

          {/* Bulk-Mahnung */}
          <button
            type="button"
            onClick={handleBulkReminder}
            disabled={openCount === 0 || isBulkReminding}
            className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50"
          >
            {isBulkReminding ? (
              <span className="h-4 w-4 inline-block animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            {isBulkReminding ? t("bulkReminderSending") : t("bulkReminder")}
          </button>

          {/* Export */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredRows.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            title={`${formatMonthKey(monthKey)}${selectedCourseId !== "all" ? ` · ${selectedCourseName}` : ""} exportieren`}
          >
            <Download className="h-4 w-4" />
            CSV
          </button>

          <Link
            href="/admin/madrasa"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("backLink")}
          </Link>
        </div>
      </div>

      {/* Monat-Picker */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <button
          type="button"
          onClick={() => setMonthKey(prevMonthKey(monthKey))}
          className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50"
          aria-label="Vorheriger Monat"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[180px] text-center text-lg font-semibold text-gray-900">
          {formatMonthKey(monthKey)}
        </span>
        <button
          type="button"
          onClick={() => setMonthKey(nextMonthKey(monthKey))}
          className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50"
          aria-label="Nächster Monat"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Fehler */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Bulk-Mahnung Ergebnis */}
      {bulkReminderResult && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">
          <div className="flex items-center gap-2 font-medium">
            <Bell className="h-4 w-4 shrink-0" />
            {bulkReminderResult.sent === 0 && bulkReminderResult.skippedAlreadyReminded > 0
              ? "Alle offenen Gebühren wurden für diesen Monat bereits gemahnt."
              : `${bulkReminderResult.sent} Mahnung${bulkReminderResult.sent !== 1 ? "en" : ""} gesendet.`}
          </div>
          <ul className="mt-1.5 ml-6 space-y-0.5 text-xs text-orange-600 list-disc">
            {bulkReminderResult.skippedAlreadyReminded > 0 && (
              <li>{bulkReminderResult.skippedAlreadyReminded} bereits gemahnt (übersprungen)</li>
            )}
            {bulkReminderResult.skippedNoContact > 0 && (
              <li>{bulkReminderResult.skippedNoContact} ohne Elternkonto oder E-Mail (übersprungen)</li>
            )}
            {bulkReminderResult.failed > 0 && (
              <li>{bulkReminderResult.failed} fehlgeschlagen</li>
            )}
          </ul>
        </div>
      )}

      {/* Gebühren erstellen */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-gray-900">{t("createSection", { month: formatMonthKey(monthKey) })}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">{t("amountLabel")}</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.50"
                value={((customAmountCents ?? defaultFeeCents) / 100).toFixed(2)}
                onChange={(e) => {
                  const eur = parseFloat(e.target.value) || 0;
                  setCustomAmountCents(Math.round(eur * 100));
                }}
                className="w-32 rounded-lg border border-gray-300 px-3 py-2 pr-6 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreateFees}
            disabled={isCreating}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {isCreating ? t("btnCreating") : t("btnCreate")}
          </button>
        </div>
        {createResult && createResult.created === 0 && createResult.skipped > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Für diesen Monat existieren bereits Gebühren. Bestehende Einträge werden nicht überschrieben.
            </span>
          </div>
        )}
        {createResult && createResult.created > 0 && createResult.skipped > 0 && (
          <p className="mt-3 text-sm text-emerald-700">
            {createResult.created} neu erstellt. {createResult.skipped} Schüler hatten bereits einen Eintrag und wurden übersprungen.
          </p>
        )}
        {createResult && createResult.created > 0 && createResult.skipped === 0 && (
          <p className="mt-3 text-sm text-emerald-700">
            {t("createResultMsg", { created: createResult.created, skipped: createResult.skipped })}
          </p>
        )}
        <p className="mt-2 text-xs text-gray-400">
          {t("createHint")}
        </p>
      </div>

      {/* KPIs */}
      {!isLoading && filteredRows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{openCount}</p>
            <p className="text-xs text-gray-500 mt-1">{t("kpiOpen")}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{paidCount}</p>
            <p className="text-xs text-gray-500 mt-1">{t("kpiPaid")}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-gray-400">{waivedCount}</p>
            <p className="text-xs text-gray-500 mt-1">{t("kpiWaived")}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-amber-500">{noFeeCount}</p>
            <p className="text-xs text-gray-500 mt-1">{t("kpiNoEntry")}</p>
          </div>
        </div>
      )}

      {/* Tabelle */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-12 text-center">
            <Banknote className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">
              {selectedCourseId !== "all" ? t("emptyByCourse") : t("emptyAll")}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {selectedCourseId !== "all" ? t("emptyByCourseHint") : t("emptyAllHint")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">{t("colStudent")}</th>
                  <th className="px-4 py-3">{t("colAmount")}</th>
                  <th className="px-4 py-3">{t("colStatus")}</th>
                  <th className="px-4 py-3 hidden sm:table-cell">{t("colPaymentMethod")}</th>
                  <th className="px-4 py-3 text-right">{t("colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRows.map((row) => {
                  const isConfirming = !!actionState && !!row.fee && actionState.feeId === row.fee.id;
                  return (
                    <tr key={row.student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {row.student.first_name} {row.student.last_name}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {row.fee ? (
                          <div className="flex flex-col gap-0.5">
                            <span>{formatCurrencyCents(row.fee.amount_cents)}</span>
                            {row.fee.discount_applied_cents > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                {t("siblingDiscount")} −{formatCurrencyCents(row.fee.discount_applied_cents)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!row.fee ? (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                            {t("statusNoEntry")}
                          </span>
                        ) : row.fee.status === "paid" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            <CheckCircle className="h-3 w-3" />
                            {t("statusPaid")}
                          </span>
                        ) : row.fee.status === "waived" ? (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                            {t("statusWaived")}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            {t("statusOpen")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs text-gray-500">
                        <span>
                          {row.fee?.payment_method === "cash"
                            ? t("methodCash")
                            : row.fee?.payment_method === "transfer"
                            ? t("methodTransfer")
                            : row.fee?.payment_method === "stripe"
                            ? t("methodOnline")
                            : row.fee?.payment_method === "waived"
                            ? t("methodWaived")
                            : "—"}
                        </span>
                        {row.fee?.notes && (
                          <p className="mt-0.5 text-gray-400 italic truncate max-w-[160px]" title={row.fee.notes}>
                            {row.fee.notes}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-end gap-1">
                          {/* Mahnung-Ergebnis (Session-State, verschwindet bei Reload) */}
                          {reminderResult?.feeId === row.fee?.id && (
                            <span className={`text-xs ${reminderResult?.success ? "text-emerald-600" : "text-red-600"}`}>
                              {reminderResult?.msg}
                            </span>
                          )}
                          {/* Persistenter Mahnung-Status (aus DB, bleibt nach Reload) */}
                          {row.fee?.reminder_sent_at && (
                            <span className="text-xs text-gray-400">
                              🔔 Mahnung: {new Date(row.fee.reminder_sent_at).toLocaleDateString("de-DE")}
                            </span>
                          )}
                          <div className="flex items-center justify-end gap-1">
                          {row.fee?.status === "open" && !isConfirming && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setActionState({ feeId: row.fee!.id, type: "pay_cash" });
                                  setActionNotes("");
                                }}
                                className="rounded px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                              >
                                {t("actionCash")}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActionState({ feeId: row.fee!.id, type: "pay_transfer" });
                                  setActionNotes("");
                                }}
                                className="rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                              >
                                {t("actionTransfer")}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActionState({ feeId: row.fee!.id, type: "waive" });
                                  setActionNotes("");
                                }}
                                className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                              >
                                {t("actionWaive")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSendReminder(row.fee!.id)}
                                disabled={reminderFeeId === row.fee!.id}
                                title={t("reminderConfirm")}
                                className="rounded px-2 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50 disabled:opacity-50"
                              >
                                {reminderFeeId === row.fee!.id ? (
                                  <span className="h-3 w-3 inline-block animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
                                ) : (
                                  <Bell className="h-3 w-3 inline" />
                                )}
                                {" "}{t("actionReminder")}
                              </button>
                            </>
                          )}
                          {isConfirming && (
                            <div className="flex flex-col gap-1.5 items-end">
                              <input
                                type="text"
                                value={actionNotes}
                                onChange={(e) => setActionNotes(e.target.value)}
                                placeholder={t("notePlaceholder")}
                                className="w-40 rounded border border-gray-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
                              />
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={handleAction}
                                  disabled={isActing}
                                  className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                                >
                                  <CheckCircle className="h-3 w-3" />
                                  {isActing ? "..." : actionState?.type === "waive" ? t("actionWaive") : t("btnConfirm")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setActionState(null); setActionNotes(""); }}
                                  className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                                >
                                  <X className="h-3 w-3" />
                                  {tCommon("cancel")}
                                </button>
                              </div>
                            </div>
                          )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
