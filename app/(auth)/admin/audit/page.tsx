"use client";

import { useEffect, useState } from "react";
import { Shield, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useMosque } from "@/lib/mosque-context";
import { getAuditLogs } from "@/lib/actions/audit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditLog } from "@/types";

const ENTITY_TYPE_FILTERS = [
  { value: "", label: "Alle" },
  { value: "post", label: "Posts" },
  { value: "event", label: "Events" },
  { value: "event_registration", label: "Registrierungen" },
  { value: "campaign", label: "Kampagnen" },
  { value: "donation", label: "Spenden" },
  { value: "member", label: "Mitglieder" },
  { value: "invite", label: "Einladungen" },
  { value: "madrasa", label: "Madrasa" },
  { value: "student_fees", label: "Gebühren" },
  { value: "newsletter", label: "Newsletter" },
  { value: "settings", label: "Einstellungen" },
];

/** Lesbare Bezeichnung für entity_type */
const ENTITY_TYPE_LABELS: Record<string, string> = {
  post: "Post",
  event: "Event",
  event_registration: "Registrierung",
  campaign: "Kampagne",
  donation: "Spende",
  member: "Mitglied",
  users: "Nutzer",
  invite: "Einladung",
  course: "Kurs",
  student: "Schüler",
  course_enrollment: "Einschreibung",
  attendance: "Anwesenheit",
  academic_year: "Schuljahr",
  student_fees: "Gebühren",
  student_fee: "Gebühr",
  newsletter: "Newsletter",
  settings: "Einstellungen",
  mosques: "Moschee",
};

const ACTION_LABELS: Record<string, string> = {
  "post.created": "Post erstellt",
  "post.updated": "Post bearbeitet",
  "post.deleted": "Post gelöscht",
  "event.created": "Event erstellt",
  "event.updated": "Event bearbeitet",
  "event.deleted": "Event gelöscht",
  "event_registration.guest_created": "Gast-Anmeldung",
  "event_registration.member_created": "Mitglieder-Anmeldung",
  "event_registration.cancelled": "Abmeldung",
  "campaign.created": "Kampagne erstellt",
  "campaign.updated": "Kampagne bearbeitet",
  "campaign.deleted": "Kampagne gelöscht",
  "donation.created": "Spende erstellt",
  "donation.status_changed": "Spenden-Status geändert",
  "donation.paid": "Spende bezahlt",
  "donation.failed": "Spende fehlgeschlagen",
  "donation.refunded": "Spende erstattet",
  "member.status_changed": "Status geändert",
  "member.role_changed": "Rolle geändert",
  "member.updated": "Mitglied bearbeitet",
  "invite.created": "Einladung erstellt",
  "invite.revoked": "Einladung widerrufen",
  "invite.deleted": "Einladung gelöscht",
  "invite.consumed": "Einladung angenommen",
  "course.created": "Kurs erstellt",
  "course.updated": "Kurs bearbeitet",
  "course.deleted": "Kurs gelöscht",
  "student.created": "Schüler erstellt",
  "student.updated": "Schüler bearbeitet",
  "student.imported": "Schüler importiert",
  "enrollment.created": "Einschreibung erstellt",
  "attendance.saved": "Anwesenheit gespeichert",
  "attendance.session_deleted": "Anwesenheits-Session gelöscht",
  "academic_year.created": "Schuljahr erstellt",
  "academic_year.updated": "Schuljahr bearbeitet",
  "academic_year.archived": "Schuljahr archiviert",
  "student_fees.bulk_created": "Gebühren erstellt",
  "student_fee.marked_paid": "Gebühr bezahlt (Bar/Überweisung)",
  "student_fee.paid_stripe": "Gebühr bezahlt (Stripe)",
  "student_fee.waived": "Gebühr erlassen",
  "newsletter.queued": "Newsletter eingereiht",
  "newsletter.sent": "Newsletter gesendet",
  "fee_reminder.sent": "Gebühren-Erinnerung gesendet",
  "update_branding": "Branding aktualisiert",
  "update_prayer_settings": "Gebetszeiten aktualisiert",
  "update_default_settings": "Standardeinstellungen aktualisiert",
  "update_madrasa_fee_settings": "Madrasa-Einstellungen aktualisiert",
};

