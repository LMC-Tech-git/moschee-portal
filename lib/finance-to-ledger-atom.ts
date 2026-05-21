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
 * Normalisiert ein `finance_source_events`-Record zu `LedgerAtom`.
 * Sprint 2: nur Event-Signatur. Sprint 3 fügt Transaction-Overload hinzu.
 *
 * Wirft (via `assertEventIntegrity`) bei Invarianz-Bruch — schützt gegen
 * inkonsistente LedgerAtoms aus Backfill/Direkt-Integration.
 */
export function toLedgerAtom(event: FinanceSourceEvent): LedgerAtom {
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
