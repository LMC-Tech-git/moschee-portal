# Finanzbuchhaltungs-Modul — Gesamtplan & Handover

> **Zweck dieses Dokuments:** Vollständige Übergabe für neue Sessions. Phase 1
> (Sprint 1–6) abgeschlossen. Enthält (1) Architektur-Prinzipien + goldene Regeln,
> (2) Sprint-1–6-Stand mit Commits, (3) Sprint-Roadmap, (4) **Phase-2-Trigger +
> Detail-Roadmap**, (5) Verifikations-Befehle für neue Sessions.
> Voller Originalplan: `C:\Users\halim\.claude\plans\implementiere-ein-finanzbuchhaltungs-mod-ancient-sky.md`

**Projekt-Root:** `C:\Users\halim\Documents\cami-portal\moschee-portal`
**Stack:** Next.js 14 (App Router), TypeScript, PocketBase (Hetzner, `_superusers`-Auth), Stripe Connect
**Node lokal:** `"C:\Program Files\nodejs\node.exe"` (voller Pfad nötig)
**TS-Skripte ausführen:** `npx tsx <datei.mts>`
**Login/Secrets:** `.env.local` (PB_ADMIN_EMAIL/PASSWORD, POCKETBASE_URL, NEXT_PUBLIC_DEMO_MOSQUE_ID, optional `ANTHROPIC_API_KEY`)
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
- Domain-Service hat **drei** öffentliche Entry-Points: `createIncome`, `refundIncome`, `createManualTransaction`. Alle anderen Schreibwege sind Bug.

---

## 1. ✅ Sprint 1 — Storage-Layer

**Commits:** `e405d98`, `3bd8447`

- **Collections:** `finance_source_events` (23 Felder, 5 Indizes, `source_event_key` UNIQUE), `transactions` (19 Felder, 4 Indizes, `beleg_nummer` UNIQUE per Mosque), `finance_sequences` (Belegnummer-Counter)
- **Quell-Felder:** `donations`/`student_fees`/`sponsors` → `is_financially_locked`, `financial_locked_at`; `donations` zusätzlich `refund_amount_cents`/`refunded_at`/`refund_reason`/`refund_provider_ref`
- **`source_event_key`-Formel (eingefroren):**
  - `income_received`: `SHA256(mosque_id|source_collection|source_id|"income_received")` — OHNE external_event_id (Dual-Path-Schutz)
  - `income_refunded`/`chargeback`: `SHA256(mosque_id|source_collection|source_id|event_type|external_event_id)` — Partial-Refunds unterscheidbar
  - Fallback ohne external id: `SHA256(...|event_type|refund_amount_cents|YYYY-MM-DD)`
- **Code:** `lib/finance-pb.ts` (Tenant-Wrapper), `lib/actions/finance-events.ts` (`emitFinanceEvent`, UNIQUE-Idempotenz → `{duplicated:true}`), `scripts/test-webhook-idempotency.mjs`, `scripts/backfill-finance-events.mjs`

---

## 2. ✅ Sprint 2 — Projection + Donation→Event

**Commit:** `b654305`

- `lib/finance-to-ledger-atom.ts` — `toSignedAmount`, `toLedgerAtom(event)`, `assertEventIntegrity`, `toClassification`, `FinanceEventIntegrityError`
- `lib/finance-lock-policy.ts` — `canWrite(date, hardLockUntil, writeScope)` mit 3 Scopes
- `lib/actions/finance-domain.ts` — `createIncome()` scharf (Zod-payload → canWrite → emit → Lock-Retry → safeAudit)
- `lib/donations-finance-helpers.ts` — `assertDonationEditAllowed` (F4 Lock-Allowlist), `donationToKontoChannel`, `DonationLockedError`
- `scripts/recon-source-vs-events.mjs`, `scripts/replay-events-to-ledger.mjs`, `scripts/test-finance-unit.mts`, `scripts/test-createincome-flow.mts`
- `migrate-v1.mjs` `audit_logs.context_json` + denormalisierte `classification`-Spalte; `types/index.ts` LedgerAtom + Finance-Types; `constants.ts` FINANCE_CATEGORIES (15) + mapDonationToEUR; `validations.ts` financeEventPayloadSchema.strict() (R3 ohne Zeit/Currency-Leak); `audit.ts` context_json + safeAudit; **Donation→Event-Hook** in manueller Mark-Paid + Webhook + `createManualDonation`; Backfill-Sweeper bidirektional + `--dry-run`; Audit-Labels DE+TR

