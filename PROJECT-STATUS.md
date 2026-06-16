# Moschee-Portal — Projektstatus (Stand: Mai 2026, Finanzmodul Phase 1 ✅ abgeschlossen)

## Tech-Stack
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn/ui (12 Komponenten)
- **Backend:** PocketBase (Hetzner VPS, Germany) — v0.23+ (`_superusers` Auth)
- **Payments:** Stripe Connect (Express, Direct Charges), SEPA-Lastschrift produktiv, Connect-Test + Connect-Live + Plattform-Legacy als Modi
- **APIs:** AlAdhan (Gebetszeiten-Berechnung) + offizielle Diyanet-Tabelle (namazvakitleri.diyanet.gov.tr, kein Account), Cloudflare Turnstile (CAPTCHA), Resend (E-Mail)

---

## ✅ Vollständig implementierte Features

### Fundament
| Feature | Dateien |
|---|---|
| Multi-Tenant Portal (Subdomain-basiert) | `lib/resolve-mosque.ts`, `app/[slug]/layout.tsx`, `middleware.ts` |
| Auth (Admin/Member/Teacher/Imam/Editor) | `lib/auth-context.tsx`, `app/login`, `app/register` |
| PocketBase Admin Client (Singleton) | `lib/pocketbase-admin.ts` |
| Env-Validation (Zod) | `lib/env.ts` |
| Security (CSP, HSTS, Rate-Limiting, Turnstile) | `next.config.mjs`, `lib/rate-limit.ts`, `lib/turnstile.ts` |
| Audit-Logging | `lib/audit.ts`, `lib/actions/audit.ts`, `app/(auth)/admin/audit` |
| Health-Check API | `app/api/health/route.ts` |
| PocketBase Backup-Script | `scripts/backup-pocketbase.sh` |
| Migration-Script (idempotent) | `scripts/migrate-v1.mjs` |
| **Mehrsprachigkeit (DE/TR)** | `messages/de.json`, `messages/tr.json`, alle Admin- + Member-Seiten |
| **Superadmin-Schutz** | Superadmin unsichtbar in Mitgliederlisten, nicht löschbar |
| **Eigener Passwort-Reset via Resend** | `app/api/auth/request-password-reset`, `app/api/auth/confirm-password-reset` |

### Öffentliches Portal (`/[slug]/...`)
| Feature | Dateien |
|---|---|
| Dashboard (Gebetszeiten, Events, Posts, Kampagnen) | `app/[slug]/page.tsx` |
| Gebetszeiten-Widget — **Multi-Provider** (AlAdhan-Berechnung + offizielle Diyanet-Tabelle, generische Dispatch-Map), provider-unabhängiger **Sabah-Offset**, **Live-Countdown zum nächsten Gebet** (Portal + TV) | `lib/prayer/` (`index.ts` Dispatch, `diyanet.ts`, `aladhan.ts`, `mawaqit.ts`, `cache.ts`), `components/prayer/NextPrayerCountdown.tsx`, `components/tv/PrayerHeader.tsx` |
| Beiträge / Blog | `app/[slug]/posts/` |
| Veranstaltungen + Gast-Anmeldung | `app/[slug]/events/` |
| Spenden-Seite (Stripe, SEPA, Kampagnen) | `app/[slug]/donate/`, `app/[slug]/campaigns/` |
| Einladungs-Registrierung | `app/[slug]/invite/[token]/` |
| **Förderpartner-Seite (Kategoriefilter, Website-Links)** | `app/[slug]/foerderpartner/` |
| **Leitung/Team-Seite (members-only oder public)** | `app/[slug]/leitung/` |
| Impressum, Datenschutz, AGB | `app/impressum`, `app/datenschutz`, `app/agb` |
| **Globales Kontaktformular** (`moschee.app/kontakt`) | `app/kontakt/page.tsx`, `app/api/contact/route.ts` |
| **Per-Moschee Kontaktformular** (`[slug]/kontakt`) | `app/[slug]/kontakt/page.tsx`, `app/api/[slug]/contact/route.ts` |

### Admin-Panel (`/admin/...`)
| Feature | Dateien |
|---|---|
| Dashboard (KPI-Tiles, Diagramme) | `app/(auth)/admin/page.tsx`, `lib/actions/dashboard.ts` |
| Beiträge (CRUD, Kategorien, Sichtbarkeit) | `app/(auth)/admin/posts/` |
| Veranstaltungen (CRUD, Anmeldungen, CSV-Export, **Wiederkehrend**) | `app/(auth)/admin/events/` |
| Spenden (Liste, manuell erfassen, Stripe-Status, sortierbare Spalten, Dauerauftrag-Badge) | `app/(auth)/admin/spenden/` |
| **Daueraufträge (Abonnements)** — Liste, Suche, Sortierung, Kündigen, Mitglied-Link | `app/(auth)/admin/spenden/abonnements/` |
| **Spender-Übersicht** — Suche, Sortierung, Zeitfilter, Dauerauftrag-Spalte, CSV-Export | `app/(auth)/admin/spenden/spender/` |
| Kampagnen (CRUD, Fortschritt SUM-basiert) | `app/(auth)/admin/kampagnen/` |
| Mitglieder (Liste, Detail) | `app/(auth)/admin/mitglieder/` |
| Newsletter (email_outbox) | `app/(auth)/admin/newsletter/` |
| Einladungen (erstellen, kopieren, widerrufen, **E-Mail senden**) | `app/(auth)/admin/invites/` |
| Audit-Log (paginiert, gefiltert) | `app/(auth)/admin/audit/` |
| Einstellungen (Branding, Gebetszeiten, Defaults, **Auszahlungen (Stripe Connect)**, Madrasa, Daueraufträge, Förderpartner, Team, Kontaktformular, E-Mail) | `app/(auth)/admin/settings/` |
| **Auszahlungen-Tab (Stripe Connect)** — Mode-Badge (platform_legacy/connect_test/connect_live/disabled), Health-Banner, 4 Status-Cards (Account/Details/Karten-SEPA/Auszahlungen), Capability-Anzeige (active/pending/inactive), Staleness-Warning, Onboarding-Start/Fortsetzen, Stripe-Dashboard-Login-Link, Manual-Sync | `components/admin/StripeConnectTab.tsx`, `lib/actions/stripe-connect.ts` |
| **Madrasa: Schuljahre, Kurse, Einschreibungen** | `app/(auth)/admin/madrasa/` |
| **Madrasa: Schüler-Verwaltung** — alle Schüler einer Moschee, getrennt von Kursen, mit Eltern-Verknüpfung | `app/(auth)/admin/madrasa/schueler/` |
| **Madrasa: Anwesenheit + Statistiken + Leistungsbewertung** (1–5 Skala je Session, Trend-Detection, Eltern sehen Schnitt) | `app/(auth)/admin/madrasa/[id]/attendance/`, `components/madrasa/PerformanceStats.tsx` |
| **Madrasa: Gebühren (Bar/Überweisung/Erlassen)** | `app/(auth)/admin/madrasa/gebuehren/` |
| **Finanzen (Kassenbuch, EÜR, Berichte, Kassenbericht, Einstellungen)** — gated auf `finance_enabled` + 7 granulare Permissions (view/create/storno/export/settings/ai_use/audit_view); Event+manuelle Buchungen gemerged read-only, Buchung erfassen + Storno, lila Erstattung/Rückbuchung-Badge in Kassenbuch (Sprint 5), KI-Vorschlag-Button (assistiv, graceful ohne Anthropic-Key, Sprint 6), 4 XLSX-Exporte (Buchungen/EÜR/Kassenbericht/Komplett — Sprint 6), Beleg-Download gehärtet (attachment+nosniff, Sprint 6), Mobile Card-Liste | `app/(auth)/admin/finanzen/`, `components/finance/`, `lib/ai/` |
| **Mitgliedsbeiträge** — Perioden-Picker (monatlich/vierteljährlich/jährlich), Bulk-Erstellen, KPI-Tiles (offen/ausstehend/bezahlt/fehlgeschlagen/erlassen/Dauerauftrag), Bar/Überweisung/Erlassen, Einzelkonfiguration pro Mitglied (Betrag/Intervall/Befreiung), Stripe-Dauerauftrags-Erkennung | `app/(auth)/admin/mitgliedsbeitraege/`, `lib/actions/membership-fees.ts` |
| **Förderpartner (CRUD, Stripe, Kontakt, Laufzeit, Erinnerungs-Indikator)** | `app/(auth)/admin/foerderpartner/` |
| **Leitung/Team verwalten** — Admin-Pendant zur öffentlichen Team-Seite, CRUD für Vorstand/Imam/Sekretariat-Einträge mit Foto, Rolle, Bio, Sortierung | `app/(auth)/admin/leitung/` |
| **Demo-Reset Button** (Super-Admin) | `app/(auth)/admin/platform/` |

