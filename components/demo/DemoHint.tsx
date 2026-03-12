"use client";

import { useEffect, useState } from "react";
import { X, Info } from "lucide-react";
import { useMosque } from "@/lib/mosque-context";
import { isDemoMosque } from "@/lib/demo";

const STORAGE_KEY = "moschee_demo_hints_dismissed";

function getDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function dismiss(id: string) {
  const current = getDismissed();
  if (!current.includes(id)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, id]));
  }
}

interface DemoHintProps {
  /** Eindeutige ID — wird in localStorage gespeichert wenn dismissed. */
  id: string;
  title: string;
  description: string;
  className?: string;
}

/**
 * Zeigt einen Onboarding-Hinweis für die Demo-Moschee.
 * Wird ausgeblendet wenn der User auf ✕ klickt (localStorage).
 * Rendert `null` außerhalb der Demo-Moschee oder wenn bereits dismissed.
 */
export function DemoHint({ id, title, description, className = "" }: DemoHintProps) {
  const { mosqueId } = useMosque();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (mosqueId && isDemoMosque(mosqueId)) {
      const dismissed = getDismissed();
      setVisible(!dismissed.includes(id));
    }
  }, [id, mosqueId]);

  if (!visible) return null;

  function handleDismiss() {
    dismiss(id);
    setVisible(false);
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 ${className}`}
      role="note"
      aria-label={`Demo-Hinweis: ${title}`}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-amber-700">{description}</p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded p-0.5 text-amber-500 hover:bg-amber-100 hover:text-amber-700 transition-colors"
        aria-label="Hinweis schließen"
        title="Nicht mehr anzeigen"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