---

## 3. ✅ Sprint 3 — Manuelle Buchungen + Storno + Sequencer

**Commit:** `dee7cd2`

- `lib/finance-pb-errors.ts` — `isUniqueViolation`/`isUniqueViolationOnField` (DRY)
- `lib/finance-sequence.ts` — `formatBelegNummer`, `getNextBelegHint`, `bumpBelegHint`, `insertTransactionWithBelegNummer` (UNIQUE-Retry max 6 + FormData pro Versuch neu)
- `lib/actions/finance-domain.ts` `createManualTransaction()` + `stornoTransaction()` scharf
- `lib/actions/finance.ts` — `updateTransactionNote()` (Allowlist nur `interne_notiz`), `getManualTransactions()`
- `toLedgerAtom`-Overload (Transaction-Signatur) + `assertTransactionIntegrity` + `FinanceTransactionIntegrityError`
- `validations.ts`: `transactionSchema`, `stornoSchema`, `transactionNoteSchema` (Zod v4)
- `constants.ts`: `FINANCE_CATEGORY_VALUES` Single-Source für Zod-Enum
- `migrate-v1.mjs`: `settings.finance_hard_lock_until`
- Seed-Demo: 10 Demo-Buchungen
- Storno-Netting **emergent** (invertiertes classification + gleiche kategorie → Σ in Kategorie sinkt, kein Phantom)
- Beleg-Upload MIME-Whitelist (pdf/jpeg/png) + 5 MB + SHA-256
- Belegnummer-Garantie ehrlich: monoton + kollisionsfrei (UNIQUE), nicht garantiert lückenlos
- **Keine UI** (kommt Sprint 4)

---

## 4. ✅ Sprint 4 — Finanz-UI + Reports

**Commits:** `00df5eb`, `2317e60`

- **Migration:** 4 neue Settings-Felder (`finance_enabled`, `kassenbuch_start_year`, `kassenbuch_bar_start_cents`, `kassenbuch_bank_start_cents`)
- **Read/Report-Layer** (`lib/actions/finance.ts`): `getLedgerAtoms` (Events+manuelle gemerged, paginiert, 10k-UI-Limit), `getFinanceKPIs`, `getEUR`, `getJahresbericht`, `getKassenbericht` (Carryover `Anfang N = Ende N−1`, iterativ ab `kassenbuch_start_year`), `computeKontoBalancesUpToYearEnd` (geteilter Helper → KPI-Kassenstand == Kassenbericht-Endbestand)
- **UI** `app/(auth)/admin/finanzen/page.tsx` — 5 Tabs (Kassenbuch, EÜR, Berichte, Kassenbericht, Einstellungen), gated `finance_enabled`
- **Komponenten** `components/finance/*`: `LedgerTable`, `LedgerCardList` (Mobile), `BuchungErfassenDialog`, `EurTable`, `JahresberichtChart` (recharts), `KassenberichtTable`, `FinanceSettingsForm`, `KassenstandTiles`
- **Permissions** `lib/finance-permissions.ts` — Rolle ∈ {admin, super_admin, treasurer} + mosque-match
- **Nav-Eintrag** „Finanzen" (Wallet-Icon), gated `finance_enabled`
- **V-A Storno-Datum-Fix:** same-period wenn Jahr offen, sonst heute
- **konto_typ "other"** → bank gemergt (dokumentiert)
- **Settings-Action:** `getFinanceSettings`/`updateFinanceSettings`
- **Bugfix:** File-Upload via FormData (Beleg-Anhang im Dialog)
- **Tests:** `test-ledger-merge.mts`, `test-eur.mts`, `test-kassenbericht.mts` (3-Jahr-Fixture inkl. Leerjahr), `test-tx-integrity.mts`

