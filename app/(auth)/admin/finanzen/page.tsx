"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet, BookOpen, PieChart, BarChart3, Settings as SettingsIcon, Plus, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMosque } from "@/lib/mosque-context";
import {
  getLedgerAtoms,
  getFinanceKPIs,
  getEUR,
  getJahresbericht,
  getKassenbericht,
  stornoTransactionAction,
} from "@/lib/actions/finance";
import { getFinanceSettings } from "@/lib/actions/settings";
import type {
  LedgerPage,
  FinanceKPIs,
  EURReport,
  JahresberichtReport,
  KassenberichtReport,
} from "@/types";
import type { FinanceSettingsInput } from "@/lib/validations";
import { KassenstandTiles } from "@/components/finance/KassenstandTiles";
import { LedgerTable } from "@/components/finance/LedgerTable";
import { LedgerCardList } from "@/components/finance/LedgerCardList";
import { BuchungErfassenDialog } from "@/components/finance/BuchungErfassenDialog";
import { EurTable } from "@/components/finance/EurTable";
import { JahresberichtChart } from "@/components/finance/JahresberichtChart";
import { KassenberichtTable } from "@/components/finance/KassenberichtTable";
import { FinanceSettingsForm } from "@/components/finance/FinanceSettingsForm";

type TabId = "kassenbuch" | "eur" | "berichte" | "kassenbericht" | "einstellungen";

const TABS: { id: TabId; icon: typeof Wallet }[] = [
  { id: "kassenbuch", icon: BookOpen },
  { id: "eur", icon: PieChart },
  { id: "berichte", icon: BarChart3 },
  { id: "kassenbericht", icon: Wallet },
  { id: "einstellungen", icon: SettingsIcon },
];

