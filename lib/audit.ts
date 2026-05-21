import { getAdminPB } from "./pocketbase-admin";

interface AuditLogParams {
  mosqueId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  /** Zustand VOR der Änderung (z.B. bei Updates) */
  before?: Record<string, unknown>;
  /** Zustand NACH der Änderung */
  after?: Record<string, unknown>;
  /** Ergänzende Details (für Aktionen ohne before/after, z.B. .created) */
  details?: Record<string, unknown>;
  /**
   * Strukturierter Kontext (Plan-F5): z.B.
   * `{ duplicated: true, backfill: true, retry_count: 2, webhook: true }`.
   * Persistiert in `audit_logs.context_json` (text/JSON, optional).
   * Bestehende Reader ignorieren das Feld.
   */
  context?: Record<string, unknown>;
}

/**
 * Schreibt einen Eintrag in die audit_logs Collection.
 * Fehlschläge werden nur geloggt, nie geworfen — Auditing soll nie
 * den Hauptprozess blockieren.
 *
 * Regeln:
 * - Nur zustandsverändernde Aktionen loggen (keine Reads)
 * - Keine sensitiven Daten (Passwörter, vollständige Zahlungsdaten)
 * - mosque_id für Tenant-Isolation immer setzen
 * - Nicht blockierend: Fehler werden nur geloggt
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    const pb = await getAdminPB();
    await pb.collection("audit_logs").create({
      mosque_id: params.mosqueId,
      actor_user_id: params.userId || "",
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      before_json: params.before ? JSON.stringify(params.before) : "",
      after_json: params.after ? JSON.stringify(params.after) : "",
      // diff_json: Legacy-Feld, nur noch für Details ohne before/after
      diff_json: params.details ? JSON.stringify(params.details) : "",
      // context_json: strukturierter Zusatzkontext (Plan-F5)
      context_json: params.context ? JSON.stringify(params.context) : "",
    });
  } catch (error) {
    console.error("[Audit] Fehler beim Schreiben:", error);
  }
}

/**
 * Alias für `logAudit` (Plan-F7-Wording): macht explizit, dass Audit-Failures
 * Domain-Operations niemals töten. `logAudit` ist bereits non-throwing
 * (try/catch + console.error intern); `safeAudit` ist der semantische Marker
 * für Stellen in Finance-Code wo der Garantie-Status explizit gemacht werden soll.
 */
export const safeAudit = logAudit;
