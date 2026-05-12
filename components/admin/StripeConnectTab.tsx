"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  ExternalLink,
  Loader2,
  RefreshCw,
  Wallet,
  FileText,
  ShieldCheck,
} from "lucide-react";
import {
  getStripeConnectStatus,
  type StripeConnectStatus,
} from "@/lib/actions/stripe-connect";
import { useAuth } from "@/lib/auth-context";

interface Props {
  mosqueId: string;
}

export default function StripeConnectTab({ mosqueId }: Props) {
  const t = useTranslations("settings.payouts");
  const { pb } = useAuth();
  const [status, setStatus] = useState<StripeConnectStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setIsLoading(true);
    const res = await getStripeConnectStatus(mosqueId);
    if (res.success && res.data) {
      setStatus(res.data);
      setError("");
    } else {
      setError(res.error || t("error.generic"));
    }
    setIsLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mosqueId]);

  const authHeader: Record<string, string> = pb.authStore.token
    ? { Authorization: `Bearer ${pb.authStore.token}` }
    : {};

  async function startOnboarding() {
    setIsBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/stripe/connect/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ mosque_id: mosqueId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("error.onboardingFailed"));
      window.location.href = data.url;
    } catch (err) {
      setError(String((err as Error).message));
      setIsBusy(false);
    }
  }

  async function openDashboard() {
    setIsBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/stripe/connect/dashboard/${mosqueId}`, {
        method: "POST",
        headers: authHeader,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("error.generic"));
      window.open(data.url, "_blank", "noopener");
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setIsBusy(false);
    }
  }

  async function syncStatus() {
    setIsBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/stripe/connect/sync/${mosqueId}`, {
        method: "POST",
        headers: authHeader,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("error.generic"));
      await load();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setIsBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || t("error.generic")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{t("title")}</h2>
        <p className="mt-1 text-sm text-gray-600">{t("desc")}</p>
      </div>

      {/* Mode Badge */}
      <div>
        <ModeBadge mode={status.mode} />
      </div>

      {/* Health Banner */}
      <HealthBanner status={status} />

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {(status.mode === "platform_legacy" || !status.accountId) && (
          <button
            type="button"
            onClick={startOnboarding}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            {t("action.startOnboarding")}
          </button>
        )}
        {status.accountId &&
          (!status.detailsSubmitted || status.currentlyDue.length > 0) && (
          <button
            type="button"
            onClick={startOnboarding}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            {t("action.continueOnboarding")}
          </button>
        )}
        {status.detailsSubmitted && status.accountId && (
          <button
            type="button"
            onClick={openDashboard}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <ExternalLink className="h-4 w-4" />
            {t("action.openDashboard")}
          </button>
        )}
        {status.accountId && (
          <button
            type="button"
            onClick={syncStatus}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {t("action.sync")}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Status-Cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <StatusCard
          icon={<ShieldCheck className="h-5 w-5" />}
          label={t("card.account")}
          ok={!!status.accountId}
          value={status.accountId ? status.accountId.slice(0, 12) + "…" : t("card.account_none")}
        />
        <StatusCard
          icon={<FileText className="h-5 w-5" />}
          label={t("card.details")}
          ok={status.detailsSubmitted}
        />
        <StatusCard
          icon={<CreditCard className="h-5 w-5" />}
          label={t("card.charges")}
          ok={status.chargesEnabled}
        />
        <StatusCard
          icon={<Wallet className="h-5 w-5" />}
          label={t("card.payouts")}
          ok={status.payoutsEnabled}
        />
      </div>

      {/* Requirements */}
      {status.currentlyDue.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertCircle className="h-4 w-4" />
            {t("requirements.title")}
          </p>
          <ul className="space-y-1 text-sm text-amber-800">
            {status.currentlyDue.map((r) => (
              <li key={r} className="font-mono">
                {t("requirements.itemPrefix")} {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Meta */}
      {status.lastSyncedAt && (
        <p className="text-xs text-gray-500">
          {t("lastSync")}: {new Date(status.lastSyncedAt).toLocaleString("de-DE")}
        </p>
      )}
    </div>
  );
}

function ModeBadge({ mode }: { mode: StripeConnectStatus["mode"] }) {
  const t = useTranslations("settings.payouts.mode");
  const styles = {
    disabled: "bg-red-100 text-red-700",
    platform_legacy: "bg-amber-100 text-amber-800",
    connect_test: "bg-blue-100 text-blue-700",
    connect_live: "bg-emerald-100 text-emerald-700",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${styles[mode]}`}>
      {t(mode)}
    </span>
  );
}

function HealthBanner({ status }: { status: StripeConnectStatus }) {
  const t = useTranslations("settings.payouts");
  if (status.mode === "platform_legacy") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">{t("banner.platformLegacy.title")}</p>
          <p className="mt-0.5 text-amber-800">{t("banner.platformLegacy.desc")}</p>
        </div>
      </div>
    );
  }
  if (status.health === "disabled") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">{t("banner.disabled.title")}</p>
          <p className="mt-0.5 text-red-800">{t("banner.disabled.desc")}</p>
        </div>
      </div>
    );
  }
  if (status.health === "restricted") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">{t("banner.restricted.title")}</p>
          <p className="mt-0.5 text-amber-800">{t("banner.restricted.desc")}</p>
        </div>
      </div>
    );
  }
  if (status.health === "pending") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">{t("banner.pending.title")}</p>
          <p className="mt-0.5 text-blue-800">{t("banner.pending.desc")}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">{t("banner.healthy.title")}</p>
        <p className="mt-0.5 text-emerald-800">{t("banner.healthy.desc")}</p>
      </div>
    </div>
  );
}

function StatusCard({
  icon,
  label,
  ok,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  ok: boolean;
  value?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${ok ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className={`mt-0.5 truncate text-xs ${ok ? "text-emerald-700" : "text-gray-500"}`}>
          {value || (ok ? "✓" : "—")}
        </p>
      </div>
    </div>
  );
}