### Lehrer-Panel (`/lehrer/...`)
| Feature | Dateien |
|---|---|
| Eigene Kurse + Anwesenheit eintragen | `app/(auth)/lehrer/` |

### Imam-Panel (`/imam/...`)
| Feature | Dateien |
|---|---|
| Beiträge erstellen/bearbeiten | `app/(auth)/imam/` |

### Member-Bereich (`/member/...`)
| Feature | Dateien |
|---|---|
| Profil (bearbeiten) | `app/(auth)/member/profile/` |
| **Passwort ändern (eingeloggt, mit Re-Auth + Auto-Logout)** | `app/(auth)/member/profile/components/PasswordChangeSection.tsx`, `lib/actions/members.ts#changePassword` |
| **E-Mail ändern** (extrahiert in eigene Komponente) | `app/(auth)/member/profile/components/EmailChangeSection.tsx` |
| Spenden-Verlauf (inkl. Typ-Badge: Allgemein / Kampagne / Dauerauftrag, **Quelle: Karte/SEPA differenziert**) | `app/(auth)/member/profile/` (Tab) |
| **Meine Daueraufträge** — Liste, Status, Kündigen | `app/(auth)/member/profile/` (Tab) |
| Event-Anmeldungen | `app/(auth)/member/profile/` (Tab) |
| **Madrasa-Gebühren (Kinder, Online-Zahlung via Stripe)** | `app/(auth)/member/profile/` (Tab) |
| **Madrasa: Anwesenheitsstatistiken der Kinder** | `app/(auth)/member/profile/` (Madrasa-Tab) |
| **Förderpartner-Tab (nur für verknüpfte Kontakte, Stripe-Zahlung)** | `app/(auth)/member/profile/` (Tab) |
| Spendenbescheinigung (Drucken + **Per E-Mail senden**) | `app/(auth)/member/spendenbescheinigung/` |

### Finanzbuchhaltungs-Modul (Phase 1 ✅ vollständig, Sprint 1–6) — event-sourced

Revisionssichere Finanzakte: **zwei gleichrangige immutable Fact-Streams** —
`finance_source_events` (extern/systemisch aus Spenden/Gebühren/Förderpartnern) +
`transactions` (manuelle Buchungen). Reports/EÜR/Kassenbuch lesen **nie live** aus
Fach-Collections, sondern normalisiert über `toLedgerAtom()` → `LedgerAtom`.
Append-only, immutable, Korrektur nur per Storno/Refund/kompensierende Buchung.
Aggregation ausschließlich über persistiertes `classification`/`kategorie` (nie
`event_type`/`typ`). PB ohne GROUP BY → fetch-filtered + JS-Σ.

| Baustein | Datei(en) |
|---|---|
| **PB-Wrapper** (Tenant-Scope, Collection-Whitelist, autoCancellation) | `lib/finance-pb.ts` |
| **Event-Emission** (einziger Schreibpfad, UNIQUE-Idempotenz `source_event_key`) | `lib/actions/finance-events.ts` |
| **Projection** (`toSignedAmount`, `toLedgerAtom` Overload Event+Transaction, `assertEventIntegrity`/`assertTransactionIntegrity`) | `lib/finance-to-ledger-atom.ts` |
| **Lock-Policy** (`canWrite` mit SYSTEM_EVENT/MANUAL/BACKFILL_WRITE) | `lib/finance-lock-policy.ts` |
| **Belegnummer-Sequencer** (`JJJJ-NNNN`, UNIQUE-Index-Retry, kein atomares Inkrement) | `lib/finance-sequence.ts`, `lib/finance-pb-errors.ts` |
| **Domain-Orchestrator** (3 Entry-Points: `createIncome`, `refundIncome`, `createManualTransaction` + `stornoTransaction`) | `lib/actions/finance-domain.ts` |
| **Report-Layer** (`getLedgerAtoms`, `getFinanceKPIs`, `getEUR`, `getJahresbericht`, `getKassenbericht`, `updateTransactionNote`, 4 XLSX-Exporte, KI-Vorschlag) | `lib/actions/finance.ts` |
| **Permissions-Guard** (7 granulare Rechte: `finance_view`/`create`/`storno`/`export`/`settings`/`ai_use`/`audit_view`) | `lib/finance-permissions.ts` |
| **Donation→Event** (manueller mark-paid + Stripe-Webhook donation-paid), Lock-Allowlist | `lib/actions/donations.ts`, `lib/donations-finance-helpers.ts`, `app/api/stripe/webhook/route.ts` |
| **Fee→Event + Sponsor→Event** (Sprint 5 mark-paid Helpers + Stripe-Webhook in 5 Branches) | `lib/actions/student-fees.ts`, `lib/actions/sponsors.ts`, `lib/fees-finance-helpers.ts`, `lib/sponsors-finance-helpers.ts` |
| **Refund/Chargeback** (`refundIncome` mit Parent-Lookup + Sum-Guard, Stripe `charge.refunded`/`charge.dispute.created` + Source-Resolver donation→fee/sponsor via `sessions.list`) | `lib/actions/finance-domain.ts`, `app/api/stripe/webhook/route.ts` |
| **KI-Kategorisierung** (Anthropic Haiku, sanitize-Pflicht, graceful ohne `ANTHROPIC_API_KEY`) | `lib/ai/sanitize.ts`, `lib/ai/categorize.ts`, `lib/actions/finance.ts#suggestTransactionCategory` |
| **XLSX-Export** (4 Server-Actions Buchungen/EÜR/Kassenbericht/Komplett, eigener Lade-Pfad ohne UI-Cap, feste Sortierung) | `lib/actions/finance.ts#export*XLSX` |
| **Beleg-Download-Härtung** (`Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`, Tenant+Permission-Check) | API-Proxy-Route + `lib/actions/finance.ts` |
| **Recovery** (Drift-Sweeper bidirektional + `--dry-run`, Recon 6 Buckets read-only, Replay) | `scripts/backfill-finance-events.mjs`, `scripts/recon-source-vs-events.mjs`, `scripts/replay-events-to-ledger.mjs` |
| **UI** (5 Tabs Kassenbuch/EÜR/Berichte/Kassenbericht/Einstellungen, KPI-Tiles, Tabelle+Card, recharts-Chart, lila Erstattung/Rückbuchung-Badge in Kassenbuch, KI-Vorschlag-Button im BuchungErfassen-Dialog) | `app/(auth)/admin/finanzen/page.tsx`, `components/finance/*` |
| **Datenschutz §8** (Anthropic PBC + EU-SCC, sanitisierte Datenflüsse, Opt-out) | `app/datenschutz/page.tsx` + i18n `legal.datenschutz.s8_*` |
| **Tests** (echte TS-Module via tsx, Demo-Guard + finally-Cleanup) | `scripts/test-finance-unit.mts`, `test-manual-transaction.mts`, `test-storno.mts`, `test-sequence.mts`, `test-ledger-merge.mts`, `test-eur.mts`, `test-kassenbericht.mts`, `test-tx-integrity.mts`, `test-refund-flow.mts`, `test-partial-refunds.mts`, `test-sum-guard.mts`, `test-chargeback.mts`, `test-student-fee-paid.mts`, `test-sponsor-paid.mts`, `test-recon-bidirectional.mts`, `test-sweeper-refund.mts`, `test-sanitize-ai.mts`, `test-fee-refund-webhook.mts`, `test-sponsor-refund-webhook.mts` |

