"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, CheckCircle, Mail } from "lucide-react";
import { requestEmailChange } from "@/lib/actions/members";

export default function EmailChangeSection({
  userId,
  currentEmail,
}: {
  userId: string;
  currentEmail: string;
}) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await requestEmailChange(userId, newEmail);

    if (result.success) {
      setSent(true);
      setNewEmail("");
    } else {
      setError(result.error || t("member.profile.emailChange.errorServer"));
    }

    setIsSubmitting(false);
  }

  function handleOpen() {
    setIsOpen(true);
    setSent(false);
    setError("");
    setNewEmail("");
  }

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">
            {t("member.profile.emailChange.title")}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-gray-500">
            <Mail className="h-3.5 w-3.5" />
            {currentEmail}
          </p>
        </div>
        {!isOpen && (
          <button
            type="button"
            onClick={handleOpen}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t("member.profile.emailChange.changeButton")}
          </button>
        )}
      </div>

      {isOpen && !sent && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="newEmail"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              {t("member.profile.emailChange.newEmailLabel")}
            </label>
            <input
              id="newEmail"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={t("member.profile.emailChange.newEmailPlaceholder")}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting || !newEmail}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? t("member.profile.emailChange.sending")
                : t("member.profile.emailChange.sendConfirmation")}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t("member.profile.emailChange.cancel")}
            </button>
          </div>
        </form>
      )}

      {sent && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{t("member.profile.emailChange.sentTitle")}</p>
            <p className="mt-0.5 text-emerald-600">{t("member.profile.emailChange.sentDesc")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
