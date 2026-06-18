"use client";

import type { ReactNode } from "react";

interface ToggleSwitchProps {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  /** "sm" für kompakte Listen (z.B. TV-Module), "md" Standard */
  size?: "sm" | "md";
  /** "card" = umrahmte Box mit Hover; "inline" = nur Text + Schalter; "bare" = nur Schalter */
  layout?: "card" | "inline" | "bare";
  id?: string;
  className?: string;
}

/**
 * Einheitlicher Schieberegler für alle Einstellungen.
 * Ein einziger <button role="switch"> als Klickziel → tastatur-bedienbar,
 * kein Doppel-Toggle. Aktiv: Emerald-Gradient + animierter Knopf.
 */
export function ToggleSwitch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  description,
  size = "md",
  layout = "card",
  id,
  className = "",
}: ToggleSwitchProps) {
  const dims =
    size === "sm"
      ? { track: "h-5 w-9", knob: "h-3.5 w-3.5", on: "translate-x-4", off: "translate-x-0.5" }
      : { track: "h-6 w-11", knob: "h-5 w-5", on: "translate-x-5", off: "translate-x-0.5" };

  const visualSwitch = (
    <span
      className={`relative inline-flex ${dims.track} shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
        checked
          ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
          : "bg-gray-300"
      }`}
    >
      <span
        className={`pointer-events-none inline-block transform ${dims.knob} rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
          checked ? dims.on : dims.off
        }`}
      />
    </span>
  );

  // Nur der Schalter, ohne Text
  if (layout === "bare" || (!label && !description)) {
    return (
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        aria-label={typeof label === "string" ? label : undefined}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={`inline-flex shrink-0 rounded-full transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          disabled ? "" : "cursor-pointer"
        } ${className}`}
      >
        {visualSwitch}
      </button>
    );
  }

  const text = (
    <span className="min-w-0 text-left">
      {label && <span className="block text-sm font-medium text-gray-900">{label}</span>}
      {description && <span className="mt-0.5 block text-xs text-gray-500">{description}</span>}
    </span>
  );

  const base =
    "flex w-full items-center justify-between gap-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

  const layoutCls =
    layout === "card"
      ? `rounded-xl border p-4 ${
          checked ? "border-emerald-200 bg-emerald-50/40" : "border-gray-200"
        } ${disabled ? "" : "cursor-pointer hover:bg-gray-50"}`
      : `${disabled ? "" : "cursor-pointer"}`;

  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={`${base} ${layoutCls} ${className}`}
    >
      {text}
      {visualSwitch}
    </button>
  );
}
