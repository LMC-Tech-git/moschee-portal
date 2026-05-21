/**
 * Finance — Projection-Layer (Plan §13.1, Schritt 2).
 *
 * Pure Funktionen. Keine Seiteneffekte. Keine DB-Zugriffe.
 *
 * - `toSignedAmount(classification, betrag)` — Vorzeichenquelle aus persistiertem
 *   `classification`. UI/Reports hängen ausschließlich an `signed_amount_cents`,
 *   nie an `event_type`/`typ` (Plan-Prinzip 4).
 *
 * - `toLedgerAtom(event)` — normalisiert `FinanceSourceEvent` zu `LedgerAtom`.
 *   Sprint 2: NUR Event-Signatur (M9). `Transaction`-Overload kommt in Sprint 3.
 *   Liest persistiertes `classification` aus DB; leitet NICHT neu ab.
 *
 * - `assertEventIntegrity(event)` — Pflicht-Invariante (Plan §13.1):
 *   - event_type=income_received ⇒ classification MUSS income
 *   - event_type=income_refunded|chargeback ⇒ classification MUSS expense
 *   - betrag_cents > 0
 *   - betrag_cents ≤ original_amount_cents falls refund (Best-Effort Phase 1)
 *
 *   Wirft bei Invariante-Bruch. Schützt gegen inkonsistente Records aus
 *   Backfill/Direkt-Integration. Einzige Stelle die `event_type` lesen darf.
 */

import type {
  FinanceSourceEvent,
  LedgerAtom,
  FinanceClassification,
  Zahlungskanal,
  Transaction,
} from "@/types";

export function toSignedAmount(
  classification: FinanceClassification,
  betrag_cents: number
): number {
  return classification === "income" ? betrag_cents : -betrag_cents;
}

/**
 * Wirft `FinanceEventIntegrityError` bei Verletzung. Sonst no-op.
 * Sprint-2-DoD: 3 Korruptions-Cases müssen failen.
 */
export class FinanceEventIntegrityError extends Error {
  constructor(message: string, public event: Pick<FinanceSourceEvent, "id" | "event_uuid" | "event_type" | "classification">) {
    super(message);
    this.name = "FinanceEventIntegrityError";
  }
}

export function assertEventIntegrity(event: FinanceSourceEvent): void {
  // Betrag muss positiv sein (Plan-Prinzip 4: `betrag_cents` immer positiv,
  // Vorzeichen kommt aus classification)
  if (!Number.isFinite(event.betrag_cents) || event.betrag_cents <= 0) {
    throw new FinanceEventIntegrityError(
      `betrag_cents must be > 0 (got ${event.betrag_cents})`,
      event
    );
  }

  // event_type ↔ classification Konsistenz
  if (event.event_type === "income_received") {
    if (event.classification !== "income") {
      throw new FinanceEventIntegrityError(
        `event_type=income_received requires classification=income (got ${event.classification})`,
        event
      );
    }
  } else if (event.event_type === "income_refunded" || event.event_type === "chargeback") {
    if (event.classification !== "expense") {
      throw new FinanceEventIntegrityError(
        `event_type=${event.event_type} requires classification=expense (got ${event.classification})`,
        event
      );
    }
  }
  // income_adjusted/fee_applied: in Phase-1-Engine nicht erlaubt; Schema-Check
  // findet die in Domain-Service (assertPhase). Hier kein Throw, damit der
  // Projection-Layer Phase-2-Events nicht versehentlich blockt.

  // Refund-Sum-Guard Best-Effort (Race möglich bei parallelen Partial-Refunds)
  if (
    (event.event_type === "income_refunded" || event.event_type === "chargeback") &&
    event.original_amount_cents != null &&
    event.original_amount_cents > 0 &&
    event.betrag_cents > event.original_amount_cents
  ) {
    throw new FinanceEventIntegrityError(
      `refund betrag_cents=${event.betrag_cents} exceeds original_amount_cents=${event.original_amount_cents}`,
      event
    );
  }
}

/**
 * Wirft `FinanceTransactionIntegrityError` bei Verletzung. Sonst no-op.
 * Sprint-3-Pendant zu `assertEventIntegrity` für manuelle Buchungen.
 */
export class FinanceTransactionIntegrityError extends Error {
  constructor(
    message: string,
    public tx: Pick<Transaction, "id" | "beleg_nummer" | "typ" | "classification">
  ) {
    super(message);
    this.name = "FinanceTransactionIntegrityError";
  }
}

