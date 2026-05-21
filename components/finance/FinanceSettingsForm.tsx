"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { updateFinanceSettings } from "@/lib/actions/settings";
import type { FinanceSettingsInput } from "@/lib/validations";

/** Einstellungen-Tab: finance_enabled, Startjahr, Anfangsbestände (€→cents), Hard-Lock. */
export function FinanceSettingsForm({
  mosqueId,
  initial,
  onSaved,
}: {
  mosqueId: string;
  initial: FinanceSettingsInput;
  onSaved: (enabled: boolean) => void;
}) {
  const t = useTranslations("finanzen");

  const [enabled, setEnabled] = useState(initial.finance_enabled);
  const [startYear, setStartYear] = useState(String(initial.kassenbuch_start_year));
  const [barStart, setBarStart] = useState((initial.kassenbuch_bar_start_cents / 100).toFixed(2));
  const [bankStart, setBankStart] = useState((initial.kassenbuch_bank_start_cents / 100).toFixed(2));
  const [hardLock, setHardLock] = useState(initial.finance_hard_lock_until || "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  function euroToCents(s: string): number {
    const v = Number.parseFloat(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(v) ? Math.round(v * 100) : 0;
  }

  async function save() {
    setStatus(null);
    setSaving(true);
    try {
      const res = await updateFinanceSettings(mosqueId, {
        finance_enabled: enabled,
        kassenbuch_start_year: Number.parseInt(startYear, 10) || new Date().getFullYear(),
        kassenbuch_bar_start_cents: euroToCents(barStart),
        kassenbuch_bank_start_cents: euroToCents(bankStart),
        finance_hard_lock_until: hardLock || "",
      });
      if (res.success) {
        setStatus({ type: "success", msg: t("settings.saved") });
        onSaved(enabled);
      } else {
        setStatus({ type: "error", msg: res.error || t("error.generic") });
      }
    } catch {
      setStatus({ type: "error", msg: t("error.generic") });
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  return (
    <div className="max-w-xl space-y-4">
      <label className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div>
          <p className="font-medium text-gray-800">{t("settings.enabled")}</p>
          <p className="text-xs text-gray-500">{t("settings.enabledHint")}</p>
        </div>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-5 w-5 accent-emerald-600" />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">{t("settings.startYear")}</span>
          <input inputMode="numeric" value={startYear} onChange={(e) => setStartYear(e.target.value)} className={inputCls} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">{t("settings.barStart")}</span>
          <input inputMode="decimal" value={barStart} onChange={(e) => setBarStart(e.target.value)} className={inputCls} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">{t("settings.bankStart")}</span>
          <input inputMode="decimal" value={bankStart} onChange={(e) => setBankStart(e.target.value)} className={inputCls} />
        </label>
      </div>

      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">{t("settings.hardLock")}</span>
        <input type="date" value={hardLock ? hardLock.slice(0, 10) : ""} onChange={(e) => setHardLock(e.target.value)} className={inputCls} />
        <span className="mt-1 block text-xs text-gray-400">{t("settings.hardLockHint")}</span>
      </label>

      {status && (
        <p className={`rounded-lg px-3 py-2 text-sm ${status.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {status.msg}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {saving ? t("settings.saving") : t("settings.save")}
      </button>
    </div>
  );
}