/** Lesbare Bezeichnungen für Felder in before/after/diff */
const FIELD_LABELS: Record<string, string> = {
  title: "Titel",
  description: "Beschreibung",
  status: "Status",
  category: "Kategorie",
  goal_amount_cents: "Zielbetrag (Ct)",
  amount_cents: "Betrag (Ct)",
  start_at: "Start",
  end_at: "Ende",
  role: "Rolle",
  name: "Name",
  email: "E-Mail",
  provider: "Anbieter",
  donor_type: "Spendentyp",
  visibility: "Sichtbarkeit",
  payment_method: "Zahlungsart",
  month_key: "Monat",
};

const ACTION_COLORS: Record<string, string> = {
  created: "bg-emerald-100 text-emerald-700",
  imported: "bg-emerald-100 text-emerald-700",
  saved: "bg-emerald-100 text-emerald-700",
  consumed: "bg-emerald-100 text-emerald-700",
  paid: "bg-emerald-100 text-emerald-700",
  updated: "bg-blue-100 text-blue-700",
  changed: "bg-blue-100 text-blue-700",
  deleted: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
  revoked: "bg-red-100 text-red-700",
  refunded: "bg-amber-100 text-amber-700",
  waived: "bg-amber-100 text-amber-700",
  archived: "bg-amber-100 text-amber-700",
  cancelled: "bg-gray-100 text-gray-700",
  queued: "bg-purple-100 text-purple-700",
  sent: "bg-purple-100 text-purple-700",
};

function getActionColor(action: string): string {
  const suffix = action.split(".").pop() || "";
  return ACTION_COLORS[suffix] || "bg-gray-100 text-gray-700";
}

function formatAuditDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] || key;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "ja" : "nein";
  return String(v);
}

/** Ändert sich ein Wert? Dann zeige alt → neu, sonst nichts */
function AuditChanges({ log }: { log: AuditLog }) {
  let before: Record<string, unknown> | null = null;
  let after: Record<string, unknown> | null = null;
  let details: Record<string, unknown> | null = null;

  try { if (log.before_json) before = JSON.parse(log.before_json); } catch { /* ignore */ }
  try { if (log.after_json) after = JSON.parse(log.after_json); } catch { /* ignore */ }
  try { if (log.diff_json) details = JSON.parse(log.diff_json); } catch { /* ignore */ }

  const suffix = log.action.split(".").pop() || "";

  // Updates: nur geänderte Felder
  if (before && after) {
    const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    const changed = allKeys.filter(
      (k) => String(before![k] ?? "") !== String(after![k] ?? "")
    );
    if (changed.length === 0) return <span className="text-gray-300">—</span>;
    return (
      <div className="space-y-0.5">
        {changed.map((k) => (
          <div key={k} className="flex flex-wrap items-baseline gap-1 text-xs">
            <span className="font-medium text-gray-500">{fieldLabel(k)}:</span>
            <span className="line-through text-red-400">{formatValue(before![k])}</span>
            <span className="text-gray-300">→</span>
            <span className="text-emerald-600">{formatValue(after![k])}</span>
          </div>
        ))}
      </div>
    );
  }

  // Erstellt / Importiert / Eingereiht: after-Snapshot
  if (after && (suffix === "created" || suffix === "imported" || suffix === "queued")) {
    const entries = Object.entries(after).filter(([, v]) => v !== "" && v !== null && v !== undefined);
    if (entries.length === 0) return <span className="text-gray-300">—</span>;
    return (
      <div className="space-y-0.5">
        {entries.map(([k, v]) => (
          <div key={k} className="flex flex-wrap gap-1 text-xs">
            <span className="font-medium text-gray-500">{fieldLabel(k)}:</span>
            <span className="text-gray-700">{formatValue(v)}</span>
          </div>
        ))}
      </div>
    );
  }

  // Gelöscht: before-Snapshot
  if (before && suffix === "deleted") {
    const entries = Object.entries(before).filter(([, v]) => v !== "" && v !== null && v !== undefined);
    if (entries.length === 0) return <span className="text-gray-300">—</span>;
    return (
      <div className="space-y-0.5">
        {entries.map(([k, v]) => (
          <div key={k} className="flex flex-wrap gap-1 text-xs">
            <span className="font-medium text-gray-500">{fieldLabel(k)}:</span>
            <span className="text-gray-500 line-through">{formatValue(v)}</span>
          </div>
        ))}
      </div>
    );
  }

  // Fallback: Legacy diff_json
  if (details && Object.keys(details).length > 0) {
    const entries = Object.entries(details).filter(([, v]) => v !== "" && v !== null && v !== undefined);
    return (
      <div className="space-y-0.5">
        {entries.map(([k, v]) => (
          <div key={k} className="flex flex-wrap gap-1 text-xs">
            <span className="font-medium text-gray-500">{fieldLabel(k)}:</span>
            <span className="text-gray-700">{formatValue(v)}</span>
          </div>
        ))}
      </div>
    );
  }

  return <span className="text-gray-300">—</span>;
}

