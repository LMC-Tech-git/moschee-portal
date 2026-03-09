"use client";

import { useState, useCallback, useEffect } from "react";
import { Heart, ExternalLink, UserCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { formatCurrencyCents } from "@/lib/utils";
import { TurnstileWidget } from "@/components/shared/TurnstileWidget";
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
}: DonationFormProps) {
  const presetAmounts = (quickAmounts && quickAmounts.length > 0) ? quickAmounts : DEFAULT_PRESET_AMOUNTS;
  const { user, pb } = useAuth();
  const [amountCents, setAmountCents] = useState(() => {
    const amounts = (quickAmounts && quickAmounts.length > 0) ? quickAmounts : DEFAULT_PRESET_AMOUNTS;
    return amounts[Math.floor(amounts.length / 2)] ?? 2000;
  });
  const [customAmount, setCustomAmount] = useState("");
  const [campaignId, setCampaignId] = useState(preselectedCampaignId || "");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

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
          Spenden werden über einen externen Dienst abgewickelt.
        </p>
        <a
          href={externalDonationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-8 py-3 text-lg font-bold text-white shadow-lg transition-colors hover:bg-amber-600"
        >
          <ExternalLink className="h-5 w-5" />
          {externalDonationLabel || "Jetzt spenden"}
        </a>
      </div>
    );
  }

  if (donationProvider === "paypal" && paypalDonateUrl) {
    return (
      <div className="text-center">
        <Heart className="mx-auto mb-4 h-12 w-12 text-amber-500" />
        <p className="mb-6 text-gray-600">
          Spenden werden über PayPal abgewickelt.
        </p>
        <a
          href={paypalDonateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-3 text-lg font-bold text-white shadow-lg transition-colors hover:bg-blue-700"
        >
          <ExternalLink className="h-5 w-5" />
          Mit PayPal spenden
        </a>
      </div>
    );
  }

  if (donationProvider === "none") {
    return (
      <div className="text-center">
        <Heart className="mx-auto mb-4 h-12 w-12 text-gray-300" />
        <p className="text-gray-500">
          Online-Spenden sind derzeit nicht aktiviert.
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Bitte kontaktieren Sie die Moschee direkt.
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
          }),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Fehler beim Erstellen der Zahlung");
        return;
      }

      // Weiterleitung zu Stripe Checkout
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch {
      setError("Ein Netzwerkfehler ist aufgetreten");
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

      {/* Betrag wählen */}
      <div>
        <label htmlFor="custom_amount" className="mb-2 block text-sm font-medium text-gray-700">
          Spendenbetrag
        </label>
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Vorgeschlagene Beträge">
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
            placeholder="Anderer Betrag"
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
              Spende als {user.full_name}
            </p>
            <p className="text-emerald-600">{user.email}</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="donor_name" className="mb-1.5 block text-sm font-medium text-gray-700">
              Name (optional)
            </label>
            <input
              id="donor_name"
              type="text"
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
              placeholder="Ihr Name"
              autoComplete="name"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="donor_email" className="mb-1.5 block text-sm font-medium text-gray-700">
              E-Mail (optional)
            </label>
            <input
              id="donor_email"
              type="email"
              value={donorEmail}
              onChange={(e) => setDonorEmail(e.target.value)}
              placeholder="ihre@email.de"
              autoComplete="email"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>
        </div>
      )}

      {/* Betrag anzeigen */}
      <div className="rounded-lg bg-emerald-50 p-4 text-center">
        <p className="text-sm text-gray-600">Ihr Spendenbetrag:</p>
        <p className="text-3xl font-extrabold text-emerald-700">
          {formatCurrencyCents(amountCents)}
        </p>
      </div>

      <TurnstileWidget onVerify={handleTurnstileVerify} />

      {/* Submit */}
      <button
        type="button"
        onClick={handleStripeCheckout}
        disabled={isSubmitting || amountCents < 100}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-lg font-bold text-white shadow-lg transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? (
          "Wird vorbereitet\u2026"
        ) : (
          <>
            <Heart className="h-5 w-5" />
            Jetzt spenden
          </>
        )}
      </button>

      <p className="text-center text-xs text-gray-400">
        Sichere Zahlung über Stripe. Ihre Daten werden verschlüsselt übertragen.
      </p>
    </div>
  );
}
