"use client";

import { useEffect, useState } from "react";
import {
  Download,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
} from "lucide-react";
import {
  getEventRegistrations,
  exportRegistrationsCSV,
} from "@/lib/actions/events";
import type { EventRegistration } from "@/types";

interface RegistrationListProps {
  eventId: string;
  mosqueId: string;
  eventTitle: string;
}

const statusBadges: Record<
  string,
  { label: string; className: string; icon: React.ReactNode }
> = {
  registered: {
    label: "Registriert",
    className: "bg-blue-50 text-blue-700",
    icon: <Clock className="h-3 w-3" />,
  },
  attended: {
    label: "Teilgenommen",
    className: "bg-green-50 text-green-700",
    icon: <CheckCircle className="h-3 w-3" />,
  },
  cancelled: {
    label: "Storniert",
    className: "bg-red-50 text-red-700",
    icon: <XCircle className="h-3 w-3" />,
  },
  no_show: {
    label: "Nicht erschienen",
    className: "bg-gray-50 text-gray-700",
    icon: <UserCheck className="h-3 w-3" />,
  },
};

export function RegistrationList({
  eventId,
  mosqueId,
  eventTitle,
}: RegistrationListProps) {
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const result = await getEventRegistrations(eventId, mosqueId);
      if (result.success && result.data) {
        setRegistrations(result.data);
      }
      setIsLoading(false);
    }
    load();
  }, [eventId, mosqueId]);

  async function handleExportCSV() {
    setIsExporting(true);
    try {
      const result = await exportRegistrationsCSV(eventId, mosqueId);
      if (result.success && result.data) {
        // CSV als Datei herunterladen
        const blob = new Blob(["\uFEFF" + result.data], {
          type: "text/csv;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `registrierungen-${eventTitle.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "-")}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } finally {
      setIsExporting(false);
    }
  }

  const registeredCount = registrations.filter(
    (r) => r.status === "registered"
  ).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-600" />
          <h3 className="text-lg font-bold text-gray-900">
            Teilnehmer ({registeredCount})
          </h3>
        </div>
        {registrations.length > 0 && (
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={isExporting}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {isExporting ? "Exportiere..." : "CSV exportieren"}
          </button>
        )}
      </div>

      {/* Liste */}
      {registrations.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center">
          <Users className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">
            Noch keine Anmeldungen für diese Veranstaltung.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  E-Mail
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Typ
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Registriert
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {registrations.map((reg) => {
                const badge = statusBadges[reg.status] || statusBadges.registered;
                return (
                  <tr
                    key={reg.id}
                    className="transition-colors hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {reg.registrant_type === "guest"
                        ? reg.guest_name || "—"
                        : `Mitglied`}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {reg.registrant_type === "guest"
                        ? reg.guest_email || "—"
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          reg.registrant_type === "guest"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {reg.registrant_type === "guest"
                          ? "Gast"
                          : "Mitglied"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                      >
                        {badge.icon}
                        {badge.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {reg.registered_at
                        ? new Date(reg.registered_at).toLocaleDateString(
                            "de-DE",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
