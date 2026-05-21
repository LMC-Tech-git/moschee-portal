# Finanzbuchhaltungs-Modul — Gesamtplan & Handover

> **Zweck dieses Dokuments:** Vollständige Übergabe für neue Sessions. Enthält
> (1) den fertigen Stand (Sprint 1 + 2), (2) Architektur-Prinzipien, (3) Sprint-
> Übersicht, (4) den detaillierten Sprint-3-Plan. Voller Originalplan:
> `C:\Users\halim\.claude\plans\implementiere-ein-finanzbuchhaltungs-mod-ancient-sky.md`

**Projekt-Root:** `C:\Users\halim\Documents\cami-portal\moschee-portal`
**Stack:** Next.js 14 (App Router), TypeScript, PocketBase <0.23 (Hetzner), Stripe
**Node lokal:** `"C:\Program Files\nodejs\node.exe"` (voller Pfad nötig)
**TS-Skripte ausführen:** `npx tsx <datei.mts>`
**Login/Secrets:** `.env.local` (PB_ADMIN_EMAIL/PASSWORD, POCKETBASE_URL, NEXT_PUBLIC_DEMO_MOSQUE_ID)
**PB-URL:** `http://91.98.142.128:8090` — Demo-Moschee: `79719aqj2zsik4f`

---

## 0. Architektur in einem Absatz

Das Finanzmodul ist die **revisionssichere Finanzakte** einer Moschee. Kern:
**zwei gleichrangige immutable Fact-Streams** — `finance_source_events`
(externe/systemische Events aus donations/student_fees/sponsors) und
`transactions` (manuelle Buchungen). Reports/EÜR/Kassenbuch lesen **nie live**
aus den Fach-Collections, sondern aus diesen Streams, normalisiert über **eine**
Funktion `toLedgerAtom()` zur gemeinsamen Struktur `LedgerAtom`. Append-only,
immutable, Korrektur nur per Storno/Refund/kompensierender Buchung. Phase 1
bewusst minimal (kein KPI-Cache, kein atomares Inkrement, kein Event-Hash).

### Verbindliche Prinzipien (gelten in JEDEM Sprint)
1. **Zwei immutable Journals**, additive Union, kein read-time-live aus Fach-Collections.
2. **Immutable**: Events + `transactions` nach Erstellung unveränderlich (Ausnahme `interne_notiz`). Serverseitig erzwungen.
3. **Append-only**: keine Hard-Deletes, kein Datei-Replace. Korrektur via Storno/Refund/kompensierende Buchung.
4. **Vorzeichen**: `betrag_cents` immer positiv; persistiertes `classification` (income/expense) bestimmt Vorzeichen; `signed_amount_cents` wird in `toLedgerAtom` berechnet, nie gespeichert.
5. **Determinismus**: stabile Zeitpunkte (`occurred_at`/`buchungsdatum`, nie `created`). Standard-Sort: `datum ASC, beleg_nummer ASC, event_uuid/id ASC`.
6. **Multi-Tenant**: jede Query serverseitig strikt `mosque_id`-scoped via `getFinancePB(mosqueId)`.
7. **Idempotenz**: UNIQUE-Index auf `source_event_key` (event-type-abhängige Formel, siehe §1-Modell).
8. **Auditability + Non-Blocking**: jede Aktion via `safeAudit` (Audit-Fehler dürfen Domain-Op nie töten).
9. **Ehrliche Garantien**: altes PocketBase = keine Multi-Doc-Tx, kein atomares Inkrement. Garantie = was UNIQUE-Index + Append-only real leisten.
10. **Recovery-Symmetrie**: Drift-Sweeper + Recon decken received UND refund/chargeback.
11. **Korrektur nach Lock**: (a) Refund-Pfad, (b) kompensierende manuelle Buchung, (c) Storno (nur `transactions`, nie Events). Event-Storno = Phase 2.

### Goldene Regeln für Code (nicht brechen)
- **`"use server"`-Dateien** dürfen NUR async Funktionen exportieren. Konstanten/
  Klassen/Typen → in nicht-server-Modul (z.B. `lib/donations-finance-helpers.ts`).