/**
 * Invariante für manuelle Buchungen:
 *  - betrag_cents > 0 (Vorzeichen kommt aus classification)
 *  - typ=einnahme ⇒ classification=income
 *  - typ=ausgabe  ⇒ classification=expense
 *
 * Gilt auch für Storno-Gegenbuchungen: ein Storno einer Einnahme ist eine
 * Ausgabe (typ=ausgabe, classification=expense) → konsistent, kein Sondercode.
 */
export function assertTransactionIntegrity(tx: Transaction): void {
  if (!Number.isFinite(tx.betrag_cents) || tx.betrag_cents <= 0) {
    throw new FinanceTransactionIntegrityError(
      `betrag_cents must be > 0 (got ${tx.betrag_cents})`,
      tx
    );
  }
  if (tx.typ === "einnahme" && tx.classification !== "income") {
    throw new FinanceTransactionIntegrityError(
      `typ=einnahme requires classification=income (got ${tx.classification})`,
      tx
    );
  }
  if (tx.typ === "ausgabe" && tx.classification !== "expense") {
    throw new FinanceTransactionIntegrityError(
      `typ=ausgabe requires classification=expense (got ${tx.classification})`,
      tx
    );
  }
}

/**
 * Normalisiert `finance_source_events` ODER `transactions` zu `LedgerAtom`.
 *
 * Type-Guard: nur `Transaction` hat `buchungsdatum`. Beide Pfade lesen das
 * persistierte `classification` (leiten es NIE neu ab) und berechnen
 * `signed_amount_cents` über `toSignedAmount`.
 *
 * Storno-Netting ist **emergent**: die Storno-Row hat invertiertes
 * `classification` bei gleicher `kategorie` → die Summe der signed_amounts in
 * der Original-Kategorie nettet automatisch, kein Phantom-Eintrag.
 *
 * Wirft (via `assertEventIntegrity`/`assertTransactionIntegrity`) bei
 * Invarianz-Bruch — schützt gegen inkonsistente LedgerAtoms.
 */
export function toLedgerAtom(event: FinanceSourceEvent): LedgerAtom;
export function toLedgerAtom(tx: Transaction): LedgerAtom;
export function toLedgerAtom(input: FinanceSourceEvent | Transaction): LedgerAtom {
  if ("buchungsdatum" in input) {
    return transactionToLedgerAtom(input);
  }
  return eventToLedgerAtom(input);
}

function eventToLedgerAtom(event: FinanceSourceEvent): LedgerAtom {
  assertEventIntegrity(event);

  // zahlungskanal kann in alter DB leer sein → defaulten auf "sonstige" damit
  // LedgerAtom-Reinheit (immer Enum, kein "") gewahrt bleibt.
  const zk: Zahlungskanal =
    event.zahlungskanal && event.zahlungskanal.length > 0
      ? event.zahlungskanal
      : "sonstige";

  return {
    id: event.event_uuid,
    mosque_id: event.mosque_id,
    datum: event.occurred_at,
    betrag_cents: event.betrag_cents,
    signed_amount_cents: toSignedAmount(event.classification, event.betrag_cents),
    kategorie: event.kategorie,
    konto_typ: event.konto_typ,
    zahlungskanal: zk,
    classification: event.classification,
    source_system: "external_event",
    source_origin: {
      source_collection: event.source_collection,
      source_id: event.source_id,
      event_uuid: event.event_uuid,
    },
    beleg_nummer: "",
    readonly: true,
  };
}

function transactionToLedgerAtom(tx: Transaction): LedgerAtom {
  assertTransactionIntegrity(tx);

  const zk: Zahlungskanal =
    tx.zahlungskanal && tx.zahlungskanal.length > 0 ? tx.zahlungskanal : "sonstige";

  return {
    id: tx.id,
    mosque_id: tx.mosque_id,
    datum: tx.buchungsdatum,
    betrag_cents: tx.betrag_cents,
    signed_amount_cents: toSignedAmount(tx.classification, tx.betrag_cents),
    kategorie: tx.kategorie,
    konto_typ: tx.konto_typ,
    zahlungskanal: zk,
    classification: tx.classification,
    source_system: "manual_transaction",
    source_origin: undefined,
    beleg_nummer: tx.beleg_nummer,
    readonly: false,
  };
}

/**
 * Bestimmt `classification` aus `event_type` — EINZIGE Schreibstelle (Plan §1).
 * Wird vom Domain-Layer beim Emit aufgerufen, nirgendwo sonst.
 */
export function toClassification(eventType: string): FinanceClassification {
  if (eventType === "income_received") return "income";
  if (eventType === "income_refunded" || eventType === "chargeback") return "expense";
  // income_adjusted/fee_applied = Phase 2; sollte vom Domain-Layer-Guard
  // bereits abgelehnt sein, bevor wir hier landen.
  throw new Error(`toClassification: event_type "${eventType}" not allowed in Phase 1`);
}
