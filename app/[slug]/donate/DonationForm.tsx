"use client";

import { useState, useCallback, useEffect } from "react";
import { Heart, ExternalLink, UserCheck, ShieldCheck, CreditCard, Building2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { formatCurrencyCents } from "@/lib/utils";
import { TurnstileWidget } from "@/components/shared/TurnstileWidget";
import { DEMO_MOSQUE_ID } from "@/lib/demo";
import type { CampaignWithProgress } from "@/types";

const DEFAULT_PRESET_AMOUNTS = [500, 1000, 2000, 5000, 10000]; // in Cents

interface DonationFormProps {
  slug: string;
  mosqueId: string;
  campaigns: CampaignWithProgress[];
  preselectedCampaignId?: string;
  donationProvider: string;
  externalDonationUrl: string;
  externalDonationLabel: string;
  paypalDonateUrl: string;
  quickAmounts?: number[]; // in Cents, aus Settings
  recurringDonationsEnabled?: boolean;
  recurringMinCents?: number;
  recurringQuickAmounts?: number[];
}

export function DonationForm({
  slug,
  mosqueId,
  preselectedCampaignId,
  donationProvider,
  externalDonationUrl,
  externalDonationLabel,
  paypalDonateUrl,
  quickAmounts,
  recurringDonationsEnabled = false,
  recurringMinCents = 300,
  recurringQuickAmounts,
}: DonationFormProps) {
  const oneOffPresets = (quickAmounts && quickAmounts.length > 0) ? quickAmounts : DEFAULT_PRESET_AMOUNTS;
  const recurringPresets = (recurringQuickAmounts && recurringQuickAmounts.length > 0)
    ? recurringQuickAmounts
    : [500, 1000, 2000, 5000];
  const [mode, setMode] = useState<"one_off" | "monthly">("one_off");
  const presetAmounts = mode === "monthly" ? recurringPresets : oneOffPresets;
  const t = useTranslations("donationForm");
  const { user, pb } = useAuth();
  const [amountCents, setAmountCents] = useState(() => {
    const amounts = (quickAmounts && quickAmounts.length > 0) ? quickAmounts : DEFAULT_PRESET_AMOUNTS;
    return amounts[Math.floor(amounts.length / 2)] ?? 2000;
  });
  const [customAmount, setCustomAmount] = useState("");
  const [campaignId, setCampaignId] = useState(preselectedCampaignId || "");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [coverFees, setCoverFees] = useState(false);
  const [paymentMethodType, setPaymentMethodType] = useState<"card" | "sepa_debit">("card");
  const isDemo = DEMO_MOSQUE_ID !== "" && mosqueId === DEMO_MOSQUE_ID;
  const [turnstileToken, setTurnstileToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isMonthly = mode === "monthly";
  // Einheitliche Gebühren-Formel (Frontend = Backend)
  // Stripe EU-Schätzung: 1,5% + 0,25 €
  const adjustedCents = Math.ceil((amountCents + 25) / 0.985);
  const feeEstimateCents = adjustedCents - amountCents;
  const displayTotalCents = coverFees ? adjustedCents : amountCents;
  // Checkbox nur anzeigen wenn Betrag >= 200 ct (2€), sonst wäre Fixgebühr unverhältnismäßig
  const showFeeCheckbox = amountCents >= 200 && !isMonthly;

  // Vorausfüllen wenn eingeloggt
  useEffect(() => {
    if (user) {
      setDonorName(user.full_name || "");
      setDonorEmail(user.email || "");
    }
  }, [user]);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  // Externe Spende (PayPal Link oder externe URL)
  if (donationProvider === "external" && externalDonationUrl) {
    return (
      <div className="text-center">
        <Heart className="mx-auto mb-4 h-12 w-12 text-amber-500" />
        <p className="mb-6 text-gray-600">
          {t("externalMsg")}
        </p>
        <a
          href={externalDonationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-8 py-3 text-lg font-bold text-white shadow-lg transition-colors hover:bg-amber-600"
        >
          <ExternalLink className="h-5 w-5" />
          {externalDonationLabel || t("donateNow")}
        </a>
      </div>
    );
  }

  if (donationProvider === "paypal" && paypalDonateUrl) {
    return (
      <div className="text-center">
        <Heart className="mx-auto mb-4 h-12 w-12 text-amber-500" />
        <p className="mb-6 text-gray-600">
          {t("paypalMsg")}
        </p>
        <a
          href={paypalDonateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-3 text-lg font-bold text-white shadow-lg transition-colors hover:bg-blue-700"
        >
          <ExternalLink className="h-5 w-5" />
          {t("paypalBtn")}
        </a>
      </div>
    );
  }

  if (donationProvider === "none") {
    return (
      <div className="text-center">
        <Heart className="mx-auto mb-4 h-12 w-12 text-gray-300" />
        <p className="text-gray-500">
          {t("disabledMsg")}
        </p>
        <p className="mt-2 text-sm text-gray-400">
          {t("disabledHint")}
        </p>
      </div>
    );
  }

  // Stripe Checkout
  async function handleStripeCheckout() {
    setError("");
    setIsSubmitting(true);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      // Auth-Token mitsenden wenn eingeloggt
      if (pb.authStore.isValid && pb.authStore.token) {
        headers["Authorization"] = `Bearer ${pb.authStore.token}`;
      }

      if (isMonthly) {
        if (!donorEmail) {
          setError("Email ist für Daueraufträge erforderlich.");
          setIsSubmitting(false);
          return;
        }
        if (amountCents < recurringMinCents) {
          setError(`Mindestbetrag für Daueraufträge: ${formatCurrencyCents(recurringMinCents)}`);
          setIsSubmitting(false);
          return;
        }
        const subRes = await fetch(
          `/api/${slug}/donations/stripe/create-subscription`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              amount_cents: amountCents,
              campaign_id: campaignId || undefined,
              donor_name: donorName || undefined,
              donor_email: donorEmail,
              payment_method_type: isDemo ? paymentMethodType : "card",
              turnstile_token: turnstileToken,
            }),
          }
        );
        const subData = await subRes.json();
        if (!subRes.ok || !subData.success) {
          setError(subData.error || t("errorPayment"));
          return;
        }
        if (subData.checkout_url) window.location.href = subData.checkout_url;
        return;
      }

      const res = await fetch(
        `/api/${slug}/donations/stripe/create-checkout`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            amount_cents: amountCents,
            campaign_id: campaignId || undefined,
            donor_name: donorName || undefined,
            donor_email: donorEmail || undefined,
            turnstile_token: turnstileToken,
            cover_fees: coverFees,
            payment_method_type: isDemo ? paymentMethodType : undefined,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || t("errorPayment"));
        return;
      }

      // Weiterleitung zu Stripe Checkout
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch {
      setError(t("errorNetwork"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePresetClick(cents: number) {
    setAmountCents(cents);
    setCustomAmount("");
  }

  function handleCustomAmountChange(value: string) {
    setCustomAmount(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed > 0) {
      setAmountCents(Math.round(parsed * 100));
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Einmalig / Monatlich Toggle */}
      {recurringDonationsEnabled && (
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">Spendenart</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Spendenart wählen">
            <button
              type="button"
              onClick={() => {
                setMode("one_off");
                setAmountCents(oneOffPresets[Math.floor(oneOffPresets.length / 2)] ?? 2000);
                setCustomAmount("");
              }}
              className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                mode === "one_off"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Einmalig
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("monthly");
                setAmountCents(recurringPresets[Math.floor(recurringPresets.length / 2)] ?? 1000);
                setCustomAmount("");
                setCoverFees(false);
              }}
              className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                mode === "monthly"
                  ? "border-purple-500 bg-purple-50 text-purple-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Heart className="mr-1 inline h-4 w-4" /> Monatlich
            </button>
          </div>
          {isMonthly && (
            <p className="mt-2 text-xs text-gray-500">
              Monatlicher Dauerauftrag. Jederzeit im Profil kündbar. Mindestbetrag: {formatCurrencyCents(recurringMinCents)}.
            </p>
          )}
        </div>
      )}

      {/* Betrag wählen */}
      <div>
        <label htmlFor="custom_amount" className="mb-2 block text-sm font-medium text-gray-700">
          {t("amountLabel")}
        </label>
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label={t("suggestedAmounts")}>
          {presetAmounts.map((cents) => (
            <button
              key={cents}
              type="button"
              onClick={() => handlePresetClick(cents)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                amountCents === cents && !customAmount
                  ? "bg-emerald-600 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {formatCurrencyCents(cents)}
            </button>
          ))}
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true">
            EUR
          </span>
          <input
            id="custom_amount"
            type="number"
            min="1"
            step="0.01"
            inputMode="decimal"
            value={customAmount}
            onChange={(e) => handleCustomAmountChange(e.target.value)}
            placeholder={t("customPlaceholder")}
            autoComplete="off"
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-12 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          />
        </div>
      </div>

      {/* Kampagnen-ID wird intern gesetzt (Auswahl erfolgt über die Karten auf der Seite) */}

      {/* Eingeloggt-Hinweis oder Name/Email-Felder */}
      {user ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <UserCheck className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-emerald-800">
              {t("donateAs", { name: user.full_name })}
            </p>
            <p className="text-emerald-600">{user.email}</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="donor_name" className="mb-1.5 block text-sm font-medium text-gray-700">
              {t("nameLabel")}
            </label>
            <input
              id="donor_name"
              type="text"
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
              placeholder={t("namePlaceholder")}
              autoComplete="name"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="donor_email" className="mb-1.5 block text-sm font-medium text-gray-700">
              {t("emailLabel")}
            </label>
            <input
              id="donor_email"
              type="email"
              value={donorEmail}
              onChange={(e) => setDonorEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              autoComplete="email"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>
        </div>
      )}

      {/* Betrag anzeigen + Gebühren-Checkbox */}
      <div className="rounded-lg bg-emerald-50 p-4">
        <div className="text-center">
          <p className="text-sm text-gray-600">{t("yourAmount")}</p>
          <p className="text-3xl font-extrabold text-emerald-700">
            {formatCurrencyCents(amountCents)}
          </p>
        </div>

        {/* Gebühren-Checkbox — nur bei >= 2 € */}
        {showFeeCheckbox && (
          <div className="mt-3 border-t border-emerald-100 pt-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={coverFees}
                onChange={(e) => setCoverFees(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer rounded accent-emerald-600"
              />
              <span className="text-sm text-gray-700">
                Ich übernehme die Transaktionskosten, damit meine Spende vollständig ankommt{" "}
                <span className="font-semibold text-emerald-700">(+{formatCurrencyCents(feeEstimateCents)})</span>
              </span>
            </label>
            {coverFees && (
              <p className="mt-2 pl-7 text-xs text-gray-500">
                Gesamtbetrag: <span className="font-semibold">{formatCurrencyCents(displayTotalCents)}</span>
                {" "}· Geschätzt, kann je nach Zahlungsmethode leicht variieren.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Zahlungsmethode (nur Demo) */}
      {isDemo && (
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">
            Zahlungsmethode{" "}
            <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
              Demo
            </span>
          </p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Zahlungsmethode wählen">
            <button
              type="button"
              onClick={() => setPaymentMethodType("card")}
              className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                paymentMethodType === "card"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              Kartenzahlung
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethodType("sepa_debit")}
              className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                paymentMethodType === "sepa_debit"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Building2 className="h-4 w-4" aria-hidden="true" />
              SEPA-Lastschrift
            </button>
          </div>
          {paymentMethodType === "sepa_debit" && (
            <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <strong>Test-IBAN:</strong> DE08 3704 0044 0532 0130 03 — Zahlung wechselt nach ~3 Min. auf
              &bdquo;erfolgreich&rdquo;.
            </p>
          )}
        </div>
      )}

      <TurnstileWidget onVerify={handleTurnstileVerify} />

      {/* Submit */}
      <button
        type="button"
        onClick={handleStripeCheckout}
        disabled={isSubmitting || amountCents < 100}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-lg font-bold text-white shadow-lg transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? (
          t("submitting")
        ) : (
          <>
            <Heart className="h-5 w-5" />
            {coverFees
              ? `Jetzt ${formatCurrencyCents(displayTotalCents)} spenden`
              : t("submitBtn")}
          </>
        )}
      </button>

      {/* Transparenz-Hinweis */}
      <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
        <p className="text-xs text-emerald-800">
          {coverFees
            ? "Sie übernehmen die Transaktionskosten, sodass der Spendenbetrag nahezu vollständig bei der Moschee ankommt."
            : "Moschee.App erhebt keine Provision. Ihre Zahlung wird direkt an die Moschee weitergeleitet. Es können lediglich Gebühren des Zahlungsanbieters (Stripe) anfallen."}
        </p>
      </div>

      <p className="text-center text-xs text-gray-400">
        {t("securePayment")}
      </p>
    </div>
  );
}
