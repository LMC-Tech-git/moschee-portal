"use server";

import { emitFinanceEvent } from "@/lib/actions/finance-events";
import { getFinancePB } from "@/lib/finance-pb";
import { canWrite } from "@/lib/finance-lock-policy";
import { safeAudit } from "@/lib/audit";
import { financeEventPayloadSchema, type FinanceEventPayloadInput } from "@/lib/validations";
import type { FinanceCategoryId } from "@/lib/constants";
import type { KontoTyp, Zahlungskanal } from "@/types";

/**
 * Finance Domain Service — einziger Orchestrator (Plan §13.1, Schritt 4).
 *
 * Drei öffentliche Entry-Points:
 *  - `createIncome()` — Sprint 2 SCHARF (Donation→Event)
 *  - `refundIncome()` — Sprint 5 (Stub: NOT_YET_IMPLEMENTED)
 *  - `createManualTransaction()` — Sprint 3 (Stub: NOT_YET_IMPLEMENTED)
 *
 * Alles andere (Lock, Sequenz, Emit, Audit) ist intern. UI/Actions rufen
 * AUSSCHLIESSLICH diese drei. Lint-/Grep-Gate gegen direkten emit-Call in
 * Feature-Code (außer dieser Datei).
 */

const LOCK_RETRY_DELAYS_MS = [200, 400, 800];

type CreateIncomeInput = {
  mosqueId: string;
  sourceCollection: "donations" | "student_fees" | "sponsors";
  sourceType: "donation" | "fee" | "sponsor";
  sourceId: string;
  /** Stripe event-id o.ä. — bei `income_received` nur Trace (NICHT im Key) */
  externalEventId?: string;
  betragCents: number;
  kategorie: FinanceCategoryId | string;
  kontoTyp: KontoTyp;
  zahlungskanal: Zahlungskanal;
  /** ISO date (= paid_at) */
  occurredAt: string;
  /** Wird Zod-strict validiert vor Emit (R3) */
  payload: FinanceEventPayloadInput;
  /** Optional: Provider-Metadaten/Debug — NICHT für Reports */
  metadata?: Record<string, unknown>;
  /** Lock-Audit-Kontext, default pre_lock */
  ledgerAcceptanceContext?: "pre_lock" | "post_lock_system" | "post_lock_manual_blocked";
  /** Zusatz-Context für safeAudit (K12) — z.B. {backfill:true, webhook:true} */
  ctx?: { backfill?: boolean; webhook?: boolean };
};

type CreateIncomeResult = {
  eventUuid: string | null; // null bei duplicated
  duplicated: boolean;
  lockSet: boolean;         // false ⇒ Lock-Drift, Sweeper fängt nach
};

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Sperrt Quell-Record nach erfolgreichem Event-Emit (Belt-and-Suspenders).
 * 3 Retries mit Backoff. Bei finalem Fehler: safeAudit + Funktion returnt
 * `lockSet: false` (Event ist Wahrheit, Sweeper holt Lock periodisch nach).
 */
async function lockSourceWithRetry(
  pb: Awaited<ReturnType<typeof getFinancePB>>,
  sourceCollection: string,
  sourceId: string,
  mosqueId: string,
  eventUuid: string,
  ctx: CreateIncomeInput["ctx"]
): Promise<boolean> {
  const nowISO = new Date().toISOString();
  const update = {
    is_financially_locked: true,
    financial_locked_at: nowISO,
  };
  let lastErr: unknown = null;
  for (let i = 0; i < LOCK_RETRY_DELAYS_MS.length + 1; i++) {
    try {
      await pb.collection(sourceCollection).update(sourceId, update);
      return true;
    } catch (err) {
      lastErr = err;
      if (i < LOCK_RETRY_DELAYS_MS.length) {
        await sleep(LOCK_RETRY_DELAYS_MS[i]);
      }
    }
  }
  // Alle Retries erschöpft — Audit + nicht werfen (Event ist Wahrheit)
  await safeAudit({
    mosqueId,
    action: "finance.lock_failed",
    entityType: "finance_event",
    entityId: eventUuid,
    context: {
      source_collection: sourceCollection,
      source_id: sourceId,
      retry_count: LOCK_RETRY_DELAYS_MS.length,
      error: String((lastErr as Error)?.message || lastErr),
      backfill: ctx?.backfill,
      webhook: ctx?.webhook,
    },
  });
  return false;
}