**Prinzipien:** `betrag_cents` immer positiv + persistiertes `classification` bestimmt
Vorzeichen (`signed_amount_cents` nur berechnet); Storno nettet emergent in Original-
Kategorie (kein Phantom); Storno bucht in Original-Periode wenn offen, sonst heute;
Kassenbericht-Carryover (Anfang N = Ende N−1) via geteiltem Helper
`computeKontoBalancesUpToYearEnd` → KPI-Kassenstand == Kassenbericht-Endbestand;
`konto_typ "other"` → bank; UI-Hard-Limit ~10.000 Atoms/Jahr (truncated-Banner);
XLSX-Export hat eigenen Lade-Pfad ohne UI-Cap; KI-Vorschlag ist assistiv (nie
Auto-Submit, Audit nur Metadaten — kein Klartext-Leak).
**Hinweis:** Direkter PB-Edit auf Spenden umgeht die Emit-Pipeline → Drift-Sweeper nötig.
**Detail-Plan + Phase-2-Trigger:** `FINANCE-SPRINT-PLAN.md` §8.

### Mitgliedsbeiträge-Modul

Verwaltung monatlicher, vierteljährlicher oder jährlicher Mitgliedsbeiträge inkl.
individuellem Konfiguration pro Mitglied, Stripe-Dauerauftrags-Integration und
vollständiger Zahlungserfassung (Bar, Überweisung, Online, Erlassen).

| Baustein | Datei(en) |
|---|---|
| **Admin-Seite** (Perioden-Picker, Bulk-Erstellen, KPI-Tiles, Übersichtstabelle, Einzelkonfiguration) | `app/(auth)/admin/mitgliedsbeitraege/page.tsx` |
| **Server Actions** (`getMembershipFeeOverview`, `getMembershipConfigs`, `createPeriodFees`, `markMembershipFeePaid`, `markMembershipFeeWaived`, `upsertMembershipConfig`) | `lib/actions/membership-fees.ts` |
| **Settings** (`getMembershipFeeSettings` — `membership_fees_enabled`, `membership_default_fee_cents`, `membership_default_interval`) | `lib/actions/settings.ts` |
| **Stripe-Integration** — Mitglieder mit aktivem Dauerauftrag werden automatisch erkannt (hasActiveSub), Stripe-Zahlung aus Member-Profil heraus | `lib/actions/membership-fees.ts`, `app/(auth)/member/profile/` |

**Collections:** `membership_fees` (mosque_id, user_id, period_key, amount_cents, status, payment_method, source, notes), `membership_fee_configs` (pro Mitglied: amount_cents, interval, active, exempt)

**Perioden-Format:** `YYYY-MM` (monatlich), `YYYY-QN` (vierteljährlich), `YYYY` (jährlich)

**Status-Enum:** open / pending / paid / failed / waived

**Intervalle:** monthly / quarterly / yearly (konfigurierbarer Default + Überschreibung pro Mitglied)

**Besonderheiten:**
- Bulk-Erstellen überspríngt Mitglieder mit bestehendem Eintrag (idempotent)
- Exempt-Flag: Mitglied von Beitragspflicht befreien ohne Zeile zu erstellen
- Active-Flag pro Config: Mitglied vorübergehend deaktivieren (kein neuer Beitrag bei Bulk)
- Stripe-Dauerauftrag-Badge: automatische Erkennung, kein manuelles Bestätigen nötig

### E-Mail-Infrastruktur
| Komponente | Beschreibung |
|---|---|
| **Resend.com** | Transaktionale E-Mails (noreply@mail.moschee.app), Domain verifiziert (DKIM, SPF, DMARC) |
| **PocketBase SMTP** | smtp.resend.com:587 (StartTLS) für Passwort-Reset + Verifizierungsmails |
| **Eigener Passwort-Reset Flow** | Vollständiger Reset via Resend HTTP API (kein PB-SMTP nötig) |
| **Email Queue** | `email_outbox` Collection → `GET/POST /api/email/process-queue` (CRON_SECRET) |
| **Cron-Job** | Alle 5 Min: `curl https://moschee.app/api/email/process-queue` via Linux-Crontab |
| **Stripe Webhook** | Idempotenz via `stripe_events`-Collection; Connect-Account-Resolution via `event.account`; Cases: `checkout.session.completed` (Karte sync, SEPA bleibt pending), `checkout.session.async_payment_succeeded/failed` (SEPA-Donations → Finalizer), `invoice.paid/payment_failed` (Recurring → Finalizer, liest Capability-Detail aus PaymentIntent), `customer.subscription.updated/deleted`, `charge.dispute.created`, `charge.refunded`, **`account.updated`** (Capability-Status-Sync), **`account.application.deauthorized`** (payments_mode → disabled), **`mandate.updated`** (SEPA-Mandat Audit-only), **`payment_intent.payment_failed`** (Audit-only) |
| **E-Mail-Templates** | 11 HTML-Templates: Newsletter, Event-Bestätigung, Gebühren-Erinnerung, Admin-Notiz, Spendenquittung, Jahresbescheinigung, Sponsor-Ablauferinnerung, Kontakt-Benachrichtigung, Kontakt-Auto-Reply, Einladungsmail, **SEPA-Lastschrift-Fehlgeschlagen (mit Retry-CTA + expired-Hint)** |
| **Cron: Sponsor-Erinnerungen** | Jeden 21. des Monats (`app/api/cron/sponsor-reminders/`) |
| **Cron: Demo-Reset** | Jeden Montag 03:00 Uhr (`app/api/cron/demo-reset/`) |
| **Cron: Stripe-Connect-Sync** | Täglich 04:00 Uhr — alle Connect-Accounts via Stripe-API resyncen |
| **Cron: Cleanup-Pending-Donations** | Täglich 05:00 Uhr — pending >14d via Stripe-Recheck finalisieren |
| **Cron: Cleanup-Pending-Subscriptions** | Stripe-Check verwaister pending-Subs |

### Stripe-Infrastruktur (`lib/stripe/`)
| Modul | Zweck |
|---|---|
| `lib/stripe/client.ts` | `getStripe()` Singleton + `stripeAccountFor(mosque)` (Direct Charges Option oder undefined für legacy) + `sepaAvailable(mosque, settings)` + `computeStripeHealth()` (derived, nicht persistent) + `capabilityStaleness()` |
| `lib/stripe/connect.ts` | `createConnectAccount()` (Express, DE, card+sepa+transfers capabilities) + `createOnboardingLink()` mit HMAC-signed state-token (30 Min TTL) + `fetchAccountState()` (capability-status inkl.) + `createDashboardLoginLink()` + `verifyOnboardingState()` |
| `lib/stripe/idempotency.ts` | `stripe_events`-Collection Dedup (unique event_id, payload_hash sha256, payload_preview in Test-Mode), `isAlreadyProcessed`/`recordEventReceived`/`markProcessed`/`markFailed` |
| `lib/stripe/finalize.ts` | Zentraler `finalizeSuccessfulPayment()` aus exakt 2 Quellen (checkout_async + invoice_paid + expired_recheck) + `finalizeFailedPayment()` (checkout_async + invoice_failed + expired) — idempotent, sendet Quittung/Admin-Notif/SEPA-Failure-Mail |

