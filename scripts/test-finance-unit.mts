/**
 * Finance Unit-Tests — ECHTE TS-Module (kein Spiegel), via `npx tsx`.
 *
 * Deckt (Plan §13.3 DoD):
 *  - canWrite 5 Cases (M8)
 *  - assertEventIntegrity 3 Korruptions-Cases (test-corrupt-event)
 *  - toSignedAmount + toLedgerAtom valid
 *  - mapDonationToEUR (R4)
 *  - assertDonationEditAllowed Lock-Guard (F4)
 *
 * Keine DB. Pure-Logik. Importiert echte Module — Drift TS↔Test unmöglich.
 *
 * Lauf:  npx tsx scripts/test-finance-unit.mts
 * Exit:  0 = alle grün, 1 = Fehler
 */

import { canWrite } from "@/lib/finance-lock-policy";
import {
  toSignedAmount,
  toLedgerAtom,
  assertEventIntegrity,
  FinanceEventIntegrityError,
  assertTransactionIntegrity,
  FinanceTransactionIntegrityError,
  toClassification,
} from "@/lib/finance-to-ledger-atom";
import { mapDonationToEUR, FINANCE_CATEGORIES } from "@/lib/constants";
import { formatBelegNummer } from "@/lib/finance-sequence";
import { assertDonationEditAllowed, DonationLockedError } from "@/lib/donations-finance-helpers";
import { feeToKontoChannel } from "@/lib/fees-finance-helpers";
import { sponsorToKontoChannel } from "@/lib/sponsors-finance-helpers";
import type { FinanceSourceEvent, Transaction } from "@/types";

