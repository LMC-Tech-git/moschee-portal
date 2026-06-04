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
| **3** | createManualTransaction + Storno + Belegnummer-Sequencer + toLedgerAtom(Transaction) | ✅ fertig (`dee7cd2`) |
| **4a** | Ledger-Merge (Events + manuelle) + read-only Tabelle/Card-UI + EÜR + Jahresbericht | ✅ fertig |
| **4b** | Kassenbericht mit Jahres-Carryover (Endbestand N−1 = Anfang N), Mehrjahr-Fixture-Test | ✅ fertig |
| **5** | refundIncome + Stripe-Refund-Webhook + student_fees/sponsors-Hooks; Refund-Sweeper/Recon scharf | ✅ fertig |
| **6** | XLSX-Steuerberater-Export + KI-Kategorisierung (Anthropic, optional) + granulare Permissions + Beleg-Download-Härtung + Datenschutz §8 + Demo-Polish + fee/sponsor-Refund-Webhook-Backref | ✅ fertig |

**🎉 PHASE 1 ABGESCHLOSSEN** (Sprint 1–6). Event-basiertes Finanzmodul produktiv:
zwei immutable Streams, deterministischer Merge, EÜR/Kassenbericht/Jahresbericht,
Refund/Chargeback, XLSX-Export, optionale KI-Kategorisierung, granulare Permissions.

**Phase 2/3 (später):** Kontenplan + doppelte Buchführung (finance_accounts,
transaction_entries), DATEV/SKR, Period-Closing (finance_period_closures),
versionierter Export (finance_exports + SHA-256), Multi-Beleg (transaction_attachments),
Canonical-Hash event_hash_sha256 scharf + Drift-Check, Sum-Guard harte Race-Garantie,
atomares Sequenz-Inkrement / version-CAS, Soft-Lock + lock_scope, KPI-Read-Cache,
root_event_id/Graph-Relationen, event_type income_adjusted/fee_applied, Event-Storno,
sequence_audit_log, treasurer-Rolle granulare Permission-Zuweisung.

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

> **Sprint 3 IST-STAND (umgesetzt, Commit `dee7cd2`):** wie geplant + leicht erweitert.
> Neu: `lib/finance-pb-errors.ts` (`isUniqueViolation`/`isUniqueViolationOnField`, aus
> finance-events.ts extrahiert DRY), `lib/finance-sequence.ts` (`formatBelegNummer`,
> `getNextBelegHint`, `bumpBelegHint`, `insertTransactionWithBelegNummer` mit UNIQUE-Retry
> max 6 + FormData-pro-Versuch-neu), `lib/actions/finance.ts` (`updateTransactionNote`
> note-only, `getManualTransactions`). Geändert: `finance-domain.ts`
> (`createManualTransaction`+`stornoTransaction` scharf, `getFinanceLockSettings`),
> `finance-to-ledger-atom.ts` (Overload + `assertTransactionIntegrity`), `validations.ts`
> (3 Schemas), `constants.ts` (`FINANCE_CATEGORY_VALUES` Single-Source für Zod-Enum),
> `demo.ts` (`DEMO_LIMITS.transactions=100`), `migrate-v1.mjs` (`settings.finance_hard_lock_until`),
> `seed-demo-full.mjs` (10 Demo-Buchungen). Tests: test-manual-transaction/storno/sequence.mts.
> Storno-Netting **emergent** (invertiertes classification + gleiche kategorie). Keine UI.

---

## 4b. ➡️ Sprint 4 — Detailplan: Ledger-Merge + UI + EÜR + Kassenbericht

**Ziel:** Erste **sichtbare** Finanz-UI. Admin sieht Kassenbuch (Events + manuelle
Buchungen gemerged, read-only), erfasst manuelle Buchungen + Storno über UI, sieht
EÜR + Jahresbericht + Kassenbericht. Aufgeteilt in **4a** (Merge + UI + EÜR +
Jahresbericht) und **4b** (Kassenbericht mit Bestandsfortschreibung).

