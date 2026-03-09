"use client";

import { useState } from "react";
import { CheckCircle, UserPlus, UserMinus, Loader2 } from "lucide-react";
import {
  registerMemberForEvent,
  cancelMemberRegistration,
} from "@/lib/actions/events";

interface MemberRegistrationButtonProps {
  eventId: string;
  mosqueId: string;
  userId: string;
  initialRegistered: boolean;
}

export function MemberRegistrationButton({
  eventId,
  mosqueId,
  userId,
  initialRegistered,
}: MemberRegistrationButtonProps) {
  const [isRegistered, setIsRegistered] = useState(initialRegistered);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister() {
    setError("");
    setIsLoading(true);
    try {
      const result = await registerMemberForEvent(mosqueId, eventId, userId);
      if (result.success) {
        setIsRegistered(true);
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
    setError("");
    setIsLoading(true);
    try {
      const result = await cancelMemberRegistration(eventId, userId, mosqueId);
      if (result.success) {
        setIsRegistered(false);
      } else {
        setError(result.error || "Abmeldung fehlgeschlagen");
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

      {isRegistered ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">
              Sie sind angemeldet
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserMinus className="h-4 w-4" />
            )}
            Abmelden
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleRegister}
          disabled={isLoading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Mit einem Klick anmelden
        </button>
      )}
    </div>
  );
}