/**
 * createIncome — Sprint 2 scharf (Donation→Event).
 *
 * Pipeline (Plan §13.1 Schritt 4):
 *  1. Zod-strict-Validation auf `payload` (R3)
 *  2. M5-Guard: nur sourceCollection="donations" Phase 2
 *  3. canWrite (SYSTEM_EVENT_WRITE → immer true, strukturell präsent)
 *  4. getFinancePB
 *  5. emitFinanceEvent (income_received)
 *  6. Quell-Sperre mit Retry (R1) — bei Final-Fehler: safeAudit, kein Throw
 *  7. safeAudit finance.event_emitted (K12 ctx)
 *
 * Idempotenz: Event-Emit ist via UNIQUE-Index sicher. Webhook-Retry +
 * Doppelklick + paralleler Manual-Mark-Paid → identischer Key → 1 Event.
 */
export async function createIncome(input: CreateIncomeInput): Promise<CreateIncomeResult> {
  // 1. payload Zod-strict
  const parsed = financeEventPayloadSchema.safeParse(input.payload);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}:${i.message}`).join("; ");
    throw new Error(`createIncome: payload Zod-Validation fehlgeschlagen — ${issues}`);
  }
  const cleanPayload = parsed.data;

  // 2. M5: Sprint 2 nur donations; student_fees/sponsors = Sprint 5
  if (input.sourceCollection !== "donations") {
    throw new Error(
      `createIncome: sourceCollection="${input.sourceCollection}" NOT_YET_IMPLEMENTED_SPRINT_5`
    );
  }

  // 3. canWrite SYSTEM_EVENT_WRITE (strukturell, immer true Phase 1)
  // hardLockUntil: hier null (events sind immer schreibbar). Settings-Lookup
  // wäre redundant, da SYSTEM_EVENT_WRITE den Lock ignoriert. canWrite-Aufruf
  // bleibt im Code für Architektur-Klarheit + zukünftige Phase-2-Hooks.
  const allowed = canWrite(input.occurredAt, null, "SYSTEM_EVENT_WRITE");
  if (!allowed) {
    // Kann in Phase 1 nie passieren; defensiver Catch-all.
    throw new Error("createIncome: canWrite verweigert (unerwartet in Phase 1)");
  }

  // 4. getFinancePB (umhüllt getAdminPB, Tenant-Scope)
  const pb = await getFinancePB(input.mosqueId);

  // 5. Emit zuerst (Append-only Wahrheit). Bei Fehler: throw nach außen;
  //    donations.status=paid ist bereits gesetzt (Sweeper fängt nach).
  const emitResult = await emitFinanceEvent({
    mosqueId: input.mosqueId,
    eventType: "income_received",
    sourceCollection: input.sourceCollection,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    betragCents: input.betragCents,
    kategorie: input.kategorie,
    kontoTyp: input.kontoTyp,
    zahlungskanal: input.zahlungskanal,
    currency: "EUR", // Phase 1 EUR-only
    occurredAt: input.occurredAt,
    externalEventId: input.externalEventId,
    ledgerAcceptanceContext: input.ledgerAcceptanceContext ?? "pre_lock",
    payload: cleanPayload,
    metadata: input.metadata,
  });

  let eventUuid: string | null = null;
  let lockSet = true;

  if (emitResult.duplicated) {
    // Event existiert bereits — kein Doppel-Lock-Versuch nötig.
    // Lock-Status der Quelle wird beim nächsten Sweeper-Lauf konsistiert.
    await safeAudit({
      mosqueId: input.mosqueId,
      action: "finance.event_emitted",
      entityType: "finance_event",
      entityId: input.sourceId, // kein neuer event_uuid → verwende sourceId als Anker
      context: {
        duplicated: true,
        source_collection: input.sourceCollection,
        source_id: input.sourceId,
        backfill: input.ctx?.backfill,
        webhook: input.ctx?.webhook,
      },
    });
    return { eventUuid: null, duplicated: true, lockSet: true };
  }

  eventUuid = emitResult.eventUuid;

  // 6. Quell-Sperre mit Retry (R1) — non-throwing
  lockSet = await lockSourceWithRetry(
    pb,
    input.sourceCollection,
    input.sourceId,
    input.mosqueId,
    eventUuid,
    input.ctx
  );

  // 7. safeAudit event_emitted (K12)
  await safeAudit({
    mosqueId: input.mosqueId,
    action: "finance.event_emitted",
    entityType: "finance_event",
    entityId: eventUuid,
    context: {
      duplicated: false,
      source_collection: input.sourceCollection,
      source_id: input.sourceId,
      lock_set: lockSet,
      backfill: input.ctx?.backfill,
      webhook: input.ctx?.webhook,
    },
  });

  return { eventUuid, duplicated: false, lockSet };
}

/** Sprint-5-Stub. */
export async function refundIncome(_input: unknown): Promise<never> {
  throw new Error("refundIncome: NOT_YET_IMPLEMENTED_SPRINT_5");
}

/** Sprint-3-Stub. */
export async function createManualTransaction(_input: unknown): Promise<never> {
  throw new Error("createManualTransaction: NOT_YET_IMPLEMENTED_SPRINT_3");
}
