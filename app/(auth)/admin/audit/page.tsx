"use client";

import { useEffect, useState } from "react";
import { Shield, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useMosque } from "@/lib/mosque-context";
import { getAuditLogs } from "@/lib/actions/audit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";
import type { AuditLog } from "@/types";

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

const VALUE_FIELD_MAP: Record<string, string> = {
  assigned_role: "role",
  new_role: "role",
  old_role: "role",
  assigned_status: "status",
  initial_status: "status",
  old_status: "status",
  new_status: "status",
  invite_type: "type",
};

// Nur diese Felder haben Enum-Werte die übersetzt werden — Freitext-Felder werden nie übersetzt
const VALUE_TRANSLATABLE_FIELDS = new Set([
  "relation_type",
  "role", "assigned_role", "new_role", "old_role",
  "status", "assigned_status", "initial_status", "old_status", "new_status",
  "type", "invite_type",
  "payment_method",
  "visibility",
]);

function formatValue(v: unknown, field?: string, vLabel?: (f: string, v: string) => string): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Ja" : "Nein";
  const str = String(v);
  if (field && vLabel && VALUE_TRANSLATABLE_FIELDS.has(field)) return vLabel(field, str);
  return str;
}

function AuditChanges({
  log,
  fieldLabel,
  valueLabel,
}: {
  log: AuditLog;
  fieldLabel: (key: string) => string;
  valueLabel: (field: string, val: string) => string;
}) {
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
            <span className="line-through text-red-400">{formatValue(before![k], k, valueLabel)}</span>
            <span className="text-gray-300">→</span>
            <span className="text-emerald-600">{formatValue(after![k], k, valueLabel)}</span>
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
            <span className="text-gray-700">{formatValue(v, k, valueLabel)}</span>
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
            <span className="text-gray-500 line-through">{formatValue(v, k, valueLabel)}</span>
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
            <span className="text-gray-700">{formatValue(v, k, valueLabel)}</span>
          </div>
        ))}
      </div>
    );
  }

  return <span className="text-gray-300">—</span>;
}

export default function AuditLogPage() {
  const { mosqueId } = useMosque();
  const t = useTranslations("audit");
  const tCommon = useTranslations("common");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [entityFilter, setEntityFilter] = useState("");

  const entityFilters = [
    { value: "", label: t("filterAll") },
    { value: "post", label: t("entityFilter.post") },
    { value: "event", label: t("entityFilter.event") },
    { value: "event_registration", label: t("entityFilter.event_registration") },
    { value: "campaign", label: t("entityFilter.campaign") },
    { value: "donation", label: t("entityFilter.donation") },
    { value: "member", label: t("entityFilter.member") },
    { value: "invite", label: t("entityFilter.invite") },
    { value: "madrasa", label: t("entityFilter.madrasa") },
    { value: "student_fees", label: t("entityFilter.student_fees") },
    { value: "newsletter", label: t("entityFilter.newsletter") },
    { value: "settings", label: t("entityFilter.settings") },
  ];

  function fieldLabel(key: string): string {
    try {
      return t(`field.${key}` as Parameters<typeof t>[0]) || key;
    } catch {
      return key;
    }
  }

  function valueLabel(field: string, val: string): string {
    const normalizedField = VALUE_FIELD_MAP[field] || field;
    try {
      const translated = t(`value.${normalizedField}.${val}` as Parameters<typeof t>[0]);
      return translated || val;
    } catch {
      return val;
    }
  }

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
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("title")}>
        {entityFilters.map((type) => (
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
            {t("record")}
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
              <p className="text-gray-500">{t("noLogsYet")}</p>
              <p className="text-sm text-gray-400">{t("noLogsHint")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 whitespace-nowrap">{t("colDate")}</th>
                    <th className="px-4 py-3 whitespace-nowrap">{t("colEntity")}</th>
                    <th className="px-4 py-3 whitespace-nowrap">{t("colAction")}</th>
                    <th className="px-4 py-3 whitespace-nowrap">{t("colUser")}</th>
                    <th className="px-4 py-3">{t("colChanges")}</th>
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
                          {(t(`entity.${log.entity_type}` as Parameters<typeof t>[0]) || log.entity_type)}
                        </span>
                      </td>

                      {/* Aktion */}
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${getActionColor(log.action)}`}
                        >
                          {(t(`action.${log.action}` as Parameters<typeof t>[0]) || log.action)}
                        </span>
                      </td>

                      {/* Von (actor) */}
                      <td className="px-4 py-3 align-top">
                        <span className="whitespace-nowrap text-xs text-gray-600">
                          {log.actor_user_id
                            ? (actorNames[log.actor_user_id] || t("unknown"))
                            : <span className="text-gray-400">{t("system")}</span>
                          }
                        </span>
                      </td>

                      {/* Änderungen */}
                      <td className="px-4 py-3 align-top">
                        <AuditChanges log={log} fieldLabel={fieldLabel} valueLabel={valueLabel} />
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
                {tCommon("pageOf", { page, total: totalPages })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label={tCommon("prevPage")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  aria-label={tCommon("nextPage")}
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