- `event_type`/`typ` NIE in Filter/Aggregation/EÜR — nur persistiertes `classification`.
- `toLedgerAtom`/`toSignedAmount`/`toClassification` = EINZIGE Stellen die `event_type` lesen.
- Roher `getAdminPB()` in `lib/finance-*` verboten → immer `getFinancePB(mosqueId)`.
- Migration `scripts/migrate-v1.mjs` ist idempotent — immer erst `--dry-run`.

---

## 1. ✅ ERLEDIGT — Sprint 1 (Storage-Layer)

**Commits:** `e405d98`, `3bd8447`

### PocketBase-Collections (existieren produktiv)
- **`finance_source_events`** (append-only Event-Log = Finanz-Wahrheit), 23 Felder, 5 Indizes:
  - `mosque_id`, `event_uuid`, `external_event_id` (Trace; bei refund idempotenz-relevant),
    `source_event_key` (UNIQUE), `related_event_id`/`relation_type`, `original_amount_cents`,
    `ledger_acceptance_context`, `event_hash_sha256` (Phase-1 leer), `event_type`,
    `classification`, `source_collection`/`source_type`/`source_id`, `betrag_cents`,
    `kategorie`, `konto_typ`, `zahlungskanal`, `currency`, `occurred_at`,
    `payload_schema_version`, `payload_json`, `metadata_json`
  - **`source_event_key`-Formel (eingefroren):**
    - `income_received`: `SHA256(mosque_id|source_collection|source_id|"income_received")` — OHNE external_event_id (Dual-Path-Schutz: Webhook + paid-Hook ergeben sonst 2 Events)
    - `income_refunded`/`chargeback`: `SHA256(mosque_id|source_collection|source_id|event_type|external_event_id)` — Partial-Refunds unterscheidbar
    - Fallback ohne external id: `SHA256(...|event_type|refund_amount_cents|YYYY-MM-DD)`
- **`transactions`** (manuelle Buchungen, leer bis Sprint 3), 19 Felder, 4 Indizes (inkl. UNIQUE `(mosque_id, beleg_nummer)`)
- **`finance_sequences`** (Belegnummer-Hint-Counter, leer bis Sprint 3)
- **Quell-Felder:** `donations`/`student_fees`/`sponsors` → `is_financially_locked`, `financial_locked_at`; `donations` zusätzlich `refund_amount_cents`/`refunded_at`/`refund_reason`/`refund_provider_ref`

### Code
- `lib/finance-pb.ts` — `getFinancePB(mosqueId)` umhüllt `getAdminPB()` (autoCancellation=false + alte-PB-Auth), Tenant-Filter, Collection-Whitelist
- `lib/actions/finance-events.ts` — `emitFinanceEvent()`, EINZIGER Event-Schreibpfad, UNIQUE-Idempotenz → `{duplicated:true}`, `assertNoReportingFields` für metadata, Phase-1-event_type-Guard
- `scripts/test-webhook-idempotency.mjs` — Idempotenz-Beweis
- `scripts/backfill-finance-events.mjs` — Drift-Sweeper (in Sprint 2 erweitert)

---

## 2. ✅ ERLEDIGT — Sprint 2 (Projection + Donation→Event Write-Path)

**Commit:** `b654305`

### Neu
- `lib/finance-to-ledger-atom.ts` — `toSignedAmount`, `toLedgerAtom(event)` (M9: nur Event-Signatur, Transaction kommt Sprint 3), `assertEventIntegrity`, `toClassification`, `FinanceEventIntegrityError`
- `lib/finance-lock-policy.ts` — `canWrite(date, hardLockUntil, writeScope)` mit `SYSTEM_EVENT_WRITE`/`MANUAL_WRITE`/`BACKFILL_WRITE`. Phase 1: nur Hard-Lock, nur Manual-Ebene; Events immer schreibbar
- `lib/actions/finance-domain.ts` — **einziger Orchestrator**: `createIncome()` scharf (Pipeline: Zod-payload → M5-Guard donations-only → canWrite → getFinancePB → emit → Lock-Retry 200/400/800ms (R1) → safeAudit). `refundIncome`/`createManualTransaction` = `throw NOT_YET_IMPLEMENTED`
- `lib/donations-finance-helpers.ts` — `assertDonationEditAllowed` (F4 Lock-Allowlist: nur `interne_notiz`/`tag`), `donationToKontoChannel`, `DonationLockedError` (NON-server, damit testbar + Build-konform)
- `scripts/recon-source-vs-events.mjs` — Σ(paid donations) vs Σ(income_received events), `--mosque <id>`/`--all`, Exit≠0 bei Δ≠0
- `scripts/replay-events-to-ledger.mjs` — Events→Atoms Dry-Run-Verifikation
- `scripts/test-finance-unit.mts` — echte Module via tsx (canWrite 5, integrity 3, F4, R4-mapping, toLedgerAtom)
- `scripts/test-createincome-flow.mts` — Integration gegen Demo (flow/webhook/R1/idempotenz + finally-Cleanup)

