"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import type { AuditLog } from "@/types";
import type { RecordModel } from "pocketbase";

const PAGE_SIZE = 25;

interface AuditLogFilters {
  page?: number;
  entityType?: string;
}

interface AuditLogResult {
  success: boolean;
  data?: AuditLog[];
  actorNames?: Record<string, string>;
  totalPages?: number;
  page?: number;
  error?: string;
}

function mapRecordToAuditLog(record: RecordModel): AuditLog {
  return {
    id: record.id,
    mosque_id: record.mosque_id || "",
    actor_user_id: record.actor_user_id || "",
    action: record.action || "",
    entity_type: record.entity_type || "",
    entity_id: record.entity_id || "",
    before_json: typeof record.before_json === "string"
      ? record.before_json
      : record.before_json ? JSON.stringify(record.before_json) : "",
    after_json: typeof record.after_json === "string"
      ? record.after_json
      : record.after_json ? JSON.stringify(record.after_json) : "",
    diff_json: typeof record.diff_json === "string"
      ? record.diff_json
      : record.diff_json ? JSON.stringify(record.diff_json) : "",
    created: record.created || "",
  };
}

/**
 * Audit-Logs einer Moschee laden (paginiert, filterbar).
 */
export async function getAuditLogs(
  mosqueId: string,
  filters?: AuditLogFilters
): Promise<AuditLogResult> {
  try {
    const pb = await getAdminPB();
    const page = filters?.page || 1;

    let filter = `mosque_id = "${mosqueId}"`;
    if (filters?.entityType === "madrasa") {
      // Meta-Filter: alle Madrasa-bezogenen Einträge
      filter += ` && (entity_type = "course" || entity_type = "student" || entity_type = "attendance" || entity_type = "course_enrollment" || entity_type = "academic_year")`;
    } else if (filters?.entityType === "settings") {
      // Meta-Filter: Einstellungen (mosques + settings)
      filter += ` && (entity_type = "settings" || entity_type = "mosques")`;
    } else if (filters?.entityType) {
      filter += ` && entity_type = "${filters.entityType}"`;
    }

    const records = await pb.collection("audit_logs").getList(page, PAGE_SIZE, {
      filter,
      sort: "-created",
    });

    const logs = records.items.map(mapRecordToAuditLog);

    // Batch-Fetch: Actor-Namen auflösen
    const actorNames: Record<string, string> = {};
    const uniqueActorIds: string[] = [];
    logs.forEach((log) => {
      if (log.actor_user_id && !uniqueActorIds.includes(log.actor_user_id)) {
        uniqueActorIds.push(log.actor_user_id);
      }
    });

    if (uniqueActorIds.length > 0) {
      try {
        const orFilter = uniqueActorIds.map((id) => `id = "${id}"`).join(" || ");
        const users = await pb.collection("users").getFullList({
          filter: orFilter,
          fields: "id,full_name",
        });
        users.forEach((u) => {
          actorNames[u.id] = u.full_name || "Unbekannt";
        });
      } catch {
        // Fallback: Namen konnten nicht geladen werden
      }
    }

    return {
      success: true,
      data: logs,
      actorNames,
      totalPages: records.totalPages,
      page: records.page,
    };
  } catch (error) {
    console.error("[Audit] Fehler beim Laden:", error);
    return { success: false, error: "Audit-Logs konnten nicht geladen werden" };
  }
}
