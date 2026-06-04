/**
 * Finance-Permissions — sync Helper (Sprint 6).
 *
 * KEIN "use server" — `hasFinancePermission` ist synchron und muss aus
 * Client-Components + Tests importierbar sein. Server-Guards (async) leben in
 * `lib/finance-permissions.ts`.
 */

export type FinancePermission =
  | "finance_view"
  | "finance_create"
  | "finance_storno"
  | "finance_export"
  | "finance_settings"
  | "finance_ai_use"
  | "finance_audit_view";

/**
 * Phase 1: alle 7 Permissions → admin, super_admin, treasurer.
 * `treasurer` existiert bereits im users.role-Enum (types/index.ts).
 * Sprint 7: granulare Zuweisung per Moschee-Konfiguration.
 */
const FINANCE_PERM_ROLES = new Set(["admin", "super_admin", "treasurer"]);

export function hasFinancePermission(role: string, _perm: FinancePermission): boolean {
  return FINANCE_PERM_ROLES.has(role);
}
