"use server";

import { createHash } from "node:crypto";
import { emitFinanceEvent } from "@/lib/actions/finance-events";
import { getFinancePB } from "@/lib/finance-pb";
import { canWrite } from "@/lib/finance-lock-policy";
import { safeAudit } from "@/lib/audit";
import { checkDemoLimit } from "@/lib/demo";
import {
  financeEventPayloadSchema,
  transactionSchema,
  stornoSchema,
  type FinanceEventPayloadInput,
} from "@/lib/validations";
import {
  insertTransactionWithBelegNummer,
  type BelegFile,
} from "@/lib/finance-sequence";
import type { FinanceCategoryId } from "@/lib/constants";
import type { KontoTyp, Zahlungskanal, Transaction, FinanceClassification } from "@/types";

const BELEG_ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"];
const BELEG_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Jahr aus ISO-Datum (`YYYY-...`) — Belegnummer-Counter ist jahresgebunden. */
function yearOf(dateISO: string): number {
  const y = Number(String(dateISO).slice(0, 4));
  if (!Number.isFinite(y) || y < 2000) {
    throw new Error(`createManualTransaction: ungültiges Jahr aus "${dateISO}"`);
  }
  return y;
}

/**
 * Liest `settings.finance_hard_lock_until` für die Moschee (Lese-Helper für
 * MANUAL_WRITE-Lock). settings ist in der Finance-Whitelist. Fehlt der Record
 * oder das Feld → null (kein Lock).
 */
