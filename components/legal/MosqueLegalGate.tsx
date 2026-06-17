"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LegalDocView } from "@/components/legal/LegalDocView";
import { recordMosqueAcceptance } from "@/lib/actions/legal";
import {
  getFrozenDoc,
  LEGAL_VERSIONS,
  type LegalDocType,
  type LegalLocale,
} from "@/lib/legal";

/**
 * Blockierendes Gate: Vorstand der Gemeinde muss Nutzungsvereinbarung + AVV
 * digital bestätigen, bevor das Admin-Panel nutzbar ist. Ersetzt den
 * Papiervertrag. Status kommt server-seitig (RSC-Layout) → kein Flash.
 */
export function MosqueLegalGate({
  outstanding,
  locale,
}: {
  outstanding: LegalDocType[];
  locale: LegalLocale;
}) {
  const t = useTranslations("legal.gate");
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!outstanding || outstanding.length === 0) return null;

  const canSubmit = name.trim().length >= 2 && role.trim().length >= 2 && confirmed;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await recordMosqueAcceptance({ name, role, locale });
      if (res.success) {
        router.refresh();
      } else {
        setError(t("error"));
        setSubmitting(false);
      }
    } catch {
      setError(t("error"));
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mosque-gate-title"
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center"
    >
      <div className="my-4 w-full max-w-2xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-gray-100 p-5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 id="mosque-gate-title" className="text-lg font-bold text-gray-900">
              {t("mosque_title")}
            </h2>
            <p className="text-sm text-gray-500">{t("mosque_subtitle")}</p>
          </div>
        </div>

        <div className="max-h-[45vh] overflow-y-auto border-b border-gray-100 p-5">
          {outstanding.map((docType) => {
            const doc = getFrozenDoc(docType, LEGAL_VERSIONS[docType], locale);
            if (!doc) return null;
            return (
              <div key={docType} className="mb-8 last:mb-0">
                <LegalDocView doc={doc} />
              </div>
            );
          })}
        </div>

        <div className="space-y-4 p-5">
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gate-name">{t("name_label")}</Label>
              <Input
                id="gate-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("name_placeholder")}
                disabled={submitting}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gate-role">{t("role_label")}</Label>
              <Input
                id="gate-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder={t("role_placeholder")}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="flex items-start gap-2">
            <input
              id="gate-confirm"
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={submitting}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="gate-confirm" className="text-sm text-gray-600">
              {t("mosque_confirm")}
            </label>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full"
            size="lg"
          >
            {submitting ? t("submitting") : t("mosque_accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}