### API-Endpunkte
| Endpunkt | Zweck |
|---|---|
| `POST /api/[slug]/donations/stripe/create-checkout` | Stripe Checkout für Einzel-Spenden (Connect via stripeAccountFor, Duplicate-Guard für status="created" 5min, Idempotency-Key, SEPA-Capability-Check) |
| `POST /api/[slug]/donations/stripe/create-subscription` | Stripe Checkout für Daueraufträge (Rate-Limit, Turnstile, Duplicate-Guard, pending→active Flow, Connect-Routing, SEPA-Capability-Check) |
| `POST /api/admin/stripe/connect/start` | Connect-Onboarding starten (Race-Safe Account-Create, signed state-token, Admin-Auth) |
| `GET /api/admin/stripe/connect/refresh/[mosque_id]` | Stripe-Refresh-URL bei abgelaufenem Onboarding-Link |
| `GET /api/admin/stripe/connect/return` | Onboarding-Return (verifiziert state-token, syncs Account-State, Redirect zu Admin) |
| `POST /api/admin/stripe/connect/dashboard/[mosque_id]` | Stripe-Dashboard-Login-Link pro Moschee (Admin-Auth) |
| `POST /api/admin/stripe/connect/sync/[mosque_id]` | Manueller Account-Status-Sync |
| `GET /api/cron/stripe-connect-sync` | Täglich 4 Uhr: alle Connect-Accounts via Stripe-API resyncen (verpasste Webhooks fangen) |
| `GET /api/cron/cleanup-pending-donations` | Täglich 5 Uhr: pending Donations >14 Tage prüfen — Stripe-Recheck (cs_*/in_*/pi_*) → succeeded → finalize paid; canceled/expired → failed_expired; still pending → skip |
| `GET /api/cron/cleanup-pending-subscriptions` | Verwaiste pending-Subs bereinigen (Stripe-Check → abandoned) |
| `POST /api/[slug]/events/[id]/register-guest` | Gast-Anmeldung zu Events |
| `GET/POST /api/[slug]/invite/[token]` | Einladungs-Token validieren + registrieren |
| `POST /api/stripe/webhook` | Stripe Webhooks (Spenden + Gebühren + Förderpartner) |
| `GET /api/cron/sponsor-reminders` | Sponsor-Ablauferinnerungen (Bearer Auth, Cron 21./Monat) |
| `GET /api/cron/demo-reset` | Demo-Daten zurücksetzen (Bearer Auth, Cron Mo 03:00) |
| `GET/POST /api/email/process-queue` | E-Mail-Queue verarbeiten |
| `GET /api/health` | Health-Check |
| `POST /api/contact` | Globales Kontaktformular |
| `POST /api/[slug]/contact` | Per-Moschee Kontaktformular |
| `POST /api/auth/request-password-reset` | Passwort-Reset anfordern (Resend) |
| `POST /api/auth/confirm-password-reset` | Passwort-Reset bestätigen (PB-API) |
| `GET /api/admin/demo-reset` | Demo-Reset per Admin-Button |
| `POST /api/demo/auto-login` | Demo-Auto-Login mit fest hinterlegten Demo-Credentials je Rolle (admin/teacher/member) für 1-Click-Demo-Buttons |
| `GET /api/email-change/confirm` | Bestätigt E-Mail-Adressänderung via Token-Link aus Mail, setzt neue E-Mail + löscht Token-Felder |
| `POST /api/email/fee-reminders` | Cron-Job für tägliche automatische Gebühren-Erinnerungen an Eltern mit offenen Madrasa-Beträgen (X-API-Secret) |
| `POST /api/lmctech-contact` | CORS-Endpunkt für externe lmctech.de-Website (Kontaktformular leitet Mails an Tech-Support weiter, rate-limited) |

### Server Actions (`lib/actions/`)
| Action-File | Zuständig für |
|---|---|
| `posts.ts` | Beiträge CRUD |
| `events.ts` | Events CRUD, Anmeldungen, CSV-Export, Statistik |
| `campaigns.ts` | Kampagnen CRUD + Fortschritt |
| `donations.ts` | Spenden CRUD + KPIs (inkl. `is_recurring`-Filter, `sepa`-Provider, server-seitige Sortierung) |
| `recurring-donations.ts` | Daueraufträge: Liste (paginiert, sortierbar, suchbar), KPIs, Spender-Übersicht, Kündigen, CSV-Export, Cleanup |
| `members.ts` | Mitglieder CRUD + sendDonationReceiptByEmail + Superadmin-Filter + **`changePassword()` (Re-Auth via separater PB-Instanz, Rate-Limit 5/10min, Audit `password.change`)** |
| `stripe-connect.ts` | Connect-Status (Mode, Health, Capability-Status, Requirements, Last-Sync) |
| `newsletter.ts` | email_outbox CRUD |
| `email.ts` | Gebühren-Erinnerungsmails |
| `invites.ts` | Einladungen CRUD + Token-Validierung + **E-Mail-Versand** |
| `dashboard.ts` | Dashboard KPI-Aggregation |
| `settings.ts` | Einstellungen (Branding, Gebetszeiten, Defaults, Madrasa, Kontaktformular, **Finanzen** inkl. `getFeatureFlags.finance_enabled`, **Mitgliedsbeiträge** `getMembershipFeeSettings`/`updateMembershipFeeSettings`) |
| `finance-events.ts` | Finanz-Event-Emission (einziger Schreibpfad, UNIQUE-Idempotenz) |
| `finance-domain.ts` | Domain-Orchestrator: `createIncome`, `refundIncome`, `createManualTransaction`, `stornoTransaction` — drei öffentliche Entry-Points (Lint-Gate gegen direkte Emit-Calls) |
| `finance.ts` | Report-Layer: `getLedgerAtoms`/`getFinanceKPIs`/`getEUR`/`getJahresbericht`/`getKassenbericht`/`updateTransactionNote` + 4 XLSX-Exporte (`exportBuchungenXLSX`/`exportEURXLSX`/`exportKassenberichtXLSX`/`exportKomplettXLSX`) + `suggestTransactionCategory` (KI) + UI-Wrapper mit Permission-Guard |
| `student-fees.ts` | Madrasa-Gebühren — inkl. `markStudentFeePaidAndEmit` (Sprint 5) für income_received-Event-Emission bei mark-paid |
| `sponsors.ts` | Förderpartner — inkl. `markSponsorPaidAndEmit` (Sprint 5, Betrag × months_paid) |
| (`lib/ai/`) | `sanitize.ts` (Email/Tel/IBAN/Name vor jedem API-Call maskieren) + `categorize.ts` (Anthropic Haiku, graceful ohne Key, eine ID aus FINANCE_CATEGORIES erzwungen) |
| `audit.ts` | Audit-Log lesen (paginiert) |
| `academic-years.ts` | Schuljahre CRUD |
| `courses.ts` | Madrasa-Kurse CRUD |
| `enrollments.ts` | Kurseinschreibungen |
| `attendance.ts` | Anwesenheit (Bulk-Save, Statistik) |
| `students.ts` | Schüler CRUD + Bulk-Import (CSV/Excel) |
| `student-fees.ts` | Gebühren: Overview, Bulk-Erstellen, Markieren, Stripe, Mehrmonats-Zahlung |
| `sponsors.ts` | Förderpartner CRUD, Stripe Checkout, Contact-Suche, Laufzeit, Ablauf-Check |
| `team.ts` | Team/Leitung CRUD — Vorstandsmitglieder, Imam, Sekretariat mit Foto/Bio/Sortierung/Gruppe für Leitungs-Seite |
| `mosques.ts` | Moschee CRUD — Branding, Stripe-Config, Kontaktdaten, public_enabled-Flag (genutzt von Super-Admin + Settings) |
| `parent-child.ts` | Eltern-Kind-Verknüpfung (Junction-Table) — flexible n:m-Beziehung zwischen Users (Eltern) und Students (Kinder) inkl. Beziehungstyp (Vater/Mutter/Vormund) |
| `membership-fees.ts` | Mitgliedsbeiträge: `getMembershipFeeOverview`, `getMembershipConfigs`, `createPeriodFees`, `markMembershipFeePaid`, `markMembershipFeeWaived`, `upsertMembershipConfig` |