export default function FinanzenPage() {
  const t = useTranslations("finanzen");
  const { mosqueId } = useMosque();

  const currentYear = new Date().getFullYear();
  const [settings, setSettings] = useState<FinanceSettingsInput | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("kassenbuch");
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filter (Kassenbuch)
  const [konto, setKonto] = useState<"" | "bar" | "bank">("");
  const [typ, setTyp] = useState<"" | "einnahme" | "ausgabe">("");

  // Daten je Tab
  const [ledger, setLedger] = useState<LedgerPage | null>(null);
  const [kpis, setKpis] = useState<FinanceKPIs | null>(null);
  const [eur, setEur] = useState<EURReport | null>(null);
  const [jahr, setJahr] = useState<JahresberichtReport | null>(null);
  const [kasse, setKasse] = useState<KassenberichtReport | null>(null);

  // Settings laden (Gating)
  useEffect(() => {
    if (!mosqueId) return;
    getFinanceSettings(mosqueId).then((res) => {
      if (res.success && res.data) {
        setSettings(res.data);
        if (res.data.kassenbuch_start_year > currentYear) setYear(res.data.kassenbuch_start_year);
      }
    });
  }, [mosqueId, currentYear]);

  const enabled = settings?.finance_enabled ?? false;

  const years: number[] = [];
  if (settings) {
    const start = Math.min(settings.kassenbuch_start_year || currentYear, currentYear);
    for (let y = currentYear; y >= start; y--) years.push(y);
  }
  if (years.length === 0) years.push(currentYear);

  const loadTab = useCallback(async () => {
    if (!mosqueId || !enabled) return;
    setLoading(true);
    try {
      if (activeTab === "kassenbuch") {
        const [lp, k] = await Promise.all([
          getLedgerAtoms(mosqueId, { year, konto: konto || undefined, typ: typ || undefined, perPage: 200 }),
          getFinanceKPIs(mosqueId, year),
        ]);
        setLedger(lp);
        setKpis(k);
      } else if (activeTab === "eur") {
        setEur(await getEUR(mosqueId, year));
      } else if (activeTab === "berichte") {
        setJahr(await getJahresbericht(mosqueId, year));
      } else if (activeTab === "kassenbericht") {
        setKasse(await getKassenbericht(mosqueId, year));
      }
    } finally {
      setLoading(false);
    }
  }, [mosqueId, enabled, activeTab, year, konto, typ]);

  useEffect(() => {
    loadTab();
  }, [loadTab]);

  async function handleStorno(id: string) {
    if (!mosqueId) return;
    if (!window.confirm(t("action.stornoConfirm"))) return;
    try {
      await stornoTransactionAction(mosqueId, id);
      await loadTab();
    } catch (e) {
      const msg = (e as Error).message || "generic";
      window.alert(t(`error.${["finance_period_locked", "transaction_immutable", "forbidden", "already_storniert", "cannot_storno_a_storno"].includes(msg) ? msg : "generic"}`));
    }
  }

  if (!mosqueId) {
    return <div className="p-8 text-sm text-gray-500">{t("loading")}</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-6 w-6 text-emerald-600" />
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        </div>
        {enabled && activeTab === "kassenbuch" && (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            {t("action.erfassen")}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          // Wenn deaktiviert: nur Einstellungen erreichbar
          const disabledTab = !enabled && tab.id !== "einstellungen";
          return (
            <button
              key={tab.id}
              type="button"
              disabled={disabledTab}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-emerald-50 text-emerald-700"
                  : disabledTab
                    ? "cursor-not-allowed text-gray-300"
                    : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t(`tab.${tab.id}`)}
            </button>
          );
        })}
      </div>

      {/* Gating-Hinweis */}
      {!enabled && activeTab !== "einstellungen" && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          {t("disabledHint")}
        </div>
      )}

      {/* Jahr-Picker (außer Einstellungen) */}
      {enabled && activeTab !== "einstellungen" && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium text-gray-600">{t("jahr")}</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {activeTab === "kassenbuch" && (
            <>
              <select value={konto} onChange={(e) => setKonto(e.target.value as typeof konto)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm">
                <option value="">{t("filter.alleKonten")}</option>
                <option value="bar">{t("konto.cash")}</option>
                <option value="bank">{t("konto.bank")}</option>
              </select>
              <select value={typ} onChange={(e) => setTyp(e.target.value as typeof typ)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm">
                <option value="">{t("filter.alleTypen")}</option>
                <option value="einnahme">{t("typ.einnahme")}</option>
                <option value="ausgabe">{t("typ.ausgabe")}</option>
              </select>
            </>
          )}
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">{t("loading")}</p>}

      {/* Tab-Inhalte */}
      {enabled && activeTab === "kassenbuch" && !loading && (
        <div className="space-y-4">
          {kpis && <KassenstandTiles kpis={kpis} year={year} />}
          {ledger?.truncated && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              {t("ledger.truncated", { cap: 10000 })}
            </div>
          )}
          {ledger && (
            <>
              <LedgerTable atoms={ledger.atoms} onStorno={handleStorno} />
              <LedgerCardList atoms={ledger.atoms} onStorno={handleStorno} />
            </>
          )}
        </div>
      )}

      {enabled && activeTab === "eur" && !loading && eur && <EurTable eur={eur} />}

      {enabled && activeTab === "berichte" && !loading && jahr && (
        <div className="space-y-4">
          <KassenstandTiles kpis={jahr.kpis} year={year} />
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <JahresberichtChart monate={jahr.monate} />
          </div>
          <EurTable eur={jahr.eur} />
        </div>
      )}

      {enabled && activeTab === "kassenbericht" && !loading && kasse && <KassenberichtTable report={kasse} />}

      {activeTab === "einstellungen" && settings && (
        <FinanceSettingsForm
          mosqueId={mosqueId}
          initial={settings}
          onSaved={(en) => setSettings((s) => (s ? { ...s, finance_enabled: en } : s))}
        />
      )}

      <BuchungErfassenDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mosqueId={mosqueId}
        onCreated={loadTab}
      />
    </div>
  );
}