### Geändert
- `scripts/migrate-v1.mjs` — `audit_logs.context_json` (F5); `classification`-Spalte denormalisiert in beiden Finance-Tabellen (DB-Aggregat-Queries für EÜR)
- `types/index.ts` — `LedgerAtom`, `FinanceSourceEvent`, `Transaction`, `FinanceSequence`, `FinanceEventPayloadV1`, `Zahlungskanal`, `KontoTyp`, `FinanceClassification`, `FinanceRelationType`
- `lib/constants.ts` — `FINANCE_CATEGORIES` (15 IDs) + `*_INCOME_IDS`/`*_EXPENSE_IDS` + `mapDonationToEUR()` (R4: zakat/sadaqa/schuldenabbau/moschee_bau/projekte → SPENDEN; null → SONSTIGE_EINNAHMEN)
- `lib/validations.ts` — `financeEventPayloadSchema.strict()` (R3: nur source_status/category/provider/payment_method; kein amount/currency/Zeit-Leak)
- `lib/audit.ts` — `context_json`-Feld + `safeAudit`-Export (F7 non-throwing)
- `lib/actions/donations.ts` — `markDonationPaidAndEmit()` Helper + Lock-Guard in `updateDonationStatus` + Emit in `createManualDonation`
- `lib/stripe/finalize.ts` + `app/api/stripe/webhook/route.ts` — Donation-paid-Branch ruft `markDonationPaidAndEmit(ctx:webhook)` (F2)
- `scripts/backfill-finance-events.mjs` — Lock-Drift-Branch + `--dry-run` + F6-Fallback (paid_at=null → now()) + R2 (sperrt historische paid-Records) + R3-konformes payload
- `messages/de.json` + `messages/tr.json` — `audit.action.finance.*` + `entity.finance_event`/`transaction` (K10)

### Verifiziert (alle grün gegen Produktiv/Demo-PB)
Migration idempotent; Sprint-1-Idempotenz (10×→1, 2 Partial-Refunds→2, Retry→+0);
Unit (canWrite/integrity/F4/R4); Integration (manuell+Webhook→1 Event+Lock, 2×→duplicated,
R1-Recovery, R3-payload); Recon Δ=0 (34=34); Replay 34/34; Sweeper kein Drift; Build 60/60.

### Effekt für Nutzer
Jede bezahlte Spende (manuell ODER Stripe) erzeugt automatisch ein unveränderliches
Finanz-Event; bezahlte Spenden sind gesperrt. **Noch keine sichtbare Finanz-UI** —
erste UI kommt Sprint 4a.

---

## 3. Sprint-Übersicht (Roadmap)

| Sprint | Inhalt | Status |
|--------|--------|--------|
| **1** | Storage-Layer (Collections, emitFinanceEvent, Idempotenz, Sweeper-Grundgerüst) | ✅ fertig |
| **2** | Projection (LedgerAtom) + createIncome (Donation→Event), beide paid-Pfade, Lock-Recovery | ✅ fertig |
| **3** | **createManualTransaction + Storno + Belegnummer-Sequencer + toLedgerAtom(Transaction)** | ➡️ nächstes |
| **4a** | Ledger-Merge (Events + manuelle) + read-only Tabelle/Card-UI + EÜR + Jahresbericht | offen |
| **4b** | Kassenbericht mit Jahres-Carryover (Endbestand N−1 = Anfang N), Mehrjahr-Fixture-Test | offen |
| **5** | refundIncome + Stripe-Refund-Webhook + student_fees/sponsors-Hooks; Refund-Sweeper/Recon scharf | offen |
| **6** | XLSX-Steuerberater-Export → KI-Kategorisierung → Permissions → Demo-Seed → Datenschutz | offen |

