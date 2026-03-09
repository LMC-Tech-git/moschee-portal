"use client";

import { useState, useCallback } from "react";
import { CheckCircle } from "lucide-react";
import { TurnstileWidget } from "@/components/shared/TurnstileWidget";

interface GuestRegistrationFormProps {
  slug: string;
  eventId: string;
  mosqueId: string;
}

export function GuestRegistrationForm({
  slug,
  eventId,
  mosqueId,
}: GuestRegistrationFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch(
        `/api/${slug}/events/${eventId}/register-guest`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guest_name: name,
            guest_email: email,
            mosque_id: mosqueId,
            turnstile_token: turnstileToken,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Registrierung fehlgeschlagen");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Ein Netzwerkfehler ist aufgetreten");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <CheckCircle className="mb-3 h-12 w-12 text-emerald-500" />
        <h4 className="text-lg font-bold text-gray-900">
          Erfolgreich angemeldet!
        </h4>
        <p className="mt-1 text-sm text-gray-600">
          Sie erhalten eine Bestätigung per E-Mail an {email}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="guest_name" className="mb-1.5 block text-sm font-medium text-gray-700">
          Name *
        </label>
        <input
          id="guest_name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ihr vollständiger Name"
          required
          minLength={2}
          autoComplete="name"
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        />
      </div>

      <div>
        <label htmlFor="guest_email" className="mb-1.5 block text-sm font-medium text-gray-700">
          E-Mail *
        </label>
        <input
          id="guest_email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ihre@email.de"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        />
      </div>

      <div className="flex items-start gap-2">
        <input
          id="accept_privacy"
          type="checkbox"
          checked={acceptPrivacy}
          onChange={(e) => setAcceptPrivacy(e.target.checked)}
          required
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
        />
        <label htmlFor="accept_privacy" className="text-sm text-gray-600">
          Ich akzeptiere die Datenschutzerklärung und stimme der Verarbeitung
          meiner Daten für diese Veranstaltung zu. *
        </label>
      </div>

      <TurnstileWidget onVerify={handleTurnstileVerify} />

      <button
        type="submit"
        disabled={isSubmitting || !name || !email || !acceptPrivacy}
        className="w-full rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Wird registriert\u2026" : "Jetzt anmelden"}
      </button>
    </form>
  );
}