---

## 🗃️ PocketBase Collections (30)

| Collection | Beschreibung |
|---|---|
| `mosques` | Haupttenant (Branding, Koordinaten, Stripe-Connect: `stripe_account_id`, `stripe_charges_enabled`, `stripe_payouts_enabled`, `stripe_details_submitted`, `stripe_requirements_currently_due/eventually_due`, `payments_mode` (disabled/platform_legacy/connect_test/connect_live), `stripe_onboarded_at`, `stripe_last_synced_at`, `stripe_card_payments_status`, `stripe_sepa_debit_payments_status` (inactive/pending/active)) |
| `settings` | Einstellungen pro Moschee (inkl. `contact_*`, `team_visibility`, `recurring_donations_enabled`, `sepa_enabled`, **Gebetszeiten: `prayer_provider` (aladhan/diyanet/igmg/bosnian/mawaqit/off), `prayer_method`, `prayer_source_id` (Diyanet City-Id), `sabah_offset_minutes` (provider-unabhängig), `tune`**, **Finanzen: `finance_enabled` (Admin-Modul-Gate ≠ `public_finance_enabled`), `finance_hard_lock_until`, `kassenbuch_start_year`, `kassenbuch_bar_start_cents`, `kassenbuch_bank_start_cents`**) — **`ANTHROPIC_API_KEY` ist Env-only, nicht in settings** (graceful ohne Key) |
| `users` | Portal-Mitglieder (auth collection) |
| `posts` | Blog-Beiträge |
| `events` | Veranstaltungen (inkl. Wiederkehrend: `is_recurring`, `recurrence_type` etc.) |
| `event_registrations` | Gast- + Mitglieds-Anmeldungen |
| `donations` | Einzel-Spenden (inkl. `is_recurring`, `subscription_id`, `provider: sepa`, `status`: created/pending/paid/failed/**failed_expired**/refunded/cancelled/external/disputed, **`payment_method_detail`** card/sepa_debit, **Finanz-Lock: `is_financially_locked`, `financial_locked_at`, `refund_amount_cents`/`refunded_at`/`refund_reason`/`refund_provider_ref`**) |
| `stripe_events` | Webhook-Idempotenz (unique `event_id`, `type`, `api_version`, `account_id`, `mosque_id`, `received_at`/`processed_at`, `status` received/processed/failed, `payload_hash` sha256, `payload_preview` nur Test-Mode) |
| `recurring_subscriptions` | Daueraufträge — `status` (pending/active/cancelled/abandoned), `amount_cents`, `donor_*`, `provider_subscription_id`, `current_period_end`, `last_payment_status`, `cancel_at_period_end`, `provider_ref`, `donor_name` |
| `campaigns` | Spendenaktionen |
| `campaign_contributions` | Spenden einer Kampagne |
| `email_outbox` | Ausgehende Emails (Queue) |
| `invites` | Einladungslinks (Token, Rollen, Max-Uses, E-Mail-Feld) |
| `audit_logs` | Audit-Trail aller CRUD-Ops |
| `prayer_times_cache` | Gebetszeiten-Kalender-Cache — Key-Präfixe `<YYYY-MM>` (AlAdhan, TTL 24h), `diyanet-<cityId>-<YYYY-MM>` (offizielle Diyanet-Tabelle, TTL 7d), `mawaqit-…`; Stale-Fallback bei Quellfehler |
| `academic_years` | Schuljahre für Madrasa |
| `courses` | Madrasa-Kurse |
| `students` | Schüler (Kinder, ohne Portal-Account) |
| `course_enrollments` | Kurseinschreibungen |
| `attendance` | Anwesenheitserfassung + Leistungsbewertung (`performance` 1–5 Skala je Session) |
| `student_fees` | Monatliche Madrasa-Gebühren |
| `sponsors` | Förderpartner (Name, Logo, Kontakt-User, Stripe, Laufzeit, Erinnerung) |
| `contact_messages` | Per-Moschee Kontaktnachrichten |
| `team_members` | Team/Leitung-Einträge (Vorstand, Imam, Sekretariat) — Foto, Bio, Rolle, Sortierung, Gruppe |
| `parent_child_relations` | Eltern-Kind-Verknüpfung (Junction-Table) — n:m zwischen Users und Students inkl. Beziehungstyp (Vater/Mutter/Vormund) |
| `finance_source_events` | Append-only Event-Log (Finanz-Wahrheit) — `source_event_key` UNIQUE (event-type-abhängige Formel), `event_type`, `classification` (denormalisiert), `betrag_cents`, `kategorie`, `konto_typ`, `occurred_at`, `payload_json` (Zod-strict), Refund-Felder (Sprint 5) |
| `transactions` | Manuelle Buchungen (immutable) — `buchungsdatum`, `betrag_cents`, `typ`, `classification`, `kategorie`, `beleg_nummer` UNIQUE `(mosque_id, beleg_nummer)`, `beleg_datei`+`beleg_datei_sha256`, `konto_typ`, `quelle` (manuell/storno), `storno_of`, `is_storno`, `interne_notiz` (einzige editierbare Spalte) |
| `finance_sequences` | Belegnummer-Hint-Counter pro `(mosque_id, year)` UNIQUE (`next_number`; harte Garantie = UNIQUE auf transactions, kein atomares Inkrement) |
| `membership_fees` | Beitragszeilen (mosque_id, user_id, period_key, amount_cents, status open/pending/paid/failed/waived, payment_method cash/transfer/stripe/waived, source, notes) — UNIQUE `(mosque_id, user_id, period_key)` |
| `membership_fee_configs` | Per-Mitglied-Konfiguration (mosque_id, user_id, amount_cents, interval monthly/quarterly/yearly, active, exempt) — UNIQUE `(mosque_id, user_id)` |

---

## 📋 Mögliche nächste Schritte (Priorisierung)

### P1 — Hohe Priorität

| Feature | Beschreibung | Aufwand |
|---|---|---|
| ~~**Stripe Connect**~~ | ✅ Erledigt (Session 26) — Express-Accounts, Direct Charges, signed state-tokens, Capability-Tracking, Daily-Sync, Webhook-Account-Resolution | — |
| ~~**SEPA-Lastschrift produktiv**~~ | ✅ Erledigt (Session 26) — unified flow Demo+Connect, kein isDemo-Branch mehr, sepaAvailable()-Enforcement, Pending-Cleanup mit Stripe-Recheck, Finalizer | — |
| **Live-Mode-Switch für Pilot-Moschee** | `sk_live_*` keys, Webhook-Endpoint registrieren, echtes Connect-Onboarding (1-3 Werktage), erste Echt-Spende verifizieren | S |
| ~~**Admin: Schüler ↔ Eltern verknüpfen**~~ | ✅ Erledigt — flexibles Junction-Table-System direkt im Bearbeiten-Dialog | — |
| ~~**Gebühren: CSV-Export**~~ | ✅ Erledigt — 9 Felder, kursfilterbar, client-seitig in Gebühren-Übersicht | — |

### P2 — Mittlere Priorität (UX-Verbesserungen)

| Feature | Beschreibung | Aufwand |
|---|---|---|
| **Events: Warteliste** | Wenn max_participants erreicht → Warteliste | M |
| ~~**Öffentliche Gebetszeiten-Seite**~~ | ~~`/[slug]/gebetszeiten` — volle Monatsansicht~~ — gestrichen | — |
| **Member: Profil-Bild** | Upload + Anzeige im Profil | S |
| **Dashboard-Widgets konfigurierbar** | Admin wählt welche Widgets öffentlich sichtbar sind | M |
| ~~**Spenden: Wiederkehrende Spenden**~~ | ✅ Erledigt (Session 24–25) — vollständige Implementierung inkl. Stripe Subscription, Webhook (5 neue Cases), Admin-UI, Member-UI, Spender-Übersicht, MRR-KPIs, CSV-Export | — |