**Phase 2/3 (später, nicht Phase 1):** Kontenplan, doppelte Buchführung, DATEV/SKR,
Period-Closing, versionierter Export, Multi-Beleg, Canonical-Hash/Drift-Check, KPI-Cache,
atomares Sequenz-Inkrement, Event-Storno, materialized Ledger, Async-Queue.

---

## 4. ➡️ Sprint 3 — Detailplan: Manuelle Buchungen + Storno + Sequencer

**Ziel:** Admin kann manuelle Einnahmen/Ausgaben erfassen (Bar/Bank), mit
fortlaufender Belegnummer und Beleg-Upload. Buchungen sind immutable; Korrektur
nur via Storno (Gegenbuchung). `transactions`-Stream wird in `toLedgerAtom`
integriert. **Keine UI in Sprint 3** (read-only Anzeige + Erfassungs-UI = Sprint 4a) —
Sprint 3 liefert Server-Actions + Sequencer + Tests. (UI optional vorziehbar, aber
Plan trennt sauber.)

### 4.1 Build-Reihenfolge

**1. `lib/finance-sequence.ts` — Belegnummer-Sequencer (`reserveBelegNummer`)**
- Signatur: `reserveBelegNummer(pb: FinancePB, mosqueId, year): Promise<string>` → Format `JJJJ-NNNN`
- **Primärmechanismus = optimistic insert + UNIQUE-Index-Retry** (PB <0.23 hat KEIN atomares Inkrement):
  1. `finance_sequences` für (mosque_id, year) lesen → `next_number` als **Hint** (falls Zeile fehlt: idempotent anlegen mit next_number=1)
  2. Nummer `JJJJ-NNNN` bilden
  3. **Caller** versucht `transactions.create()` mit der Nummer; bei Unique-Verletzung auf `(mosque_id, beleg_nummer)`: Nummer+1, neu versuchen, **max 6 Versuche**, kurzes Backoff, Monotonie-Schutz (nie kleinere Nummer)
  4. Nach erfolgreichem Insert `next_number` best-effort hochschreiben (nur Hint, Verlust unkritisch)
- **Garantie ehrlich:** "monoton steigend & kollisionsfrei", NICHT "garantiert lückenlos" (Crash zwischen Reservierung und Insert ⇒ seltene Lücke; bei Vereinsbuchhaltung unkritisch).
- Atomares Inkrement / `version`-CAS = Phase 2.

**2. `lib/validations.ts` — `transactionSchema` + `stornoSchema` + `transactionNoteSchema`** (Zod v4 `.issues`)
- `transactionSchema`: `buchungsdatum` (required), `leistungsdatum` (optional), `betrag_cents` (int min 1), `typ` (`einnahme`|`ausgabe`), `kategorie` (enum aus FINANCE_CATEGORIES-IDs), `beschreibung` (min 3 max 500), `konto_typ` (`bank`|`cash`|`other`), `zahlungskanal` (enum optional), `beleg_datei_sha256` (optional)
- `stornoSchema`: `transaction_id` (required), `grund` (optional)
- `transactionNoteSchema`: nur `interne_notiz` (max 500) — einzige erlaubte Update-Felder

**3. `lib/finance-to-ledger-atom.ts` — Transaction-Overload (M9)**
- Zweite Signatur `toLedgerAtom(tx: Transaction): LedgerAtom` (oder Union + Type-Guard):
  - `id = tx.id`, `datum = tx.buchungsdatum`, `source_system = "manual_transaction"`,
    `readonly = false`, `beleg_nummer = tx.beleg_nummer`, `source_origin = undefined`,
    `signed_amount_cents = toSignedAmount(tx.classification, tx.betrag_cents)`
