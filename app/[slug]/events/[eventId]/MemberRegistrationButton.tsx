"use client";

import { useState } from "react";
import {
  CheckCircle,
  UserPlus,
  UserMinus,
  Loader2,
  CreditCard,
  Banknote,
  Clock,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  registerMemberForEvent,
  cancelMemberRegistration,
  switchToBarPayment,
  retryEventPayment,
} from "@/lib/actions/events";
import type { EventRegistration } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface MemberRegistrationButtonProps {
  eventId: string;
  mosqueId: string;
  userId: string;
  slug: string;
  baseUrl: string;
  isPaid?: boolean;
  priceCents?: number;
  initialRegistration?: EventRegistration;
}

export function MemberRegistrationButton({
  eventId,
  mosqueId,
  userId,
  slug,
  baseUrl,
  isPaid = false,
  priceCents = 0,
  initialRegistration,
}: MemberRegistrationButtonProps) {
  const [registration, setRegistration] = useState<EventRegistration | undefined>(
    initialRegistration
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const paymentStatus = registration?.payment_status;
  const paymentMethod = registration?.payment_method;

  // Zustand: angemeldet + bezahlt (oder kostenlos)
  const isPaidOrFree =
    paymentStatus === "paid" || paymentStatus === "free" || registration?.status === "registered";

  // Zustand: Zahlung ausstehend per Karte
  const isPendingCard = registration?.status === "pending" && paymentMethod === "card";

  // Zustand: SEPA läuft
  const isPendingSepa = paymentStatus === "pending_sepa";

  // Zustand: Barzahlung geplant
  const isPendingCash = registration?.status === "pending" && paymentMethod === "cash";

  // Zustand: fehlgeschlagen oder abgelaufen
  const isFailedOrExpired =
    paymentStatus === "expired" || paymentStatus === "failed" ||
    registration?.status === "expired";

  async function handleRegister() {
    setError("");
    setIsLoading(true);
    try {
      const result = await registerMemberForEvent(mosqueId, eventId, userId, slug, baseUrl);
      if (result.success) {
        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
          return;
        }
        // Kostenloses Event → als angemeldet markieren
        setRegistration((prev) => ({
          ...(prev ?? ({} as EventRegistration)),
          status: "registered",
          payment_status: "free",
        }));
      } else {
        setError(result.error || "Anmeldung fehlgeschlagen");
      }
    } catch {
      setError("Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Möchten Sie sich wirklich abmelden?")) return;
    if (!registration?.id) return;
    setError("");
    setIsLoading(true);
    try {
      const result = await cancelMemberRegistration(eventId, userId, mosqueId);
      if (result.success) {
        setRegistration(undefined);
      } else {
        setError(result.error || "Abmeldung fehlgeschlagen");
      }
    } catch {
      setError("Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSwitchToCash() {
    if (!registration?.id) return;
    setError("");
    setIsLoading(true);
    try {
      const result = await switchToBarPayment(registration.id, userId);
      if (result.success) {
        setRegistration((prev) => ({
          ...(prev ?? ({} as EventRegistration)),
          status: "pending",
          payment_status: "pending",
          payment_method: "cash",
        }));
      } else {
        setError(result.error || "Umstellung fehlgeschlagen");
      }
    } catch {
      setError("Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRetryPayment() {
    if (!registration?.id) return;
    setError("");
    setIsLoading(true);
    try {
      const result = await retryEventPayment(registration.id, userId, slug, baseUrl);
      if (result.success && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      } else {
        setError(result.error || "Checkout fehlgeschlagen");
      }
    } catch {
      setError("Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Angemeldet ✓ (bezahlt oder kostenlos) ── */}
      {isPaidOrFree && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">
              {paymentStatus === "paid" ? "Angemeldet ✓ — Zahlung bestätigt" : "Sie sind angemeldet"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isLoading}
            className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserMinus className="h-4 w-4" />
            )}
            Abmelden
          </button>
        </div>
      )}

      {/* ── SEPA läuft (1–3 Werktage) ── */}
      {isPendingSepa && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-blue-800">SEPA-Zahlung läuft (1–3 Werktage)</p>
            <p className="mt-0.5 text-xs text-blue-600">
              Ihr Platz ist reserviert. Sie erhalten eine Bestätigung sobald die Zahlung eingegangen ist.
            </p>
          </div>
        </div>
      )}

      {/* ── Barzahlung geplant ── */}
      {isPendingCash && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Barzahlung geplant ✓</p>
            <p className="mt-0.5 text-xs text-amber-600">
              Ihr Platz ist reserviert. Bitte bezahlen Sie{" "}
              {priceCents > 0 ? formatCurrency(priceCents / 100) : ""} am Veranstaltungstag.
            </p>
          </div>
        </div>
      )}

      {/* ── Kartenzahlung ausstehend ── */}
      {isPendingCard && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4">
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
            <div>
              <p className="text-sm font-semibold text-orange-800">Zahlung ausstehend</p>
              <p className="mt-0.5 text-xs text-orange-600">
                Schließen Sie die Zahlung ab, um Ihren Platz zu sichern.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (registration?.checkout_url) {
                window.location.href = registration.checkout_url;
              }
            }}
            disabled={isLoading || !registration?.checkout_url}
            className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            <CreditCard className="h-4 w-4" />
            Zahlung abschließen
          </button>
          <button
            type="button"
            onClick={handleSwitchToCash}
            disabled={isLoading}
            className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Banknote className="h-4 w-4" />
            )}
            Lieber bar zahlen
          </button>
        </div>
      )}

      {/* ── Zahlung fehlgeschlagen / abgelaufen ── */}
      {isFailedOrExpired && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-semibold text-red-800">Zahlung fehlgeschlagen</p>
              <p className="mt-0.5 text-xs text-red-600">
                Ihre Zahlung konnte nicht verarbeitet werden. Bitte erneut versuchen oder bar zahlen.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetryPayment}
            disabled={isLoading}
            className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Erneut bezahlen
          </button>
          <button
            type="button"
            onClick={handleSwitchToCash}
            disabled={isLoading}
            className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Banknote className="h-4 w-4" />
            )}
            Lieber bar zahlen
          </button>
        </div>
      )}

      {/* ── Noch nicht angemeldet ── */}
      {!registration && (
        <button
          type="button"
          onClick={handleRegister}
          disabled={isLoading}
          className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPaid ? (
            <CreditCard className="h-4 w-4" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          {isPaid && priceCents > 0
            ? `Platz sichern & bezahlen (${formatCurrency(priceCents / 100)})`
            : "Mit einem Klick anmelden"}
        </button>
      )}
    </div>
  );
}