### ⚠️ Vorbedingung — Settings-Lücke schließen (Migration)
Kassenbericht braucht Anfangsbestände. Aktuell existiert in `settings` nur
`finance_hard_lock_until` + `public_finance_enabled`. **Fehlen** (in `migrate-v1.mjs`
idempotent ergänzen, Block bei „18b. settings: Finance-Felder"):
- `finance_enabled` bool (default false) — Modul-Toggle (admin-seitig; `public_finance_enabled` ist separat fürs öffentliche Portal)
- `kassenbuch_start_year` number — Initialjahr der Buchführung
- `kassenbuch_bar_start_cents` number (default 0) — Anfangsbestand Bar im Startjahr
- `kassenbuch_bank_start_cents` number (default 0) — Anfangsbestand Bank im Startjahr

### 4a — Build-Reihenfolge

**1. `lib/actions/finance.ts` — Read/Report-Layer (3 sauber getrennte Funktionen)**
- **`getLedgerAtoms(mosqueId, {year, konto?, typ?, kategorie?, page?, perPage?})`** →
  paginierte `LedgerAtom[]` + `{total, hasMore}`:
  - Lädt **jahrweise vollständig** beide Streams: `finance_source_events`
    (occurred_at-Jahr) + `transactions` (buchungsdatum-Jahr), Tenant-scoped via getFinancePB.
  - Mappt je via `toLedgerAtom` (Overload existiert), **additive Union, KEIN Override**.
  - Sort: Standard-Journal `datum ASC, beleg_nummer ASC, id ASC`.
  - **In-Memory-Pagination** (Plan: kein Materialized-Layer Phase 1). **UI-Hard-Limit
    ~10.000 Zeilen/Jahr** → bei Überschreitung Warn-Flag im Return (UI zeigt Banner).
  - Filter `konto`/`typ`/`kategorie` post-merge in JS.
- **`getFinanceKPIs(mosqueId, year)`** → `{einnahmen_cents, ausgaben_cents, saldo_cents,
  kassenstand_bar_cents, kassenstand_bank_cents}`:
  - **NICHT** über getLedgerAtoms (10k-Limit). Eigene gefilterte Fetches +
    JS-Summen (PB <0.23 hat **kein** GROUP BY in REST → fetch-by-classification über
    Index `idx_*_mosque_class`, dann `forEach`-Summe — Map-Iteration `forEach`!).
  - Kassenstand Bar/Bank = Anfangsbestand (Settings) + Σ signed bis Jahresende je `konto_typ`.
- **`getEUR(mosqueId, year)`** → `{einnahmen: {kategorie, cents}[], ausgaben:
  {kategorie, cents}[], ueberschuss_cents}`:
  - Gruppierung **ausschließlich über persistiertes `classification` + `kategorie`**
    (nie event_type/typ). Σ signed je Kategorie. Überschuss = ΣEinnahmen − ΣAusgaben.
  - Storno nettet automatisch (invertiertes classification, gleiche kategorie).
- **`getJahresbericht(mosqueId, year)`** → KPIs + Monatsverlauf (12 Buckets, je
  einnahmen/ausgaben) + Kategorie-Aufstellung (= getEUR). Für recharts-Chart.

**2. `lib/actions/settings.ts` — `getFinanceSettings` / `updateFinanceSettings`**
- Pattern wie `getMadrasaFeeSettings`/`updateMadrasaFeeSettings`.
- get: `{finance_enabled, kassenbuch_start_year, kassenbuch_bar_start_cents,
  kassenbuch_bank_start_cents, finance_hard_lock_until}`.
- update: Zod `financeSettingsSchema` (neu in validations.ts). Audit `settings.finance_updated`.

**3. UI `app/(auth)/admin/finanzen/page.tsx`** (`"use client"`, Pattern wie
`admin/spenden/page.tsx`):
- Button-Tabs: **Kassenbuch | EÜR | Berichte | Einstellungen** (Kassenbericht-Tab kommt 4b).
- **Kassenbuch-Tab:** Jahr-Picker + Konto-/Typ-Filter; KPI-Tiles via
  `components/shared/KPITile.tsx` (Einnahmen/Ausgaben/Saldo/Kassenstand Bar/Bank);
  **Desktop: Tabelle, Mobile: Card-Liste** (grid-cols-1, kein overflow-x, Plan-Pflicht);
  Event-Zeilen mit Quelle-Badge + „read-only", manuelle Zeilen mit Storno-Button;
  **„Buchung erfassen"-Dialog** (Shadcn `dialog`) → ruft `createManualTransaction`
  (existiert Sprint 3); Beleg-Upload (FormData); pro manueller Zeile „Stornieren"
  → `stornoTransaction`. Bei `finance_period_locked`/`transaction_immutable` Fehler-Toast.
- **EÜR-Tab:** Jahr-Select, Tabelle Einnahmen/Ausgaben je Kategorie + Überschuss-Summe.
- **Berichte-Tab:** Jahresbericht — KPIs + Monats-Chart (recharts, schon im Projekt) + Kategorie-Tabelle.
- **Einstellungen-Tab:** finance_enabled Toggle, kassenbuch_start_year, Anfangsbestände
  Bar/Bank (€→cents), finance_hard_lock_until (date). → updateFinanceSettings.
- Gating: ganze Seite nur wenn `finance_enabled` (sonst Hinweis „in Einstellungen aktivieren").

**4. Nav `app/(auth)/admin/layout.tsx`**
- Eintrag `{label: t("quickAccess.finanzen.title"), href: "/admin/finanzen", icon: Wallet}`
  (lucide `Wallet` importieren). Gated `finance_enabled` (über getFeatureFlags o.ä.).

**5. Komponenten `components/finance/`**
- `LedgerTable.tsx` (Desktop) + `LedgerCardList.tsx` (Mobile) — gemeinsame `LedgerAtom[]`-Props.
- `BuchungErfassenDialog.tsx` — Form (Datum, Typ, Betrag €, Kategorie-Select aus
  FINANCE_CATEGORIES, Konto, Zahlungskanal, Beschreibung, Beleg-Upload).
- `EurTable.tsx`, `JahresberichtChart.tsx`, `FinanceSettingsForm.tsx`, `KassenstandTiles.tsx`.

**6. i18n `messages/de.json` + `tr.json`** — kompletter `finanzen.*`-Namespace
(Tabs, Spalten, KPI-Labels, Dialog-Felder, Kategorie-Labels `finanzen.kategorie.<id>`,
Einstellungen, Fehler bereits aus Sprint 3 vorhanden) + `quickAccess.finanzen.title`.
Audit `settings.finance_updated` Label.

### 4b — Kassenbericht (eigener DoD, fehleranfälligstes Stück)

**`getKassenbericht(mosqueId, year)`** → `{bar: {anfang, einnahmen, ausgaben, ende},
bank: {…}, gesamt: {…}}`:
- **Carryover-Regel:** `Anfangsbestand Jahr N = Endbestand Jahr N−1`, **iterativ ab
  `kassenbuch_start_year`** (dort Settings-Startwerte `kassenbuch_bar/bank_start_cents`).
- Pro Jahr je `konto_typ` (bar/bank): Σ signed_amount aller LedgerAtoms des Jahres.
  `Endbestand = Anfangsbestand + Σ`. Iteration start_year → angefragtes Jahr.
- `konto_typ: "other"` → in „bank" o. separater Topf (Entscheidung: zu „bank" mergen, dokumentieren).
- Performance: pro Jahr gefilterte Σ-Query (nicht alle Atome laden).

**UI:** Kassenbericht-Tab — Tabelle Anfangsbestand/Einnahmen/Ausgaben/Endbestand je
Bar/Bank/Gesamt, Jahr-Select.

**Test (Pflicht, Mehrjahr-Fixture):** `scripts/test-kassenbericht.mts` — Demo: 3 Jahre
Buchungen inkl. **ein Jahr ohne Buchungen** (Lücke). Verifiziert: Anfang N = Ende N−1
über alle 3 Jahre korrekt; Bar/Bank getrennt; Startjahr nutzt Settings-Werte. Cleanup.

### 4 — Test-Skripte (Demo-Guard + finally-Cleanup, echte Module via tsx)
- `scripts/test-ledger-merge.mts` — Event + manuelle Buchung im selben Jahr →
  getLedgerAtoms liefert beide, korrekt sortiert, source_system-Tags richtig,
  additive Union (kein Override bei gleichem Datum).
- `scripts/test-eur.mts` — bekannte Buchungen → Σ je Kategorie + Überschuss exakt;
  Storno nettet in Original-Kategorie (kein Phantom).
- `scripts/test-kassenbericht.mts` — siehe 4b.
- `test-finance-unit.mts` erweitern: getEUR-Aggregations-Helper falls extrahiert.

### 4 — Definition of Done (messbar)
- [ ] Migration: 4 settings-Felder ergänzt (dry-run + real), idempotent
- [ ] getLedgerAtoms: Event + manuelle gemerged, sortiert, paginiert, source_system korrekt
- [ ] getFinanceKPIs: Einnahmen/Ausgaben/Saldo + Kassenstand Bar/Bank stimmen
- [ ] getEUR: Σ je Kategorie über `classification`, Überschuss korrekt, Storno nettet
- [ ] getJahresbericht: 12 Monatsbuckets + Kategorien
- [ ] getKassenbericht: Anfang N = Ende N−1 über 3-Jahr-Fixture (inkl. Leerjahr)
- [ ] UI: Kassenbuch-Tabelle (Desktop) + Card-Liste (Mobile, kein overflow-x)
- [ ] UI: Buchung-erfassen-Dialog ruft createManualTransaction; Storno-Button ruft stornoTransaction
- [ ] UI: EÜR-Tab + Jahresbericht-Chart + Einstellungen-Tab funktionieren
- [ ] Nav-Eintrag „Finanzen" gated auf finance_enabled
- [ ] i18n finanzen.* DE+TR vollständig
- [ ] Recon weiterhin Δ=0; Build grün (60+/X)
- [ ] EÜR/KPI-Aggregation NIE über event_type/typ (nur classification) — grep-Gate

### 4 — Risiken
1. **PB hat kein GROUP BY** → Aggregation = fetch-filtered + JS-Σ. Bei vielen Zeilen
   teuer; Phase-1-Limit ~10k/Jahr akzeptiert. KPI/EÜR fetchen nur nötige Felder.
2. **Carryover-Bug (4b)** = häufigste Fehlerquelle → Mehrjahr-Fixture-Test PFLICHT,
   inkl. Leerjahr + Startjahr-Settings.
3. **konto_typ "other"** Behandlung explizit dokumentieren (→ bank).
4. **Mobile-Tabelle** — Card-Liste nicht vergessen (Plan-Pflicht, kein overflow-x).
5. **finance_enabled vs public_finance_enabled** nicht verwechseln (zwei Felder).
6. **createManualTransaction/storno** sind Sprint-3-Server-Actions — UI nur verdrahten,
   nicht neu bauen.

---

## 5. Wie neue Session starten

1. Dieses Dokument + Originalplan (`.claude/plans/...ancient-sky.md`) als Kontext geben.
2. Tests laufen lassen zur Verifikation des Ist-Stands (siehe unten).
3. **Sprint 4 gemäß §4b umsetzen** (Sprint 1–3 fertig); Reihenfolge einhalten,
   zuerst Settings-Migration-Lücke schließen.
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