- Storno-Atom: `classification` invertiert (Plan §5 Storno-Netting-Regel: behält Original-`kategorie`, kein Phantom-Eintrag)
- `assertTransactionIntegrity(tx)`: `betrag_cents>0`, `typ`↔`classification` konsistent (einnahme=income, ausgabe=expense)

**4. `lib/actions/finance-domain.ts` — `createManualTransaction()` scharf**
- Pipeline:
  1. Zod `transactionSchema`
  2. Permission-Check (Sprint 6 verfeinert; Phase 1 admin)
  3. **`canWrite(buchungsdatum, hardLockUntil, "MANUAL_WRITE")`** — bei false: `throw "finance_period_locked"` (Hard-Lock greift hier wirklich, anders als bei Events)
  4. `classification = typ === "einnahme" ? "income" : "expense"` (denormalisiert persistieren)
  5. **Beleg-Datei validieren** (falls vorhanden): MIME-Whitelist `application/pdf`/`image/jpeg`/`image/png`, maxSize 5 MB, SHA-256 berechnen → `beleg_datei_sha256`
  6. `reserveBelegNummer` + `transactions.create()` mit UNIQUE-Retry (Schritt 1)
  7. `safeAudit({action:"transaction.create", entityType:"transaction", entityId})`
  8. `quelle="manuell"`, `is_storno=false`
- Demo-Limit-Check (`checkDemoLimit` aus `lib/demo.ts`, neuer Key `transactions`)

**5. `lib/actions/finance-domain.ts` — `stornoTransaction()` scharf**
- Input: `transaction_id`, `grund?`
- Lädt Original (Tenant-Check), prüft `is_storno=false` (kein Storno eines Stornos in Phase 1) + nicht bereits storniert
- **`canWrite(heute, hardLockUntil, "MANUAL_WRITE")`** für das Storno-Datum
- Erzeugt Gegenbuchung: **eigene neue Belegnummer**, `typ` invertiert (einnahme↔ausgabe), `classification` invertiert, gleiche `kategorie`/`betrag_cents`, `quelle="storno"`, `is_storno=true`, `storno_of=<original.id>`, `referenz_id=<original.id>`, `beschreibung="Storno: <original>"`
- Original bleibt unverändert (immutable)
- `safeAudit({action:"transaction.storno", entityType:"transaction", entityId, context:{storno_of}})`

**6. `lib/actions/finance.ts` (neu) — `updateTransactionNote()`**
- EINZIGE Update-Action. Feld-Allowlist: nur `interne_notiz`. Jedes andere Feld → `throw "transaction immutable"`. Kein generisches `updateTransaction`.

**7. `lib/actions/finance.ts` — `getTransactionsLedger()` Vorbereitung (read, Basis für Sprint 4a)**
- Sprint 3 minimal: `getManualTransactions(mosqueId, {year})` → `transactions` lesen, via `toLedgerAtom` mappen. Voller Merge (Events + manuelle) = Sprint 4a.

**8. Demo + i18n + Migration-Check**
- `lib/demo.ts`: `DEMO_LIMITS.transactions` (z.B. 100) + `checkDemoLimit` in createManualTransaction
- `scripts/seed-demo-full.mjs`: ~10 manuelle Demo-Buchungen (gemischt Einnahme/Ausgabe, Bar/Bank) + `finance_sequences`-Init
- `messages/de.json`+`tr.json`: `audit.action.transaction.create`/`storno` (entity `transaction` schon vorhanden aus Sprint 2); Fehlermeldungen `finance_period_locked`/`transaction_immutable`
- Migration: Felder existieren schon (Sprint 1) — nur prüfen

### 4.2 Test-Skripte (DEMO-Guard + finally-Cleanup, echte Module via tsx)
- `scripts/test-manual-transaction.mts`:
  - createManualTransaction → 1 Row, classification korrekt, beleg_nummer Format `JJJJ-NNNN`
  - 2 parallele Inserts (Promise.all) → 2 **verschiedene** Belegnummern, keine Kollision (UNIQUE-Retry)
  - Belegnummern monoton steigend
  - updateTransactionNote: interne_notiz änderbar; betrag → `throw transaction immutable`