export default function AuditLogPage() {
  const { mosqueId } = useMosque();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [entityFilter, setEntityFilter] = useState("");

  useEffect(() => {
    if (!mosqueId) return;

    async function load() {
      setIsLoading(true);
      const result = await getAuditLogs(mosqueId, {
        page,
        entityType: entityFilter || undefined,
      });
      if (result.success && result.data) {
        setLogs(result.data);
        setActorNames((prev) => ({ ...prev, ...result.actorNames }));
        setTotalPages(result.totalPages || 1);
      }
      setIsLoading(false);
    }
    load();
  }, [mosqueId, page, entityFilter]);

  function handleFilterChange(entityType: string) {
    setEntityFilter(entityType);
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-emerald-600" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-gray-900">Audit-Log</h1>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Audit-Log filtern">
        {ENTITY_TYPE_FILTERS.map((type) => (
          <button
            key={type.value}
            role="tab"
            aria-selected={entityFilter === type.value}
            onClick={() => handleFilterChange(type.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              entityFilter === type.value
                ? "bg-emerald-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" aria-hidden="true" />
            Protokoll
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center">
              <Shield className="mx-auto mb-3 h-12 w-12 text-gray-300" aria-hidden="true" />
              <p className="text-gray-500">Keine Audit-Einträge gefunden.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 whitespace-nowrap">Datum</th>
                    <th className="px-4 py-3 whitespace-nowrap">Bereich</th>
                    <th className="px-4 py-3 whitespace-nowrap">Aktion</th>
                    <th className="px-4 py-3 whitespace-nowrap">Von</th>
                    <th className="px-4 py-3">Änderungen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50">
                      {/* Datum */}
                      <td className="px-4 py-3 align-top">
                        <span className="whitespace-nowrap text-xs text-gray-500">
                          {formatAuditDate(log.created)}
                        </span>
                      </td>

                      {/* Bereich (entity_type) */}
                      <td className="px-4 py-3 align-top">
                        <span className="whitespace-nowrap text-xs text-gray-600">
                          {ENTITY_TYPE_LABELS[log.entity_type] || log.entity_type}
                        </span>
                      </td>

                      {/* Aktion */}
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${getActionColor(log.action)}`}
                        >
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>

                      {/* Von (actor) */}
                      <td className="px-4 py-3 align-top">
                        <span className="whitespace-nowrap text-xs text-gray-600">
                          {log.actor_user_id
                            ? (actorNames[log.actor_user_id] || "Unbekannt")
                            : <span className="text-gray-400">System</span>
                          }
                        </span>
                      </td>

                      {/* Änderungen */}
                      <td className="px-4 py-3 align-top">
                        <AuditChanges log={log} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-gray-500">
                Seite {page} von {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Vorherige Seite"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  aria-label="Nächste Seite"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
