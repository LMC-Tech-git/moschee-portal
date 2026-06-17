"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileText, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LegalDocView } from "@/components/legal/LegalDocView";
import { acceptUserLegal } from "@/lib/actions/legal";
import {
  getFrozenDoc,
  LEGAL_VERSIONS,
  LEGAL_BASIS,
  type LegalDocType,
  type LegalLocale,
} from "@/lib/legal";

/**
 * Nutzer-Gate für geänderte Bedingungen. Verhalten nach Rechtsgrundlage:
 * - Vertrag (contract) → blockierend, „akzeptieren".
 * - Information (notice) → nach Anzeige abweisbare Kenntnisnahme.
 */
export function UserLegalGate({
  outstanding,
  locale,
}: {
  outstanding: LegalDocType[];
  locale: LegalLocale;
}) {
  const t = useTranslations("legal.gate");
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [hidden, setHidden] = useState(false);

  if (!outstanding || outstanding.length === 0 || hidden) return null;

  const hasContract = outstanding.some((d) => LEGAL_BASIS[d] === "contract");
  const dismissible = !hasContract;

  async function handleConfirm() {
    setSubmitting(true);
    setError("");
    try {
      const res = await acceptUserLegal(locale);
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
      aria-labelledby="user-gate-title"
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center"
    >
      <div className="my-4 w-full max-w-2xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-gray-100 p-5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <FileText className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h2 id="user-gate-title" className="text-lg font-bold text-gray-900">
              {t("user_title")}
            </h2>
            <p className="text-sm text-gray-500">
              {hasContract ? t("user_subtitle_contract") : t("user_subtitle_notice")}
            </p>
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={() => setHidden(true)}
              aria-label={t("later")}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          )}
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
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button onClick={handleConfirm} disabled={submitting} className="w-full sm:w-auto" size="lg">
              {submitting
                ? t("submitting")
                : hasContract
                  ? t("user_accept")
                  : t("user_acknowledge")}
            </Button>
            {dismissible && (
              <Button
                variant="outline"
                onClick={() => setHidden(true)}
                disabled={submitting}
                className="w-full sm:w-auto"
                size="lg"
              >
                {t("later")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