### P3 — Niedrige Priorität / Nice-to-have

| Feature | Beschreibung | Aufwand |
|---|---|---|
| **Push-Notifications** | Web Push API für Member (neue Events, Posts) | L |
| ~~**Schüler: Leistungsbewertung (1–5 Skala)**~~ | ✅ Erledigt — `attendance.performance` Feld, PerformanceStats-Komponente mit Trend-Detection, Eltern sehen Durchschnitt | — |
| **Schüler: Vollständiges Notensystem** | Halbjahres-Zeugnisse, separates Gradebook getrennt von Anwesenheit, Aggregation pro Schuljahr | L |
| **Multi-Moschee Super-Admin Dashboard** | Plattform-Ebene: alle Moscheen verwalten | XL |
| **2FA** | TOTP für Admins | M |
| **Dark Mode** | Tailwind dark: Klassen aktivieren | M |
| **Spendenbescheinigung: PDF** | Automatisch generierte PDF-Quittung via React-PDF | M |
| **SEPA Multi-Retry Mail-Throttle** | Stripe macht 3× Retry bei Recurring SEPA → aktuell 3 User-Mails. Throttle auf 1/24h pro Donation | S |
| **Admin SEPA-Toggle Auszahlungen-Tab** | UI-Toggle für `settings.sepa_enabled` (aktuell hardcoded true) | S |
| **platform_legacy SEPA Sunset** | Nach Connect-Migration aller Moscheen `PLATFORM_SEPA_ENABLED=false`, Hard-Cutoff | S |

---

## 🔧 Bekannte technische Schulden

| Problem | Betroffen | Priorität |
|---|---|---|
| Pre-existing TS-Warnungen | `app/(auth)/admin/madrasa/[id]/page.tsx`, `admin/madrasa/schuljahre/page.tsx`, `admin/mitglieder/page.tsx` | Niedrig |
| `logAudit` call nutzt `collection`/`recordId` statt `entityType`/`entityId` in älteren Settings-Funktionen | `lib/actions/settings.ts` | Niedrig |
| `members` Legacy Collection leer — kann aufgeräumt werden | PocketBase | Niedrig |
| Stripe API Version `2024-06-20` — jetzt via `STRIPE_API_VERSION` env-konfigurierbar | `lib/stripe/client.ts` | Niedrig |
| `ActionResult<T>` Interface in 16+ Action-Dateien dupliziert | Alle `lib/actions/*.ts` | Niedrig |
| Phone-Normalisierung 3× identisch kopiert | `lib/actions/students.ts:158`, `:226`, `:289` | Niedrig |
| Webhook synchron (inline-Verarbeitung mit Idempotenz) — bei >100 Events/Min auf async-Worker umstellen | `app/api/stripe/webhook/route.ts` | Niedrig |
| Multi-Retry-Mail-Spam bei Recurring SEPA (3× Retry → 3 User-Mails) — throttle auf 1/24h/Donation | `lib/stripe/finalize.ts` | Niedrig |
| platform_legacy SEPA = deprecated, Sunset nach Connect-Migration aller Moscheen | `lib/stripe/client.ts#sepaAvailable` | Niedrig |
| Subscription-Migration: bestehende Plattform-Subs lassen sich nicht zum Connected Account verschieben — bei Hard-Cutoff canceln + neu anlegen | Dokumentation | Niedrig |

---

## 🔍 Qualitätsprüfung (Stand: 2026-04-27)

### Internationalisierung (i18n) — 🟡 Gut, 6 Verstöße

| # | Datei | Problem | Fix |
|---|-------|---------|-----|
| 1 | `components/madrasa/MemberStudentForm.tsx:490` | `locale === "tr" ? "İptal" : "Abbrechen"` statt i18n | `{t("common.cancel")}` |
| 2 | `components/team/TeamMemberForm.tsx:193` | `"Wird gespeichert..."` / `"Speichern"` hardcoded | `t("common.saving")` / `t("common.save")` |
| 3 | `app/error.tsx:21-26` | Hardcoded `"Etwas ist schiefgelaufen"` | `useTranslations("errors")` |
| 4 | `app/loading.tsx` | Hardcoded `"Wird geladen..."` | i18n-Key |
| 5 | Alle `lib/actions/*.ts` | Error-Return-Strings auf Deutsch hardcoded | `await getTranslations("errors")` |
| 6 | `app/(auth)/admin/audit/page.tsx:~71` | `"Ja"` / `"Nein"` hardcoded | `t("common.yes")` / `t("common.no")` |

Fehlende Keys (in `de.json` + `tr.json` ergänzen):
```json
{ "common": { "yes": "Ja", "no": "Nein", "saving": "Wird gespeichert...", "cancel": "Abbrechen" } }
```

### PWA / UI-Konsistenz — 🟡 Gut, 3 Lücken

| Problem | Fix |
|---------|-----|
| Kein wiederverwendbares `EmptyState`-Component — überall ad-hoc | `components/shared/EmptyState.tsx` erstellen |
| `Skeleton` nur auf Audit-Seite genutzt, fehlt in allen Listen | In `EventCard`, `PostCard`, `CampaignCard` einbauen |
| `public/manifest.json` hardcoded `"lang": "de"` | Feld entfernen |

### Audit-Log-Qualität — 🟡 Gut, 1 strukturelles Problem

**Entity-IDs sind raw UUIDs** — nicht lesbar für Menschen (`audit/page.tsx:306` zeigt `log.entity_id` direkt).

Fix: optionalen `entityLabel`-Parameter zu `logAudit()` hinzufügen:
```typescript
// lib/audit.ts
interface AuditLogParams { entityLabel?: string; } // z.B. "Max Mustermann"
// Anzeige: log.entity_label || log.entity_id
```
Außerdem: `audit_logs` Collection um Feld `entity_label` (text, optional) erweitern.

---

## 📊 Fortschritt-Übersicht

```
Fundament & Infrastruktur    ████████████ 100%
Öffentliches Portal           ████████████ 100%
Admin-Panel (Core)            ████████████ 100%
Madrasa-Modul                 ████████████ 100%
Förderpartner-Modul           ████████████ 100%
Kontaktformular-Modul         ████████████ 100%
Member-Bereich                ████████████ 100%
Zahlungen                     ████████████ 100%
Security                      ████████████ 100%
Mehrsprachigkeit (DE/TR)      ████████████ 100%
E-Mail-Infrastruktur          ████████████ 100%
Finanzmodul (Phase 1)         ████████████ 100%  (Sprint 1–6 ✅)
```

**Gesamt: 100% der V1-Kernfunktionen implementiert** · Finanzmodul Phase 1 vollständig (Refund/Chargeback, XLSX-Steuerberater-Export, optionale KI-Kategorisierung, 7 granulare Permissions, Datenschutz §8, fee/sponsor-Refund-Webhook-Backref)

---

## 🚀 Empfohlener nächster Sprint

**Ziel: Pilot-Moschee live schalten** (Stripe Live-Mode)

1. **Stripe Live-Keys** in `.env.local` setzen (`sk_live_*`, neuer `STRIPE_WEBHOOK_SECRET` für Live-Endpoint)
2. **STRIPE_DEFAULT_CONNECT_MODE=connect_live** in Env
3. Pilot-Moschee-Admin durch echtes Connect-Onboarding (Verifizierung 1-3 Werktage)
4. 1 € Echt-Spende auf eigenes Konto → Auszahlung prüfen
5. Live gehen

System ist produktionsbereit. Stripe Connect + SEPA-Lastschrift vollständig implementiert und auf `halim.moschee.app` im Test-Modus verifiziert.

