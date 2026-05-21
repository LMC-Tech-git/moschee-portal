/**
 * Finance — Lock Policy (Plan §13.1, Schritt 3).
 *
 * Eine reine Funktion, drei Schreibklassen.
 *
 * Phase 1 (Plan §13.5):
 *  - Nur **Hard-Lock**, nur **Manual-Ebene**.
 *  - Events (SYSTEM_EVENT_WRITE) sind IMMER schreibbar — verspätetes Stripe-
 *    Clearing/Bankimport/Drift-Sweeper-Backfill dürfen nie an einem Lock
 *    scheitern (Plan-Prinzip 10: Recovery-Symmetrie).
 *  - Soft-Lock + lock_scope (all/external_only) = Phase 2.
 *
 * Genau ein Aufruf unmittelbar vor dem Write (Single-Node-Backend; kein
 * Pre/Re-Check — wäre Overengineering ohne Multi-Instance-Writer; Lock-Drift-
 * Sweeper im Backfill fängt den Race-Edge-Case).
 */

export type WriteScope =
  | "SYSTEM_EVENT_WRITE" // immer erlaubt (Events sind die Wahrheit)
  | "MANUAL_WRITE"       // lock-aware (createManualTransaction/Storno)
  | "BACKFILL_WRITE";    // Admin-Override, auditiert via ledger_acceptance_context

/**
 * @param dateISO   Datum des Vorgangs (ISO 8601). Bei MANUAL_WRITE die
 *                  Buchungsperiode; bei SYSTEM_EVENT_WRITE = occurred_at.
 * @param hardLockUntil  `settings.finance_hard_lock_until` (ISO date oder null).
 *                       Sperrt manuelle Schreibvorgänge mit dateISO ≤ hardLockUntil.
 * @param writeScope  Schreibklasse — bestimmt ob Lock greift.
 * @returns `true` wenn Schreibvorgang erlaubt.
 */
export function canWrite(
  dateISO: string,
  hardLockUntil: string | null | undefined,
  writeScope: WriteScope
): boolean {
  // SYSTEM_EVENT_WRITE: immer erlaubt (Recovery-Symmetrie)
  if (writeScope === "SYSTEM_EVENT_WRITE") return true;
  // BACKFILL_WRITE: Admin-Override (auditiert via ledger_acceptance_context)
  if (writeScope === "BACKFILL_WRITE") return true;

  // MANUAL_WRITE: Lock greift
  if (!hardLockUntil) return true;
  // String-Vergleich auf ISO-Datum funktioniert lexikographisch korrekt
  // (YYYY-MM-DD bzw. YYYY-MM-DDTHH:MM:SSZ). Datum ≤ Lock → blockiert.
  return dateISO > hardLockUntil;
}
