"use client";

import { ChevronUp, ChevronDown } from "lucide-react";

export type SortDir = "asc" | "desc";

/**
 * Klickbare Tabellen-Spaltenüberschrift mit Sortier-Indikator.
 * Funktioniert für client- und serverseitige Sortierung — der Aufrufer
 * entscheidet im onClick, ob lokal neu sortiert oder neu geladen wird.
 */
export function SortableHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
  className = "",
  title,
}: {
  label: React.ReactNode;
  /** Ist diese Spalte aktuell die Sortier-Spalte? */
  active: boolean;
  /** Aktuelle Richtung (nur relevant wenn active). */
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex items-center gap-0.5 hover:text-gray-700 ${
        align === "right" ? "ml-auto" : ""
      } ${className}`}
    >
      {label}
      {!active ? (
        <ChevronDown className="ml-1 inline h-3 w-3 opacity-30" />
      ) : dir === "asc" ? (
        <ChevronUp className="ml-1 inline h-3 w-3 text-emerald-600" />
      ) : (
        <ChevronDown className="ml-1 inline h-3 w-3 text-emerald-600" />
      )}
    </button>
  );
}