---

## 5. ✅ Sprint 5 — Refund/Chargeback + fees/sponsors Hooks

**Commit:** `91f6f56`

- **`refundIncome()` scharf** (`lib/actions/finance-domain.ts`):
  - Parent-Lookup (`income_received`-Event zur Quelle), wirft `refund_parent_not_found` wenn fehlt
  - **Sum-Guard Best-Effort:** Σ existierender refund/chargeback + neuer Refund > parent.betrag → `refund_exceeds_original`
  - emit mit `event_type="income_refunded"|"chargeback"`, `relation_type="refund_of"|"chargeback_of"`, `related_event_id=parent.event_uuid`
  - UNIQUE-Idempotenz via `external_event_id` im `source_event_key` (Webhook-Retry-safe)
  - Donations-Quell-Update (`refund_amount_cents` kumuliert, `refunded_at`, `refund_reason`, `refund_provider_ref`, `status`)
  - Lock-Drift-Check → `safeAudit finance.lock_drift_detected` (non-fatal)
- **M5-Guard entfernt** — `createIncome` akzeptiert donations + student_fees + sponsors
- **mark-paid Hooks:** `markStudentFeePaidAndEmit` + `markSponsorPaidAndEmit` (Sponsor: `amount × months_paid`). Eingehängt in manuell-bezahlt + Stripe-Webhook (5 Branches: fee/fee_multi/sponsor sync+async)
- **Helper:** `lib/fees-finance-helpers.ts` + `lib/sponsors-finance-helpers.ts` (KEIN `"use server"`, testbar)
- **Stripe `charge.refunded`:** payment_intent-Lookup → Donation → invoice-Fallback (Subscription); `charge.refunds.has_more` → vollständige Refund-Liste nachgeladen; Loop pro Refund mit `externalEventId=refund.id`
- **`charge.dispute.created`:** Chargeback-Event
- **Backfill-Sweeper refund-Branch** SCHARF: Σ-Diff-Logik, Fallback-Key, granularity-Marker
- **Recon 6 Buckets:** donations/fees/sponsors × received/refund, bidirektional, Exit≠0 bei Δ≠0
- **UI** — lila „Erstattung"/„Rückbuchung"-Badge in Kassenbuch (Desktop + Mobile), Heuristik: `source_system=external_event + classification=expense + related_event_id`
- **Typ-Erweiterung:** `LedgerAtom.source_origin.relation_type` + `related_event_id`
- **8 Tests** + i18n + Demo-Seed (refunded + disputed Demo-Donations)

---

## 6. ✅ Sprint 6 — Polish (letzter Phase-1-Sprint)

**Commit:** `465ebe5`

