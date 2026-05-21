"use server";

import { createHash, randomUUID } from "node:crypto";
import { getFinancePB } from "@/lib/finance-pb";
import { isUniqueViolation } from "@/lib/finance-pb-errors";

/**
 * Finance Event Emission — Sprint 1.
 *
 * Einziger Schreibpfad für `finance_source_events`. Aufrufer (Sprint 2+):
 *  - Stripe-Webhook-Route
 *  - Status→paid-Hook in donations.ts/student-fees.ts/sponsors.ts
 *  - Drift-Sweeper / Backfill
 *
 * Idempotenz: UNIQUE-Index auf `source_event_key`. Bei Doppel-Emission
 * (Webhook-Retry, Doppelklick, paralleler paid-Hook + Webhook für dieselbe
 * Zahlung) wirft PB einen Unique-Fehler → wir liefern `{duplicated: true}`
 * statt zu werfen. Kein anderes Caller-Verhalten nötig.
 *
 * `source_event_key` ist **event-type-abhängig** (siehe Plan §1):
 *  - `income_received`: SHA256(mosque|coll|id|"income_received") — OHNE
 *    external_event_id, weil zwei Emit-Pfade existieren (Webhook MIT, paid-Hook
 *    OHNE). Mit external_event_id im Key → zwei Events für eine Zahlung.
 *  - `income_refunded`/`chargeback`: SHA256(mosque|coll|id|event_type|external_event_id).
 *    Partial-Refunds teilen source_id+event_type; nur external_event_id
 *    differenziert sie. Single-Path (nur Webhook) → kein Doppel-Pfad-Problem.
 *  - Fallback ohne external_event_id (manueller provider-loser Refund):
 *    SHA256(mosque|coll|id|event_type|refund_amount_cents|YYYY-MM-DD).
 *
 * `classification` wird **hier** einmalig aus `event_type` abgeleitet
 * (`toClassification`) und persistiert. Downstream-Code liest die Spalte,
 * leitet sie nie neu ab.
 *
 * Phase-1-Guardrails: `event_type` strikt auf received/refunded/chargeback
 * beschränkt; `event_hash_sha256` bleibt ungesetzt (Phase-2).
 */

export type EmitInput = {
  mosqueId: string;
  eventType: "income_received" | "income_refunded" | "chargeback";
  sourceCollection: "donations" | "student_fees" | "sponsors";
  sourceType: string; // "donation" | "fee" | "sponsor" — Plan §1 erweiterbar
  sourceId: string;
  betragCents: number;
  kategorie: string; // FINANCE_CATEGORIES-ID
  kontoTyp: "bank" | "cash" | "other";
  zahlungskanal?: "bar" | "ueberweisung" | "stripe" | "paypal" | "sonstige";
  currency: string; // "EUR" Phase 1, aber Event speichert immer echte Währung
  occurredAt: string; // ISO date
  /** Stripe event/refund/dispute id — Trace + idempotenz-relevant nur bei refund/chargeback */
  externalEventId?: string;
  /** Bei refund/chargeback: Original-Event */
  relatedEventId?: string;
  relationType?: "refund_of" | "chargeback_of" | "adjustment_of";
  /** Bei refund/chargeback: betrag_cents des Parents (Sum-Guard) */
  originalAmountCents?: number;
  /** Lock-Audit-Kontext, default pre_lock */
  ledgerAcceptanceContext?: "pre_lock" | "post_lock_system" | "post_lock_manual_blocked";
  /** Eingefrorener Payload-Snapshot (Zod-strict, ohne Zeitfelder/PII).
   *  Schema: source_status, amount_cents, category, provider, payment_method, currency */
  payload: Record<string, unknown>;
  /** Optionale Provider-Metadaten/Debug — wird NICHT aggregiert */
  metadata?: Record<string, unknown>;
};

export type EmitResult =
  | { duplicated: false; eventUuid: string; sourceEventKey: string }
  | { duplicated: true };

const PHASE1_EVENT_TYPES = ["income_received", "income_refunded", "chargeback"] as const;
type Phase1EventType = (typeof PHASE1_EVENT_TYPES)[number];

const REPORTING_FIELDS = [
  "betrag_cents",
  "occurred_at",
  "category",
  "payment_method",
  "currency",
  "kategorie",
  "classification",
];