**Finanzmodul Phase 1 abgeschlossen** — alle 6 Sprints fertig. Phase-2-Module sind
**bedarfsgetrieben** (kein vorauseilender Bau). Trigger-Matrix siehe
`FINANCE-SPRINT-PLAN.md` §8. Beispiele:
- **DATEV-Export / SKR03/04** — Trigger: Steuerberater lehnt XLSX-Export ab
- **Kontenplan + doppelte Buchführung** (`finance_accounts`, `transaction_entries`) — Trigger: Soll/Haben-Buchungssätze gefordert
- **Period-Closing** (`finance_period_closures`) — Trigger: Vereinsprüfung + Soft-Lock-Bypass
- **Versionierter Export** (`finance_exports` + SHA-256) — Trigger: Anti-Tampering gefordert
- **Atomares Sequenz-Inkrement / version-CAS** — Trigger: Belegnummer-Race real in Logs
- **Event-Storno** — Trigger: falsch emittiertes Event nicht via Refund korrigierbar

---

## 📝 Abgeschlossene Sessions

| Session | Inhalt |
|---|---|
| 1–7 | Fundament, Auth, öffentliches Portal, Admin-Core, Zahlungen, Security |
| 8 | Schüler-Collection (students), Madrasa-Einschreibungen |
| 9 | Anwesenheits-Statistiken (AttendanceStats-Komponente) |
| 10 | CSV/Excel Schüler-Import (StudentImportDialog, xlsx) |
| 11 | Invite-System (Token, Admin-UI, Registrierungsflow) |
| 12 | Gebetszeiten-Provider (AlAdhan, PB-Cache, TuneOffsets) |
| 13 | Madrasa-Gebühren (student_fees, Stripe, Member-Tab) + Wiederkehrende Events |
| 14 | Demo-System (seed-demo.mjs, DemoBanner, Limit-Checks) |
| 15–17 | Diverse Bugfixes, Admin-Polishing, KPI-Kacheln + Diagramme, Vater/Mutter-Selektoren |
| **18** | **Vollständige Mehrsprachigkeit DE/TR** — ~1050 neue Übersetzungsschlüssel |
| **19** | **E-Mail-Infrastruktur vollständig** — Resend.com (DKIM/SPF/DMARC), PB-SMTP, Cron email_outbox, Stripe Webhook, Spendenbescheinigung per E-Mail |
| **20** | **Förderpartner-Modul vollständig** — sponsors Collection, Admin-CRUD, Stripe-Checkout, Mehrmonats-Zahlung, Förderpartner-Tab Member, Cron-Job 21./Monat, Erinnerungs-Indikator |
| **21** | **Per-Moschee Kontaktformular** — contact_messages Collection, 4 Settings-Felder, API-Route mit Rate-Limit/Honeypot/Demo-Guard, Admin-Settings-Tab, E-Mail-Templates, i18n; Header-Fix (Registrieren-Button auf Root-Domain) |
| **22** | **Passwort-Reset via Resend**, Demo-Reset Cron (wöchentlich), SEPA-Lastschrift-Toggle (Demo), Stripe-Gebühren-Wahl + Transparenzhinweis, Anwesenheitsstatistiken im Eltern-Profil (Member-Profil), pb_auth Cookie auf Root-Domain fix, Subdomain-Routing verbessert |
| **23** | **Bugfixes + Security** — Mobile Overflow-Fix (grid-cols-1), Superadmin-Schutz (unsichtbar + nicht löschbar), Invite-Mail (automatischer E-Mail-Versand bei Einladung), Admin-Notif nur an aktive User, Demo-Banner Datenschutzhinweis, BFCache-Guard + Cookie-Logout-Fix (members-only Inhalte nach Logout), Header-Nav-Links komplett gefixt (RESERVED_PATHS, Subdomain-Erkennung für alle *.moschee.app, Race-Condition-Guard im MosqueContext), team_visibility im Header, pb_auth Cookie speichert status+role |
| **24** | **Wiederkehrende Spenden (Kern)** — `recurring_subscriptions` Collection + Migration (3 Settings-Felder, 6 Sub-Felder, erweitertes Status-Enum), `create-subscription` API-Route (Stripe Checkout mode=subscription, Duplicate-Guard 409, Turnstile, Rate-Limit), Webhook: 5 neue Cases (`checkout.session.completed` Subscription-Branch, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated/deleted`, `charge.dispute.created`), `lib/actions/recurring-donations.ts` (Admin-Liste, KPIs, Spender-Übersicht, Kündigen, CSV-Export, Cleanup), Admin-Settings RecurringDonationsTab, Dashboard MRR-KPI, Donation-Form (Einmalig/Monatlich Toggle), Member-Profil (MyRecurringSubscriptions), Admin Spenden: KPI-Cards + Badge + Filter, Abonnements-Seite, Spender-Übersicht-Seite, `PaymentHealthBadge`, `RecurringBadge`, `normalize-email.ts`, Seed-Daten (3 Demo-Abos), i18n ~80 neue Keys |
| **25** | **Recurring-Bugfixes + UX-Polish** — Sortierbare Spalten (Spenden, Abonnements, Spender-Übersicht), SEPA statt PayPal in Seed + Filter + Types + Migration, Webhook-Idempotenz-Fix (`last_payment_status` blieb „pending" wenn Donation bereits existierte), Suche in Spender-Übersicht (client-seitig, Name+Email), Suche in Daueraufträge (server-seitig), „→ Mitglied"-Link in Abonnements + Spender-Übersicht, Spendenhistorie in Mitglied-Detail: Typ-Badge (Allgemein/Kampagne/Dauerauftrag), PaymentHealthBadge: i18n (DE/TR), Label-Fix „Aktiv bis" → „Nächste Abbuchung am", MRR → „Abo-Einnahmen/Mo", Audit-Log: ~25 fehlende Übersetzungs-Keys ergänzt, Demo-Reset-Button: SEPA statt PayPal |
| **Finanz-Sprint 1** | **Storage-Layer** — Collections `finance_source_events`/`transactions`/`finance_sequences` + Quell-Lock-Felder, `getFinancePB`, `emitFinanceEvent` (UNIQUE-Idempotenz), Sweeper-Grundgerüst. Commits `e405d98`, `3bd8447` |
| **Finanz-Sprint 2** | **Projection + Donation→Event** — `toLedgerAtom`(event)/`toSignedAmount`/`assertEventIntegrity`, `canWrite`-Lock-Policy, `createIncome` scharf (beide paid-Pfade manuell+Stripe-Webhook), `FINANCE_CATEGORIES` (15) + `mapDonationToEUR`, `audit_logs.context_json`, Recon/Replay. Commit `b654305` |
| **Finanz-Sprint 3** | **Manuelle Buchungen + Storno + Sequencer** — `createManualTransaction`+`stornoTransaction` scharf, `lib/finance-sequence.ts` (Belegnummer UNIQUE-Retry), `toLedgerAtom`(Transaction)+`assertTransactionIntegrity`, `updateTransactionNote` (note-only), `settings.finance_hard_lock_until`, Beleg-Upload MIME+5MB+SHA-256, Demo-Limit. Commit `dee7cd2` |
| **Finanz-Sprint 4** | **Finanz-UI + Reports** — `/admin/finanzen` (Kassenbuch/EÜR/Berichte/Kassenbericht/Einstellungen, gated `finance_enabled`), `getLedgerAtoms`/`getFinanceKPIs`/`getEUR`/`getJahresbericht`/`getKassenbericht` (EIN Lade-Pfad → KPI==Σ atoms; geteilter Carryover-Helper Anfang N=Ende N−1), `components/finance/*` (Tabelle+Mobile-Card+Dialog+recharts), Rollen-Guard (`finance-permissions.ts`), 4 settings-Felder (`finance_enabled`, `kassenbuch_start_year/bar/bank`), Storno-Datum in Original-Periode (V-A), i18n DE+TR, 4 neue Tests. Commits `00df5eb`, `2317e60` |
| **Finanz-Sprint 5** | **Refund/Chargeback + fees/sponsors Hooks** — `refundIncome` scharf (Parent-Lookup, Sum-Guard Best-Effort, Lock-Drift-Check, idempotent via UNIQUE auf `source_event_key` mit `external_event_id`), M5-Guard entfernt (`createIncome` akzeptiert donations+student_fees+sponsors), `markStudentFeePaidAndEmit`+`markSponsorPaidAndEmit` mit Helpers (`fees-finance-helpers.ts`, `sponsors-finance-helpers.ts`), Stripe `charge.refunded` (payment_intent-Lookup + invoice-Fallback + Loop pro Refund) + `charge.dispute.created` (Chargeback-Event), Webhook student_fees/sponsors mark-paid in 5 Branches, Backfill-Sweeper refund-Branch SCHARF (Σ-Diff + Fallback-Key), Recon 6 Buckets bidirektional, UI lila Erstattung/Rückbuchung-Badge (Desktop+Mobile), 8 neue Tests + i18n DE+TR + Demo-Seed. Commit `91f6f56`. **Lücke nach Sprint 5:** fee/sponsor-Refund via Webhook fand Quelle nicht (Madrasa-Bug, behoben in Sprint 6) |
| **Finanz-Sprint 6** | **Polish — Phase 1 abgeschlossen** — (A) **XLSX-Steuerberater-Export** 4 Server-Actions (Buchungen/EÜR/Kassenbericht/Komplett), eigener Lade-Pfad ohne UI-Cap, base64→Download, feste Sortierung. (B) **KI-Kategorisierung** Anthropic Haiku (`claude-haiku-4-5` mit Fallback `claude-3-5-haiku-latest`), `lib/ai/sanitize.ts` maskiert Email/Tel/IBAN/Name vor jedem Call, `lib/ai/categorize.ts` ruft API, Button im BuchungErfassen-Dialog (nie Auto-Submit), Audit nur Metadaten (kein Klartext), graceful ohne `ANTHROPIC_API_KEY`. (C) **7 granulare Permissions** (`finance_view`/`create`/`storno`/`export`/`settings`/`ai_use`/`audit_view`), an admin/super_admin/treasurer gebunden, server-seitig in jeder Action geprüft. (D) **Datenschutz §8** Anthropic PBC + EU-SCC + sanitisierte Datenflüsse + Opt-out, DE+TR. (E) **Demo-Polish** `finance_enabled=true`, Anfangsbestände (Bar 100€/Bank 2500€), Mehrjahr-Buchungen, Storno-Beispiel, Events für ALLE paid fees/sponsors. (F) **fee/sponsor-Refund-Backref** Source-Resolver donation→fee/sponsor via `stripe.checkout.sessions.list({payment_intent})` — **behebt Madrasa-Refund-Bug aus Sprint 5**, fee_multi bleibt manuell. (G) **Beleg-Download-Härtung** `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` (Stored-XSS-Schutz). **+ Recon-Fix:** refunded/disputed Donations bleiben im received-Bucket (korrektes Double-Entry). 3 neue Tests. Commit `465ebe5`. **🎉 Phase 1 abgeschlossen.** |
| **27** | **Gebetszeiten-Überarbeitung** (Juni 2026) — (1) **Drift behoben**: AlAdhan `method=13` ist astronomische Näherung ≠ offizielle Diyanet-Tabelle → variabler Drift. Neuer **tabellen-basierter Provider** `lib/prayer/diyanet.ts` scrapt die offizielle Diyanet-Seite `namazvakitleri.diyanet.gov.tr` (kein Account, kein Rate-Limit), mappt alle Zeiten 1:1 inkl. offiziellem İmsak + Hijri (kein Shuruk−30, keine TZ-Konvertierung), 7-Tage-PB-Cache + Stale-Fallback. Multi-Verband-Struktur: Provider-Enum (`diyanet`/`igmg`/`bosnian` vorbereitet), generische `prayer_source_id`, **Dispatch-Map** in `lib/prayer/index.ts` (neuer Verband = neues Modul + 1 Eintrag). Admin-UI: Provider-Radio + bedingte Felder (City-Id nur Tabellen-Provider, Methode/Koordinaten nur AlAdhan). Commit `983a9bf`. (2) **Tune-Fix**: Tabellen-Provider ignorieren `tune` — Alt-AlAdhan-Offsets (z.B. Fajr +43) hatten offizielle Zeiten verfälscht. Commit `7d41150`. (3) **Provider-unabhängiger Sabah-Offset** `settings.sabah_offset_minutes` (Default −30, zentral aus `sunrise` abgeleitet, eigenes Admin-Feld). Commit `b66bcbc`. (4) **Live-Countdown zum nächsten Gebet** (HH:MM:SS) — Portal-Widget (`NextPrayerCountdown`, server-korrigierte Uhr, Auto-Refresh nur bei Übergang) + TV-Rail (`PrayerHeader`, client-seitig). Commit `6fd574f`. Migrationen idempotent; i18n DE+TR. |
| **26** | **Stripe Connect + SEPA produktiv (komplett)** — (1) **Passwort-Änderung im Profil**: PasswordChangeSection + EmailChangeSection in eigenen Dateien, `changePassword()` Server-Action mit Re-Auth in separater PB-Instanz, Rate-Limit 5/10min, Audit, Login-Toast bei `?reason=password_changed`, zentrale `MIN_PASSWORD_LENGTH`. (2) **Halim-Test-Moschee** angelegt via `scripts/create-mosque-halim.mjs`. (3) **Stripe Connect (Express, Direct Charges)**: 9 mosques-Felder + `stripe_events`-Collection + Backfill, `lib/stripe/{client,connect,idempotency,finalize}.ts` Service-Layer, HMAC-signed state-tokens für Onboarding-Return, Race-Safe Account-Create, `payments_mode`-Enum (disabled/platform_legacy/connect_test/connect_live), 5 Admin-API-Routes (start/refresh/return/dashboard/sync) + Daily-Sync-Cron, Auszahlungen-Tab im Admin mit Mode-Badge + Health-Banner + Status-Cards + Requirements-Liste, Webhook umgestellt auf Connect-Account-Resolution via `event.account` + Idempotenz via `stripe_events` + neue Cases `account.updated`/`application.deauthorized`/`mandate.updated`/`payment_intent.payment_failed`, Stripe-Fix: `transfers` Capability bei `card_payments` Pflicht. (4) **PB v0.23-Migration**: `_superusers`-Auth statt legacy `/api/admins/` (Compat-Token wird nicht mehr als Superuser akzeptiert). (5) **SEPA produktiv (unified)**: Demo-Gate entfernt, identischer Code-Pfad Demo+Connect, `sepa_enabled` Settings-Feld + Backfill, Per-Capability-Status (`stripe_card_payments_status`, `stripe_sepa_debit_payments_status`), `sepaAvailable()` Helper (Server-Authority, Env-Flag `PLATFORM_SEPA_ENABLED` für platform_legacy), Capability-Staleness-Anzeige (fresh/stale/very_stale), DonationForm-Selector Karte/SEPA mit Test-IBAN-Hint vs Live-Hint, Duplicate-Guard (nur `created`-Status, nicht `pending`), Idempotency-Key `donation:${id}` kombiniert mit `stripeAccount`. (6) **Zentraler Finalizer**: `finalizeSuccessfulPayment()` aus exakt 2 Quellen (checkout_async + invoice_paid), `finalizeFailedPayment()` mit SEPA-Failure-Email-Template (Retry-CTA + expired-Tooltip), strikt-pending-Semantik (keine Folgeaktionen bei `payment_status="unpaid"`). (7) **Cleanup-Pending-Cron**: täglich 5 Uhr, Stripe-Recheck (cs_*/in_*/pi_*) bevor `failed_expired` — succeeded → Finalizer (verpasste Webhooks gerettet). (8) **Payment-Method-Detail**: `donations.payment_method_detail` (card/sepa_debit), Quelle-Spalte im Admin zeigt jetzt „Stripe (Karte)" vs „Stripe (SEPA)". |
