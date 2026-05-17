import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Optionale Primär-Aktion (Button oder Link). */
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

/**
 * Einheitlicher Leerzustand für Listen/Übersichten.
 * Mobile-first, zentriert, optionale Aktion.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 px-6 py-12 text-center ${className}`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
        <Icon className="h-7 w-7 text-emerald-600" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-gray-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>
      )}
      {action &&
        (action.href ? (
          <Link
            href={action.href}
            className="mt-5 inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="mt-5 inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}
