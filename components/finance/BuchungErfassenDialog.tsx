"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  FINANCE_INCOME_CATEGORY_IDS,
  FINANCE_EXPENSE_CATEGORY_IDS,
} from "@/lib/constants";
import { createManualTransactionAction } from "@/lib/actions/finance";

const KONTO_TYPEN = ["cash", "bank", "other"] as const;
const ZAHLUNGSKANAELE = ["bar", "ueberweisung", "stripe", "paypal", "sonstige"] as const;
const KNOWN_ERRORS = new Set([
  "finance_period_locked",
  "transaction_immutable",
  "beleg_invalid_type",
  "beleg_too_large",
  "forbidden",
]);

/** Dialog zur Erfassung einer manuellen Buchung (ruft createManualTransactionAction). */
export function BuchungErfassenDialog({
  open,
  onOpenChange,
  mosqueId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mosqueId: string;
  onCreated: () => void;
}) {
  const t = useTranslations("finanzen");
  const today = new Date().toISOString().slice(0, 10);

  const [typ, setTyp] = useState<"einnahme" | "ausgabe">("einnahme");
  const [buchungsdatum, setBuchungsdatum] = useState(today);
  const [betrag, setBetrag] = useState("");
  const [kategorie, setKategorie] = useState<string>(FINANCE_INCOME_CATEGORY_IDS[0]);
  const [kontoTyp, setKontoTyp] = useState<(typeof KONTO_TYPEN)[number]>("cash");
  const [zahlungskanal, setZahlungskanal] = useState<(typeof ZAHLUNGSKANAELE)[number]>("bar");
  const [beschreibung, setBeschreibung] = useState("");
  const [belegFile, setBelegFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kategorien = typ === "einnahme" ? FINANCE_INCOME_CATEGORY_IDS : FINANCE_EXPENSE_CATEGORY_IDS;

  function changeTyp(next: "einnahme" | "ausgabe") {
    setTyp(next);
    // Kategorie auf erste passende zurücksetzen (Einnahme-/Ausgabe-IDs sind disjunkt)
    setKategorie(next === "einnahme" ? FINANCE_INCOME_CATEGORY_IDS[0] : FINANCE_EXPENSE_CATEGORY_IDS[0]);
  }

  function parseBetragCents(input: string): number {
    const normalized = input.replace(/\./g, "").replace(",", ".").trim();
    const val = Number.parseFloat(normalized);
    if (!Number.isFinite(val)) return 0;
    return Math.round(val * 100);
  }

  async function submit() {
    setError(null);
    const betragCents = parseBetragCents(betrag);
    if (betragCents < 1) {
      setError(t("error.betrag_invalid"));
      return;
    }
    if (beschreibung.trim().length < 3) {
      setError(t("error.beschreibung_short"));
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("mosqueId", mosqueId);
      formData.append("buchungsdatum", buchungsdatum);
      formData.append("betragCents", String(betragCents));
      formData.append("typ", typ);
      formData.append("kategorie", kategorie);
      formData.append("beschreibung", beschreibung.trim());
      formData.append("kontoTyp", kontoTyp);
      formData.append("zahlungskanal", zahlungskanal);
      if (belegFile) {
        formData.append("belegFile", belegFile);
      }
      await createManualTransactionAction(formData);
      // Reset
      setBetrag("");
      setBeschreibung("");
      setBelegFile(null);
      onOpenChange(false);
      onCreated();
    } catch (e) {
      const msg = (e as Error).message || "";
      const code = KNOWN_ERRORS.has(msg) ? msg : "generic";
      setError(t(`error.${code}`));
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("dialog.title")}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3">
          {/* Typ */}
          <div className="grid grid-cols-2 gap-2">
            {(["einnahme", "ausgabe"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => changeTyp(opt)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  typ === opt
                    ? opt === "einnahme"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-red-500 bg-red-50 text-red-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {t(`typ.${opt}`)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">{t("dialog.buchungsdatum")}</span>
              <input type="date" value={buchungsdatum} onChange={(e) => setBuchungsdatum(e.target.value)} className={inputCls} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">{t("dialog.betrag")}</span>
              <input
                inputMode="decimal"
                placeholder="0,00"
                value={betrag}
                onChange={(e) => setBetrag(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">{t("col.kategorie")}</span>
            <select value={kategorie} onChange={(e) => setKategorie(e.target.value)} className={inputCls}>
              {kategorien.map((k) => (
                <option key={k} value={k}>
                  {t(`kategorie.${k}`)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">{t("col.konto")}</span>
              <select value={kontoTyp} onChange={(e) => setKontoTyp(e.target.value as typeof kontoTyp)} className={inputCls}>
                {KONTO_TYPEN.map((k) => (
                  <option key={k} value={k}>
                    {t(`konto.${k}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">{t("dialog.zahlungskanal")}</span>
              <select value={zahlungskanal} onChange={(e) => setZahlungskanal(e.target.value as typeof zahlungskanal)} className={inputCls}>
                {ZAHLUNGSKANAELE.map((z) => (
                  <option key={z} value={z}>
                    {t(`kanal.${z}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">{t("dialog.beschreibung")}</span>
            <input value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} className={inputCls} maxLength={500} />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">{t("dialog.beleg")}</span>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => setBelegFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
            />
            <span className="mt-1 block text-xs text-gray-400">{t("dialog.belegHint")}</span>
          </label>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            {t("dialog.abbrechen")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? t("dialog.speichern") + "…" : t("dialog.speichern")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