let failures = 0;
function ok(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ✅ ${label}`);
  } else {
    console.error(`  ❌ ${label}`);
    failures++;
  }
}
function throws(fn: () => void, label: string, errType?: Function) {
  try {
    fn();
    console.error(`  ❌ ${label} (kein Throw)`);
    failures++;
  } catch (e) {
    if (errType && !(e instanceof errType)) {
      console.error(`  ❌ ${label} (falscher Error-Typ: ${(e as Error).name})`);
      failures++;
    } else {
      console.log(`  ✅ ${label}`);
    }
  }
}

function baseEvent(over: Partial<FinanceSourceEvent> = {}): FinanceSourceEvent {
  return {
    id: "x",
    mosque_id: "m1",
    event_uuid: "u1",
    external_event_id: "",
    source_event_key: "k1",
    related_event_id: "",
    relation_type: "",
    original_amount_cents: null,
    ledger_acceptance_context: "pre_lock",
    event_hash_sha256: "",
    event_type: "income_received",
    classification: "income",
    source_collection: "donations",
    source_type: "donation",
    source_id: "d1",
    betrag_cents: 1000,
    kategorie: "spenden",
    konto_typ: "bank",
    zahlungskanal: "stripe",
    currency: "EUR",
    occurred_at: "2026-05-20",
    payload_schema_version: 1,
    payload_json: "{}",
    metadata_json: "",
    created: "2026-05-20",
    ...over,
  };
}

console.log("=== Finance Unit-Tests (echte Module via tsx) ===\n");

console.log("canWrite (M8):");
ok(canWrite("2026-05-20", null, "MANUAL_WRITE") === true, "no-lock + MANUAL → true");
ok(canWrite("2026-05-20", null, "SYSTEM_EVENT_WRITE") === true, "no-lock + SYSTEM → true");
ok(canWrite("2026-01-01", "2026-12-31", "MANUAL_WRITE") === false, "date<lock + MANUAL → false");
ok(canWrite("2026-01-01", "2026-12-31", "SYSTEM_EVENT_WRITE") === true, "date<lock + SYSTEM → true");
ok(canWrite("2026-01-01", "2026-12-31", "BACKFILL_WRITE") === true, "date<lock + BACKFILL → true");
ok(canWrite("2027-06-01", "2026-12-31", "MANUAL_WRITE") === true, "date>lock + MANUAL → true");

console.log("\ntoSignedAmount:");
ok(toSignedAmount("income", 1000) === 1000, "income → +");
ok(toSignedAmount("expense", 1000) === -1000, "expense → -");

console.log("\ntoClassification:");
ok(toClassification("income_received") === "income", "received → income");
ok(toClassification("income_refunded") === "expense", "refunded → expense");
ok(toClassification("chargeback") === "expense", "chargeback → expense");
throws(() => toClassification("income_adjusted"), "income_adjusted → throw (Phase 2)");

console.log("\ntoLedgerAtom (valid):");
const atom = toLedgerAtom(baseEvent());
ok(atom.signed_amount_cents === 1000, "signed = +1000");
ok(atom.source_system === "external_event", "source_system=external_event");
ok(atom.readonly === true, "readonly=true");
ok(atom.beleg_nummer === "", "beleg_nummer leer");
ok(atom.zahlungskanal === "stripe", "zahlungskanal Enum durchgereicht");
const atomEmptyKanal = toLedgerAtom(baseEvent({ zahlungskanal: "" as never }));
ok(atomEmptyKanal.zahlungskanal === "sonstige", "leerer zahlungskanal → 'sonstige'");

console.log("\nassertEventIntegrity (3 Korruptions-Cases):");
throws(
  () => assertEventIntegrity(baseEvent({ event_type: "income_refunded", classification: "income" })),
  "refunded + classification=income → throw",
  FinanceEventIntegrityError
);
throws(
  () => assertEventIntegrity(baseEvent({ betrag_cents: 0 })),
  "betrag_cents=0 → throw",
  FinanceEventIntegrityError
);
throws(
  () =>
    assertEventIntegrity(
      baseEvent({
        event_type: "income_refunded",
        classification: "expense",
        betrag_cents: 5000,
        original_amount_cents: 1000,
      })
    ),
  "refund betrag > original → throw",
  FinanceEventIntegrityError
);
// valid refund passes
ok(
  (() => {
    try {
      assertEventIntegrity(
        baseEvent({ event_type: "income_refunded", classification: "expense", betrag_cents: 500, original_amount_cents: 1000 })
      );
      return true;
    } catch {
      return false;
    }
  })(),
  "valid partial refund → kein Throw"
);

console.log("\nmapDonationToEUR (R4):");
ok(mapDonationToEUR("zakat") === FINANCE_CATEGORIES.SPENDEN, "zakat → spenden");
ok(mapDonationToEUR("sadaqa") === FINANCE_CATEGORIES.SPENDEN, "sadaqa → spenden");
ok(mapDonationToEUR("moschee_bau") === FINANCE_CATEGORIES.SPENDEN, "moschee_bau → spenden");
ok(mapDonationToEUR("projekte") === FINANCE_CATEGORIES.SPENDEN, "projekte → spenden");
ok(mapDonationToEUR("schuldenabbau") === FINANCE_CATEGORIES.SPENDEN, "schuldenabbau → spenden");
ok(mapDonationToEUR(null) === FINANCE_CATEGORIES.SONSTIGE_EINNAHMEN, "null → sonstige_einnahmen");
ok(mapDonationToEUR("unbekannt") === FINANCE_CATEGORIES.SONSTIGE_EINNAHMEN, "unbekannt → sonstige_einnahmen");

console.log("\nassertDonationEditAllowed (F4):");
ok(
  (() => {
    try {
      assertDonationEditAllowed({ is_financially_locked: false }, { amount_cents: 99 });
      return true;
    } catch {
      return false;
    }
  })(),
  "unlocked → jede Änderung erlaubt"
);
throws(
  () => assertDonationEditAllowed({ is_financially_locked: true }, { amount_cents: 99 }),
  "locked + betrag → throw",
  DonationLockedError
);
throws(
  () => assertDonationEditAllowed({ is_financially_locked: true }, { status: "cancelled" }),
  "locked + status → throw",
  DonationLockedError
);
ok(
  (() => {
    try {
      assertDonationEditAllowed({ is_financially_locked: true }, { interne_notiz: "ok" });
      return true;
    } catch {
      return false;
    }
  })(),
  "locked + interne_notiz → erlaubt"
);

function baseTx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: "t1",
    mosque_id: "m1",
    buchungsdatum: "2026-05-20",
    leistungsdatum: "",
    betrag_cents: 5000,
    typ: "einnahme",
    classification: "income",
    kategorie: "spenden",
    beschreibung: "Test",
    beleg_nummer: "2026-0001",
    beleg_datei: "",
    beleg_datei_sha256: "",
    konto_typ: "cash",
    zahlungskanal: "bar",
    quelle: "manuell",
    referenz_id: "",
    storno_of: "",
    is_storno: false,
    interne_notiz: "",
    created_by: "",
    created: "2026-05-20",
    updated: "2026-05-20",
    ...over,
  };
}

console.log("\nformatBelegNummer (Sprint 3):");
ok(formatBelegNummer(2026, 1) === "2026-0001", "1 → 2026-0001");
ok(formatBelegNummer(2026, 12345) === "2026-12345", ">9999 wächst");

console.log("\ntoLedgerAtom(Transaction) (M9):");
const txAtom = toLedgerAtom(baseTx());
ok(txAtom.signed_amount_cents === 5000, "einnahme signed = +5000");
ok(txAtom.source_system === "manual_transaction", "source_system=manual_transaction");
ok(txAtom.readonly === false, "readonly=false");
ok(txAtom.beleg_nummer === "2026-0001", "beleg_nummer durchgereicht");
ok(txAtom.source_origin === undefined, "source_origin undefined");
ok(txAtom.datum === "2026-05-20", "datum=buchungsdatum");
const txExpenseAtom = toLedgerAtom(baseTx({ typ: "ausgabe", classification: "expense" }));
ok(txExpenseAtom.signed_amount_cents === -5000, "ausgabe signed = -5000");
const txEmptyKanal = toLedgerAtom(baseTx({ zahlungskanal: "" }));
ok(txEmptyKanal.zahlungskanal === "sonstige", "leerer zahlungskanal → 'sonstige'");

console.log("\nStorno-Atom signed negativ (Netting):");
const stornoAtom = toLedgerAtom(
  baseTx({ typ: "ausgabe", classification: "expense", is_storno: true, storno_of: "t1", beleg_nummer: "2026-0002" })
);
ok(stornoAtom.signed_amount_cents === -5000, "Storno einer +5000-Einnahme → -5000 (Σ=0)");

console.log("\nassertTransactionIntegrity:");
throws(
  () => assertTransactionIntegrity(baseTx({ betrag_cents: 0 })),
  "betrag_cents=0 → throw",
  FinanceTransactionIntegrityError
);
throws(
  () => assertTransactionIntegrity(baseTx({ typ: "einnahme", classification: "expense" })),
  "einnahme + classification=expense → throw",
  FinanceTransactionIntegrityError
);
throws(
  () => assertTransactionIntegrity(baseTx({ typ: "ausgabe", classification: "income" })),
  "ausgabe + classification=income → throw",
  FinanceTransactionIntegrityError
);
ok(
  (() => {
    try {
      assertTransactionIntegrity(baseTx({ typ: "ausgabe", classification: "expense" }));
      return true;
    } catch {
      return false;
    }
  })(),
  "valide Ausgabe → kein Throw"
);

// ─── feeToKontoChannel ──────────────────────────────────────────────────────

console.log("\n--- feeToKontoChannel ---");
const feeTests: [string | null | undefined, string, string][] = [
  ["cash",     "cash",  "bar"],
  ["transfer", "bank",  "ueberweisung"],
  ["stripe",   "bank",  "stripe"],
  [null,       "bank",  "sonstige"],
  [undefined,  "bank",  "sonstige"],
];
feeTests.forEach(([method, expKonto, expKanal]) => {
  const { kontoTyp, zahlungskanal } = feeToKontoChannel(method);
  ok(kontoTyp === expKonto && zahlungskanal === expKanal,
    `feeToKontoChannel(${method}): konto=${kontoTyp}/${expKonto} kanal=${zahlungskanal}/${expKanal}`);
});

// ─── sponsorToKontoChannel ───────────────────────────────────────────────────

console.log("\n--- sponsorToKontoChannel ---");
const sponsorTests: [string | null | undefined, string, string][] = [
  ["cash",     "cash",  "bar"],
  ["transfer", "bank",  "ueberweisung"],
  ["stripe",   "bank",  "stripe"],
  [null,       "bank",  "sonstige"],
];
sponsorTests.forEach(([method, expKonto, expKanal]) => {
  const { kontoTyp, zahlungskanal } = sponsorToKontoChannel(method);
  ok(kontoTyp === expKonto && zahlungskanal === expKanal,
    `sponsorToKontoChannel(${method}): konto=${kontoTyp}/${expKonto} kanal=${zahlungskanal}/${expKanal}`);
});

console.log("");
if (failures > 0) {
  console.error(`❌ ${failures} Test(s) fehlgeschlagen.`);
  process.exit(1);
}
console.log("✅ Alle Unit-Tests grün.");
process.exit(0);
