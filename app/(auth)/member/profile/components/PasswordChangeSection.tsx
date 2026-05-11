"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle, CheckCircle, Eye, EyeOff, Lock } from "lucide-react";
import { changePassword } from "@/lib/actions/members";
import { useAuth } from "@/lib/auth-context";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/constants";

export default function PasswordChangeSection({ userId }: { userId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const { logout, user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const tooShort = newPw.length > 0 && newPw.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirmPw.length > 0 && newPw !== confirmPw;
  const sameAsCurrent =
    currentPw.length > 0 && newPw.length > 0 && currentPw === newPw;
  const canSubmit =
    !isSubmitting &&
    currentPw.length > 0 &&
    newPw.length >= MIN_PASSWORD_LENGTH &&
    confirmPw.length > 0 &&
    !mismatch &&
    !sameAsCurrent;

  function handleOpen() {
    setIsOpen(true);
    setError("");
    setSuccess(false);
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setShowNew(false);
  }

  function handleCancel() {
    setIsOpen(false);
    setError("");
    setSuccess(false);
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setIsSubmitting(true);

    const result = await changePassword(userId, currentPw, newPw);

    if (result.success) {
      setSuccess(true);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      // Kurze Anzeige des Success-Banners, dann ausloggen + Redirect.
      setTimeout(() => {
        logout();
        router.push("/login?reason=password_changed");
      }, 1500);
    } else {
      setError(result.error || t("member.profile.passwordChange.errorServer"));
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">
            {t("member.profile.passwordChange.title")}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-gray-500">
            <Lock className="h-3.5 w-3.5" />
            ••••••••
          </p>
        </div>
        {!isOpen && (
          <button
            type="button"
            onClick={handleOpen}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t("member.profile.passwordChange.changeButton")}
          </button>
        )}
      </div>

      {isOpen && !success && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3" autoComplete="on">
          {/* Hidden username für Password-Manager-Kontext */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={user?.email || ""}
            readOnly
            hidden
            tabIndex={-1}
          />

          <div>
            <label
              htmlFor="currentPw"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              {t("member.profile.passwordChange.currentLabel")}
            </label>
            <input
              id="currentPw"
              type="password"
              autoComplete="current-password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="newPw"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              {t("member.profile.passwordChange.newLabel")}
            </label>
            <div className="relative">
              <input
                id="newPw"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                minLength={MIN_PASSWORD_LENGTH}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                tabIndex={-1}
                aria-label={
                  showNew
                    ? t("member.profile.passwordChange.hidePassword")
                    : t("member.profile.passwordChange.showPassword")
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {tooShort && (
              <p className="mt-1 text-xs text-amber-600">
                {t("member.profile.passwordChange.errorTooShort", {
                  min: MIN_PASSWORD_LENGTH,
                })}
              </p>
            )}
            {sameAsCurrent && (
              <p className="mt-1 text-xs text-amber-600">
                {t("member.profile.passwordChange.errorSame")}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPw"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              {t("member.profile.passwordChange.confirmLabel")}
            </label>
            <input
              id="confirmPw"
              type="password"
              autoComplete="new-password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {mismatch && (
              <p className="mt-1 text-xs text-amber-600">
                {t("member.profile.passwordChange.errorMismatch")}
              </p>
            )}
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
              disabled={!canSubmit}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? t("member.profile.passwordChange.saving")
                : t("member.profile.passwordChange.submit")}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t("member.profile.passwordChange.cancel")}
            </button>
          </div>
        </form>
      )}

      {success && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t("member.profile.passwordChange.successMessage")}</p>
        </div>
      )}
    </div>
  );
}