async function getFinanceLockSettings(mosqueId: string): Promise<string | null> {
  const fp = await getFinancePB(mosqueId);
  try {
    const row = await fp.collection("settings").getFirstListItem(fp.tenantFilter());
    const v = (row as { finance_hard_lock_until?: string }).finance_hard_lock_until;
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

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

// ===========================================================================
// Sprint 3 — Manuelle Buchungen (transactions) + Storno
// ===========================================================================

export type CreateManualTransactionInput = {
  mosqueId: string;
  userId?: string;
  buchungsdatum: string; // ISO date
  leistungsdatum?: string;
  betragCents: number;
  typ: "einnahme" | "ausgabe";
  kategorie: FinanceCategoryId | string;
  beschreibung: string;
  kontoTyp: KontoTyp;
  zahlungskanal?: Zahlungskanal;
  interneNotiz?: string;
  /** Optionaler Beleg (PDF/JPEG/PNG, ≤5 MB). SHA-256 wird serverseitig berechnet. */
  belegFile?: File;
};

export type ManualTransactionResult = { id: string; beleg_nummer: string };

/**
 * createManualTransaction — Sprint 3 scharf.
 *
 * Pipeline (Plan §4.1 Schritt 5):
 *  1. transactionSchema validieren (snake_case-Input aus camelCase gebaut)
 *  2. Permission Phase-1 = admin (Sprint 6 verfeinert; strukturell present)
 *  3. Hard-Lock: canWrite(buchungsdatum, …, "MANUAL_WRITE") false → throw
 *  4. classification denormalisiert aus typ
 *  5. Demo-Limit-Check
 *  6. Beleg validieren (MIME/Size/SHA-256) falls vorhanden
 *  7. insertTransactionWithBelegNummer (UNIQUE-Retry-Belegnummer)
 *  8. safeAudit transaction.create
 */
export async function createManualTransaction(
  input: CreateManualTransactionInput
): Promise<ManualTransactionResult> {
  // 1. Zod (Server baut snake_case-Input)
  const parsed = transactionSchema.safeParse({
    buchungsdatum: input.buchungsdatum,
    leistungsdatum: input.leistungsdatum ?? "",
    betrag_cents: input.betragCents,
    typ: input.typ,
    kategorie: input.kategorie,
    beschreibung: input.beschreibung,
    konto_typ: input.kontoTyp,
    zahlungskanal: input.zahlungskanal,
    interne_notiz: input.interneNotiz,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}:${i.message}`).join("; ");
    throw new Error(`createManualTransaction: Validierung fehlgeschlagen — ${issues}`);
  }
  const data = parsed.data;

  // 2. Permission Phase-1 = admin (Sprint 6 verfeinert). Strukturell present —
  //    der Aufrufer (Server-Action/Route) hat bereits Admin-Auth erzwungen.

  // 3. Hard-Lock (MANUAL_WRITE greift wirklich — anders als bei Events)
  const hardLockUntil = await getFinanceLockSettings(input.mosqueId);
  if (!canWrite(data.buchungsdatum, hardLockUntil, "MANUAL_WRITE")) {
    throw new Error("finance_period_locked");
  }

  // 4. classification denormalisiert persistieren
  const classification: FinanceClassification = data.typ === "einnahme" ? "income" : "expense";

  // 5. Demo-Limit
  const demo = await checkDemoLimit(input.mosqueId, "transactions");
  if (!demo.allowed) {
    throw new Error(demo.error || "demo_limit_reached");
  }

  // 6. Beleg validieren (falls vorhanden)
  let belegFile: BelegFile | undefined;
  let belegSha256 = "";
  if (input.belegFile) {
    const f = input.belegFile;
    if (!BELEG_ALLOWED_MIME.includes(f.type)) {
      throw new Error("beleg_invalid_type");
    }
    if (f.size > BELEG_MAX_BYTES) {
      throw new Error("beleg_too_large");
    }
    const buf = Buffer.from(await f.arrayBuffer());
    belegSha256 = createHash("sha256").update(buf).digest("hex");
    belegFile = { blob: new Blob([buf], { type: f.type }), filename: f.name };
  }

  // 7. baseRecord + UNIQUE-Retry-Insert
  const fp = await getFinancePB(input.mosqueId);
  const baseRecord: Record<string, unknown> = {
    mosque_id: input.mosqueId,
    buchungsdatum: data.buchungsdatum,
    leistungsdatum: data.leistungsdatum || "",
    betrag_cents: data.betrag_cents,
    typ: data.typ,
    classification,
    kategorie: data.kategorie,
    beschreibung: data.beschreibung,
    beleg_datei_sha256: belegSha256,
    konto_typ: data.konto_typ,
    zahlungskanal: data.zahlungskanal ?? "",
    quelle: "manuell",
    referenz_id: "",
    storno_of: "",
    is_storno: false,
    interne_notiz: data.interne_notiz ?? "",
    created_by: input.userId ?? "",
  };

  const created = await insertTransactionWithBelegNummer<Transaction>(
    fp,
    input.mosqueId,
    yearOf(data.buchungsdatum),
    baseRecord,
    belegFile
  );

  // 8. Audit (non-blocking)
  await safeAudit({
    mosqueId: input.mosqueId,
    userId: input.userId,
    action: "transaction.create",
    entityType: "transaction",
    entityId: created.id,
    context: {
      kategorie: data.kategorie,
      betrag_cents: data.betrag_cents,
      typ: data.typ,
      beleg_nummer: created.beleg_nummer,
    },
  });

  return { id: created.id, beleg_nummer: created.beleg_nummer };
}

export type StornoTransactionInput = {
  mosqueId: string;
  userId?: string;
  transactionId: string;
  grund?: string;
};

/**
 * stornoTransaction — Sprint 3 scharf.
 *
 * Erzeugt eine Gegenbuchung (eigene neue Belegnummer) mit invertiertem
 * typ/classification bei gleicher kategorie/betrag → nettet emergent in der
 * Original-Kategorie. Original bleibt unverändert (immutable). Kein Hard-Delete.
 */
export async function stornoTransaction(
  input: StornoTransactionInput
): Promise<ManualTransactionResult> {
  // 1. Zod
  const parsed = stornoSchema.safeParse({
    transaction_id: input.transactionId,
    grund: input.grund,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}:${i.message}`).join("; ");
    throw new Error(`stornoTransaction: Validierung fehlgeschlagen — ${issues}`);
  }
  const { grund } = parsed.data;

  const fp = await getFinancePB(input.mosqueId);

  // 2. Original laden + Tenant-Check
  const original = (await fp.collection("transactions").getOne(input.transactionId)) as Transaction;
  if (original.mosque_id !== input.mosqueId) {
    throw new Error("transaction_not_found");
  }

  // 3. Kein Storno eines Stornos (Phase 1)
  if (original.is_storno === true) {
    throw new Error("cannot_storno_a_storno");
  }

  // 4. Bereits storniert?
  const existing = await fp.collection("transactions").getList(1, 1, {
    filter: fp.tenantFilter(`storno_of = "${original.id}"`),
    fields: "id",
  });
  if (existing.totalItems > 0) {
    throw new Error("already_storniert");
  }

  // 5. Storno-Datum (V-A): Gegenbuchung bucht in die Original-Periode, wenn diese
  //    nicht hard-locked ist — sonst läge das Storno im laufenden Jahr und Per-Jahr-
  //    EÜR/Jahresbericht/Kassenbericht des Original-Jahres wären überzeichnet.
  //    Ist die Original-Periode gesperrt: heute buchen (nur wenn heute offen).
  const heute = new Date().toISOString().slice(0, 10);
  const hardLockUntil = await getFinanceLockSettings(input.mosqueId);
  let stornoDatum: string;
  let samePeriod: boolean;
  if (canWrite(original.buchungsdatum, hardLockUntil, "MANUAL_WRITE")) {
    stornoDatum = original.buchungsdatum;
    samePeriod = true;
  } else {
    stornoDatum = heute;
    samePeriod = false;
    if (!canWrite(heute, hardLockUntil, "MANUAL_WRITE")) {
      throw new Error("finance_period_locked");
    }
  }

  // 6. Gegenbuchung: typ + classification invertiert, gleiche kategorie/betrag
  const invTyp: "einnahme" | "ausgabe" = original.typ === "einnahme" ? "ausgabe" : "einnahme";
  const invClass: FinanceClassification = original.classification === "income" ? "expense" : "income";
  const beschreibung = `Storno: ${original.beschreibung}`.slice(0, 500);

  const baseRecord: Record<string, unknown> = {
    mosque_id: input.mosqueId,
    buchungsdatum: stornoDatum,
    leistungsdatum: "",
    betrag_cents: original.betrag_cents,
    typ: invTyp,
    classification: invClass,
    kategorie: original.kategorie,
    beschreibung,
    beleg_datei_sha256: "",
    konto_typ: original.konto_typ,
    zahlungskanal: original.zahlungskanal || "",
    quelle: "storno",
    referenz_id: original.id,
    storno_of: original.id,
    is_storno: true,
    interne_notiz: grund ? grund.slice(0, 500) : "",
    created_by: input.userId ?? "",
  };

  const created = await insertTransactionWithBelegNummer<Transaction>(
    fp,
    input.mosqueId,
    yearOf(stornoDatum),
    baseRecord
  );

  // 7. Audit
  await safeAudit({
    mosqueId: input.mosqueId,
    userId: input.userId,
    action: "transaction.storno",
    entityType: "transaction",
    entityId: created.id,
    context: {
      storno_of: original.id,
      grund: grund ?? "",
      betrag_cents: original.betrag_cents,
      beleg_nummer: created.beleg_nummer,
      storno_buchungsdatum: stornoDatum,
      same_period: samePeriod,
    },
  });

  return { id: created.id, beleg_nummer: created.beleg_nummer };
}