- **A) XLSX-Steuerberater-Export** — 4 Server-Actions (Buchungen/EÜR/Kassenbericht/Komplett), eigener Lade-Pfad ohne UI-Cap, base64→Download, feste Sortierung. Strikt „Steuerberater-Export (Excel)" — keine DATEV/SKR-Behauptung
- **B) KI-Kategorisierung** (optional, graceful ohne Key) — `lib/ai/sanitize.ts` maskiert Email/Tel/IBAN/Name vor jedem Call; `lib/ai/categorize.ts` ruft Anthropic Haiku (`claude-haiku-4-5`/Fallback `claude-3-5-haiku-latest`); Button im BuchungErfassenDialog, nie Auto-Submit, Audit nur Metadaten (kein Klartext-Leak)
- **C) Granulare Permissions** — 7 Finance-Rechte (`finance_view`/`create`/`storno`/`export`/`settings`/`ai_use`/`audit_view`). Phase 1: alle an admin/super_admin/treasurer gebunden. Server-seitig in jeder Action geprüft (UI-Gating ergänzt)
- **D) Datenschutz §8** — Anthropic PBC + EU-SCC, sanitisierte Datenflüsse, Opt-out (Key weglassen / Permission entziehen). DE+TR
- **E) Demo-Polish** — `finance_enabled=true`, Anfangsbestände (Bar 100€/Bank 2500€), Mehrjahr-Buchungen (3 manuelle), 1 Storno-Beispiel, Events für ALLE paid fees/sponsors
- **F) fee/sponsor-Refund-Backref** — `charge.refunded` Source-Resolver: donation → fee/sponsor via `stripe.checkout.sessions.list({payment_intent})`. **Behebt Madrasa-Refund-Bug** aus Sprint 5. fee_multi-Refund bleibt manuell (Storno-Buchung)
- **G) Beleg-Download-Härtung** — API-Proxy-Route mit `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` (Stored-XSS-Schutz)
- **+ Recon-Fix** — refunded/disputed Donations bleiben im received-Bucket (korrektes Double-Entry)
- **3 neue Tests** (sanitize, fee-refund, sponsor-refund)

---

## 7. Sprint-Übersicht (Roadmap-Tabelle)

| Sprint | Inhalt | Status |
|--------|--------|--------|
| **1** | Storage-Layer (Collections, emitFinanceEvent, Idempotenz, Sweeper-Grundgerüst) | ✅ `e405d98` `3bd8447` |
| **2** | Projection + createIncome (Donation→Event), beide paid-Pfade, Lock-Recovery | ✅ `b654305` |
| **3** | createManualTransaction + Storno + Belegnummer-Sequencer + toLedgerAtom(Transaction) | ✅ `dee7cd2` |
| **4** | Ledger-Merge + 5-Tab-UI + EÜR + Jahresbericht + Kassenbericht (Carryover) | ✅ `00df5eb` `2317e60` |
| **5** | refundIncome + Stripe-Refund-Webhook + fees/sponsors-Hooks + Refund-Sweeper/Recon | ✅ `91f6f56` |
| **6** | XLSX-Export + KI-Kategorisierung + granulare Permissions + Beleg-Härtung + Datenschutz §8 + fee/sponsor-Refund-Backref | ✅ `465ebe5` |

**🎉 PHASE 1 ABGESCHLOSSEN.** Event-basiertes Finanzmodul produktiv: zwei
immutable Streams, deterministischer Merge, EÜR/Kassenbericht/Jahresbericht,
Refund/Chargeback, XLSX-Export, optionale KI-Kategorisierung, granulare Permissions.

---

## 8. ➡️ Phase 2 — Detail-Roadmap (bedarfsgetrieben, nicht vorauseilend)

**Trigger-getrieben:** Phase-2-Module werden NUR dann gestartet, wenn ein
konkreter Bedarf in Produktion auftritt. Keine vorauseilende Implementierung.

### Trigger-Matrix