function toClassification(eventType: Phase1EventType): "income" | "expense" {
  switch (eventType) {
    case "income_received":
      return "income";
    case "income_refunded":
    case "chargeback":
      return "expense";
  }
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function dayBucket(iso: string): string {
  // Tagesbucket YYYY-MM-DD ohne Locale (UTC-stabile Substring-Operation).
  return String(iso).slice(0, 10);
}

function buildSourceEventKey(input: EmitInput): string {
  const { mosqueId, sourceCollection, sourceId, eventType, externalEventId } = input;
  if (eventType === "income_received") {
    // ohne external_event_id (Dual-Path-Schutz)
    return sha256(`${mosqueId}|${sourceCollection}|${sourceId}|income_received`);
  }
  // income_refunded | chargeback
  if (externalEventId) {
    return sha256(
      `${mosqueId}|${sourceCollection}|${sourceId}|${eventType}|${externalEventId}`
    );
  }
  // Fallback: manueller provider-loser Refund — schwächer, aber deterministisch
  const amount = String(input.betragCents ?? 0);
  return sha256(
    `${mosqueId}|${sourceCollection}|${sourceId}|${eventType}|${amount}|${dayBucket(input.occurredAt)}`
  );
}

function assertPhase1EventType(t: string): asserts t is Phase1EventType {
  if (!(PHASE1_EVENT_TYPES as readonly string[]).includes(t)) {
    throw new Error(`emitFinanceEvent: Phase-1 event_type "${t}" nicht erlaubt`);
  }
}

function assertNoReportingFields(meta: Record<string, unknown> | undefined) {
  if (!meta) return;
  for (const key of REPORTING_FIELDS) {
    if (key in meta) {
      throw new Error(
        `metadata_json darf Reporting-Feld "${key}" nicht enthalten (gehört in payload_json)`
      );
    }
  }
}

function assertEventIntegrity(input: EmitInput, classification: "income" | "expense") {
  if (input.eventType === "income_refunded" || input.eventType === "chargeback") {
    if (classification !== "expense") {
      throw new Error("assertEventIntegrity: refund/chargeback ⇒ classification MUSS expense");
    }
    if (
      typeof input.originalAmountCents === "number" &&
      input.betragCents > input.originalAmountCents
    ) {
      throw new Error(
        "assertEventIntegrity: betrag_cents > original_amount_cents (Best-Effort Sum-Guard)"
      );
    }
  }
  if (input.betragCents < 1) {
    throw new Error("assertEventIntegrity: betrag_cents min 1");
  }
}

export async function emitFinanceEvent(input: EmitInput): Promise<EmitResult> {
  assertPhase1EventType(input.eventType);
  assertNoReportingFields(input.metadata);
  const classification = toClassification(input.eventType);
  assertEventIntegrity(input, classification);

  const eventUuid = randomUUID();
  const sourceEventKey = buildSourceEventKey(input);

  const fp = await getFinancePB(input.mosqueId);

  const record = {
    mosque_id: input.mosqueId,
    event_uuid: eventUuid,
    external_event_id: input.externalEventId ?? "",
    source_event_key: sourceEventKey,
    related_event_id: input.relatedEventId ?? "",
    relation_type: input.relationType ?? "",
    original_amount_cents: input.originalAmountCents ?? null,
    ledger_acceptance_context: input.ledgerAcceptanceContext ?? "pre_lock",
    // event_hash_sha256 = Phase 2 (bewusst leer)
    event_type: input.eventType,
    classification,
    source_collection: input.sourceCollection,
    source_type: input.sourceType,
    source_id: input.sourceId,
    betrag_cents: input.betragCents,
    kategorie: input.kategorie,
    konto_typ: input.kontoTyp,
    zahlungskanal: input.zahlungskanal ?? "",
    currency: input.currency,
    occurred_at: input.occurredAt,
    payload_schema_version: 1,
    payload_json: JSON.stringify(input.payload),
    metadata_json: input.metadata ? JSON.stringify(input.metadata) : "",
  };

  try {
    await fp.collection("finance_source_events").create(record);
    return { duplicated: false, eventUuid, sourceEventKey };
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Idempotent: Event existiert bereits, kein Fehler nach außen
      return { duplicated: true };
    }
    throw err;
  }
}