- `scripts/test-storno.mts`:
  - Storno einer Einnahme → Gegenbuchung mit neuer Belegnummer, typ=ausgabe, classification=expense, storno_of gesetzt; Original unverändert
  - EÜR-Netting: Storno nettet in Original-`kategorie` (Σ Kategorie sinkt), kein Phantom-Ausgabe-Eintrag in fremdem Topf
  - Doppel-Storno → abgelehnt
- `scripts/test-sequence.mts`:
  - reserveBelegNummer: Format, Jahr-Wechsel (neuer Counter pro Jahr), Monotonie
  - Hard-Lock: createManualTransaction mit buchungsdatum ≤ finance_hard_lock_until → `throw finance_period_locked`
- Ergänze `test-finance-unit.mts`: `toLedgerAtom(Transaction)` + `assertTransactionIntegrity`

### 4.3 Definition of Done (messbar)
- [ ] createManualTransaction → Row in `transactions` mit korrekter classification + Belegnummer
- [ ] 2 parallele Inserts → keine doppelte Belegnummer (UNIQUE-Retry beweisbar)
- [ ] Belegnummern monoton steigend, Format `JJJJ-NNNN`, Jahr-Counter getrennt
- [ ] Storno → Gegenbuchung neue Nummer, Original immutable, classification invertiert
- [ ] EÜR-Netting korrekt (Storno in Original-Kategorie, kein Phantom)
- [ ] updateTransactionNote: nur interne_notiz; alles andere → throw
- [ ] Hard-Lock greift für MANUAL_WRITE (buchungsdatum ≤ lock → abgelehnt)
- [ ] Beleg-Upload: MIME-Whitelist + SHA-256
- [ ] Demo-Limit-Check greift
- [ ] toLedgerAtom(Transaction) + getManualTransactions liefern valide Atoms
- [ ] Audit-Labels DE+TR (transaction.create/storno)
- [ ] `npm run build` grün
- [ ] Recon weiterhin Δ=0 (manuelle Buchungen verändern Event↔Source-Recon nicht)

### 4.4 Risiken Sprint 3
1. **Belegnummer-Race** unter Parallelität: UNIQUE-Index ist die Garantie, nicht der Counter. Test mit Promise.all Pflicht.
2. **Hard-Lock-Settings-Lookup**: `finance_hard_lock_until` aus settings lesen — Helper `getFinanceLockSettings(mosqueId)` bauen, in createManualTransaction + stornoTransaction nutzen.
3. **Beleg-Datei in PB**: File-Upload via FormData gegen PB; SHA-256 serverseitig vor Upload. Immutable nach Create (kein Replace-Pfad bauen).
4. **`"use server"`-Falle**: Sequence-Helper + Validations nicht versehentlich aus server-Datei als Konstante exportieren.

---

## 5. Wie neue Session starten

1. Dieses Dokument + Originalplan (`.claude/plans/...ancient-sky.md`) als Kontext geben.
2. Tests laufen lassen zur Verifikation des Ist-Stands (siehe unten).
3. Sprint 3 gemäß §4 umsetzen, Reihenfolge einhalten.
4. Nach Fertigstellung: `git add` (betroffene Dateien) → commit → push.

### Verifikations-Befehle (Ist-Stand prüfen)
```bash
cd moschee-portal
DEMO=79719aqj2zsik4f
"C:\Program Files\nodejs\node.exe" scripts/migrate-v1.mjs --dry-run
"C:\Program Files\nodejs\node.exe" scripts/test-webhook-idempotency.mjs $DEMO
npx tsx scripts/test-finance-unit.mts
npx tsx scripts/test-createincome-flow.mts $DEMO
"C:\Program Files\nodejs\node.exe" scripts/recon-source-vs-events.mjs --all
"C:\Program Files\nodejs\node.exe" scripts/replay-events-to-ledger.mjs
"C:\Program Files\nodejs\node.exe" scripts/backfill-finance-events.mjs --dry-run
"C:\Program Files\nodejs\node.exe" node_modules/next/dist/bin/next build
```
Erwartung: alle ✅, Recon Δ=0, Replay 34/34, Build 60/60.