| Modul | Trigger („starte wenn …") | Aufwand |
|---|---|---|
| **DATEV-Export / SKR03/04** | Steuerberater lehnt aktuellen XLSX-Export ab oder fordert DATEV-CSV | M |
| **Kontenplan (`finance_accounts`) + doppelte Buchführung (`transaction_entries`)** | Steuerberater fordert echte Soll/Haben-Buchungssätze ODER Split-Buchungen (Stripe-Gebühren) müssen sauber gebucht werden | L |
| **Period-Closing (`finance_period_closures`)** | Vereinsprüfung läuft + Admins umgehen Soft-Lock öfter als toleriert | M |
| **Versionierter Export (`finance_exports` + SHA-256)** | Steuerberater fordert Export-Nachweisbarkeit / Anti-Tampering | S |
| **Multi-Beleg (`transaction_attachments`)** | Vereinsprüfung verlangt mehrere Belege pro Buchung (Auftrag + Rechnung + Zahlungsnachweis) | M |
| **Canonical-Hash `event_hash_sha256` scharf + Drift-Check** | Audit-Nachweis gegen DB-Manipulation gefordert | S |
| **Sum-Guard harte Race-Garantie** | Doppel-Refund mit Σ > Original tritt real auf (Logs zeigen Race) | M |
| **Atomares Sequenz-Inkrement / version-CAS** | Belegnummer-Race real (UNIQUE-Retry-Loops > 1 in Logs) ODER Multi-Writer-Setup | M |
| **Soft-Lock + lock_scope** | Admins wollen einzelne Bereiche sperren ohne ganze Vorperiode | S |
| **KPI-Read-Cache** | `/admin/finanzen` lädt > 2 s bei Demo-Größe | S |
| **`root_event_id`/Graph-Relationen** | Refund-Kette > 1 Ebene tief (Refund-of-Refund) auftritt | M |
| **event_type `income_adjusted`/`fee_applied`** | Stripe-Gebühren als eigene Events benötigt | S |
| **Event-Storno** | Falsch emittiertes Event nicht via Refund/Gegenbuchung korrigierbar | M |
| **`sequence_audit_log`** | Auditor fragt nach Begründung für Belegnummer-Lücken | S |
| **Granulare Permission-Zuweisung (treasurer-Rolle eigenständig)** | Kassenwart soll Rechte unabhängig vom Vorstand bekommen | S |

### Phase-2-Prinzipien (additiv, kein Wegwerf)
- **Append-only bleibt** — Phase-2-Module ergänzen, ersetzen nicht.
- **Datenmodelle Phase 1 bleiben unverändert** — Phase 2 fügt neue Collections hinzu (`finance_accounts`, `transaction_entries` etc.). Bestehende Felder werden nicht umbenannt.
- **Sprint 6 KI ≠ Phase 2** — KI in Phase 1 ist nur Vorschlag-UI (assistiv). Phase-2-KI könnte „Anomalie-Erkennung in Buchungsmustern" o.ä. sein.
- **Demo-First** — jedes Phase-2-Modul kommt mit Demo-Seed + Test-Skript.

---

## 9. Wie neue Session starten (Phase-2-Trigger oder Wartung)

### 9.1 Wenn ein Phase-2-Trigger zündet
1. Dieses Dokument als Kontext geben (vor allem §0 Prinzipien + §8 Trigger-Matrix).
2. Originalplan referenzieren: `C:\Users\halim\.claude\plans\implementiere-ein-finanzbuchhaltungs-mod-ancient-sky.md` (§ Roadmap).
3. Verifikations-Befehle laufen lassen (siehe unten) — Ausgangsstand grün.
4. Detailplan für das spezifische Phase-2-Modul anlegen (Build-Reihenfolge, DoD, Tests).
5. Migration `--dry-run` vor real, Tests gegen Demo, `git add/commit/push`.

### 9.2 Wenn Wartung / Bugfix
1. Recon + Replay laufen → Δ=0 erwartet
2. Drift-Sweeper laufen → kein Drift erwartet
3. Bei Drift: Logs prüfen (`audit_logs.action LIKE 'finance.%'`), Quelle vs Event abgleichen, ggf. Backfill scharf laufen

### 9.3 Verifikations-Befehle (Ist-Stand prüfen)
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
Erwartung: alle ✅, Recon Δ=0 (6 Buckets bidirektional), Build grün.

### 9.4 Cron-Empfehlung (Produktiv)
- **Drift-Sweeper:** stündlich gegen Live-PB, bei Drift → E-Mail-Alarm
- **Recon:** täglich um 03:00, bei Δ≠0 → E-Mail-Alarm
- **Backup:** PB-Backup vor jeder Migration (`scripts/backup-pocketbase.sh`)
