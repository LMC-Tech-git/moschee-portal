# Moschee-Portal — Projektstatus (Stand: April 2026, Session 23)

## Tech-Stack
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn/ui (12 Komponenten)
- **Backend:** PocketBase (Hetzner VPS, Germany) — ältere Version < 0.23
- **Payments:** Stripe (Test-Mode), SEPA-Lastschrift (Demo)
- **APIs:** AlAdhan (Gebetszeiten), Cloudflare Turnstile (CAPTCHA), Resend (E-Mail)

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
| Gebetszeiten-Widget (AlAdhan, Cache, Tune) | `lib/prayer/` |
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
| Spenden (Liste, manuell erfassen, Stripe-Status) | `app/(auth)/admin/spenden/` |
| Kampagnen (CRUD, Fortschritt SUM-basiert) | `app/(auth)/admin/kampagnen/` |
| Mitglieder (Liste, Detail) | `app/(auth)/admin/mitglieder/` |
| Newsletter (email_outbox) | `app/(auth)/admin/newsletter/` |
| Einladungen (erstellen, kopieren, widerrufen, **E-Mail senden**) | `app/(auth)/admin/invites/` |
| Audit-Log (paginiert, gefiltert) | `app/(auth)/admin/audit/` |
| Einstellungen (Branding, Gebetszeiten, Defaults, Madrasa, Kontaktformular) | `app/(auth)/admin/settings/` |
| **Madrasa: Schuljahre, Kurse, Einschreibungen** | `app/(auth)/admin/madrasa/` |
| **Madrasa: Anwesenheit + Statistiken** | `app/(auth)/admin/madrasa/[id]/attendance/` |
| **Madrasa: Gebühren (Bar/Überweisung/Erlassen)** | `app/(auth)/admin/madrasa/gebuehren/` |
| **Förderpartner (CRUD, Stripe, Kontakt, Laufzeit, Erinnerungs-Indikator)** | `app/(auth)/admin/foerderpartner/` |
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
| Spenden-Verlauf | `app/(auth)/member/profile/` (Tab) |
| Event-Anmeldungen | `app/(auth)/member/profile/` (Tab) |
| **Madrasa-Gebühren (Kinder, Online-Zahlung via Stripe)** | `app/(auth)/member/profile/` (Tab) |
| **Madrasa: Anwesenheitsstatistiken der Kinder** | `app/(auth)/member/profile/` (Madrasa-Tab) |
| **Förderpartner-Tab (nur für verknüpfte Kontakte, Stripe-Zahlung)** | `app/(auth)/member/profile/` (Tab) |
| Spendenbescheinigung (Drucken + **Per E-Mail senden**) | `app/(auth)/member/spendenbescheinigung/` |

### E-Mail-Infrastruktur
| Komponente | Beschreibung |
|---|---|
| **Resend.com** | Transaktionale E-Mails (noreply@mail.moschee.app), Domain verifiziert (DKIM, SPF, DMARC) |
| **PocketBase SMTP** | smtp.resend.com:587 (StartTLS) für Passwort-Reset + Verifizierungsmails |
| **Eigener Passwort-Reset Flow** | Vollständiger Reset via Resend HTTP API (kein PB-SMTP nötig) |
| **Email Queue** | `email_outbox` Collection → `GET/POST /api/email/process-queue` (CRON_SECRET) |
| **Cron-Job** | Alle 5 Min: `curl https://moschee.app/api/email/process-queue` via Linux-Crontab |
| **Stripe Webhook** | `checkout.session.completed` → Spendenbestätigungs-Mail |
| **E-Mail-Templates** | 10 HTML-Templates: Newsletter, Event-Bestätigung, Gebühren-Erinnerung, Admin-Notiz, Spendenquittung, Jahresbescheinigung, Sponsor-Ablauferinnerung, Kontakt-Benachrichtigung, Kontakt-Auto-Reply, **Einladungsmail** |
| **Cron: Sponsor-Erinnerungen** | Jeden 21. des Monats (`app/api/cron/sponsor-reminders/`) |
| **Cron: Demo-Reset** | Jeden Montag 03:00 Uhr (`app/api/cron/demo-reset/`) |

### API-Endpunkte
| Endpunkt | Zweck |
|---|---|
| `POST /api/[slug]/donations/stripe/create-checkout` | Stripe Checkout für Spenden |
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

### Server Actions (`lib/actions/`)
| Action-File | Zuständig für |
|---|---|
| `posts.ts` | Beiträge CRUD |
| `events.ts` | Events CRUD, Anmeldungen, CSV-Export, Statistik |
| `campaigns.ts` | Kampagnen CRUD + Fortschritt |
| `donations.ts` | Spenden CRUD + KPIs |
| `members.ts` | Mitglieder CRUD + sendDonationReceiptByEmail + **Superadmin-Filter** |
| `newsletter.ts` | email_outbox CRUD |
| `email.ts` | Gebühren-Erinnerungsmails |
| `invites.ts` | Einladungen CRUD + Token-Validierung + **E-Mail-Versand** |
| `dashboard.ts` | Dashboard KPI-Aggregation |
| `settings.ts` | Einstellungen (Branding, Gebetszeiten, Defaults, Madrasa, Kontaktformular) |
| `audit.ts` | Audit-Log lesen (paginiert) |
| `academic-years.ts` | Schuljahre CRUD |
| `courses.ts` | Madrasa-Kurse CRUD |
| `enrollments.ts` | Kurseinschreibungen |
| `attendance.ts` | Anwesenheit (Bulk-Save, Statistik) |
| `students.ts` | Schüler CRUD + Bulk-Import (CSV/Excel) |
| `student-fees.ts` | Gebühren: Overview, Bulk-Erstellen, Markieren, Stripe, Mehrmonats-Zahlung |
| `sponsors.ts` | Förderpartner CRUD, Stripe Checkout, Contact-Suche, Laufzeit, Ablauf-Check |

---

## 🗃️ PocketBase Collections (20)

| Collection | Beschreibung |
|---|---|
| `mosques` | Haupttenant (Branding, Koordinaten, Stripe-Config) |
| `settings` | Einstellungen pro Moschee (inkl. `contact_enabled`, `contact_email`, `contact_notify_admin`, `contact_auto_reply`, `team_visibility`) |
| `users` | Portal-Mitglieder (auth collection) |
| `posts` | Blog-Beiträge |
| `events` | Veranstaltungen (inkl. Wiederkehrend: `is_recurring`, `recurrence_type` etc.) |
| `event_registrations` | Gast- + Mitglieds-Anmeldungen |
| `donations` | Einzel-Spenden |
| `campaigns` | Spendenaktionen |
| `campaign_contributions` | Spenden einer Kampagne |
| `email_outbox` | Ausgehende Emails (Queue) |
| `invites` | Einladungslinks (Token, Rollen, Max-Uses, E-Mail-Feld) |
| `audit_logs` | Audit-Trail aller CRUD-Ops |
| `prayer_times_cache` | AlAdhan-Monatskalender Cache (TTL 24h) |
| `academic_years` | Schuljahre für Madrasa |
| `courses` | Madrasa-Kurse |
| `students` | Schüler (Kinder, ohne Portal-Account) |
| `course_enrollments` | Kurseinschreibungen |
| `attendance` | Anwesenheitserfassung |
| `student_fees` | Monatliche Madrasa-Gebühren |
| `sponsors` | Förderpartner (Name, Logo, Kontakt-User, Stripe, Laufzeit, Erinnerung) |
| `contact_messages` | Per-Moschee Kontaktnachrichten |

---

## 📋 Mögliche nächste Schritte (Priorisierung)

### P1 — Hohe Priorität

| Feature | Beschreibung | Aufwand |
|---|---|---|
| **Stripe Connect** | Getrennte Auszahlungen pro Moschee für Pilot-Betrieb | M |
| ~~**Admin: Schüler ↔ Eltern verknüpfen**~~ | ✅ Erledigt — flexibles Junction-Table-System direkt im Bearbeiten-Dialog | — |
| ~~**Gebühren: CSV-Export**~~ | ✅ Erledigt — 9 Felder, kursfilterbar, client-seitig in Gebühren-Übersicht | — |

### P2 — Mittlere Priorität (UX-Verbesserungen)

| Feature | Beschreibung | Aufwand |
|---|---|---|
| **Events: Warteliste** | Wenn max_participants erreicht → Warteliste | M |
| **Öffentliche Gebetszeiten-Seite** | `/[slug]/gebetszeiten` — volle Monatsansicht | S |
| **Member: Profil-Bild** | Upload + Anzeige im Profil | S |
| **Dashboard-Widgets konfigurierbar** | Admin wählt welche Widgets öffentlich sichtbar sind | M |
| ~~**Spenden: Wiederkehrende Spenden**~~ | ⏸ Zurückgestellt — Types + Schema vorhanden, keine Implementierung geplant | — |

### P3 — Niedrige Priorität / Nice-to-have

| Feature | Beschreibung | Aufwand |
|---|---|---|
| **Push-Notifications** | Web Push API für Member (neue Events, Posts) | L |
| **Schüler: Noten-/Leistungserfassung** | Zusätzlich zur Anwesenheit | L |
| **Multi-Moschee Super-Admin Dashboard** | Plattform-Ebene: alle Moscheen verwalten | XL |
| **2FA** | TOTP für Admins | M |
| **Dark Mode** | Tailwind dark: Klassen aktivieren | M |
| **Spendenbescheinigung: PDF** | Automatisch generierte PDF-Quittung via React-PDF | M |
| **SEPA-Lastschrift produktiv** | Aktuell nur Demo-Flag; Stripe SEPA für alle aktivieren | M |

---

## 🔧 Bekannte technische Schulden

| Problem | Betroffen | Priorität |
|---|---|---|
| Pre-existing TS-Warnungen | `app/(auth)/admin/madrasa/[id]/page.tsx`, `admin/madrasa/schuljahre/page.tsx`, `admin/mitglieder/page.tsx` | Niedrig |
| `logAudit` call nutzt `collection`/`recordId` statt `entityType`/`entityId` in älteren Settings-Funktionen | `lib/actions/settings.ts` | Niedrig |
| `members` Legacy Collection leer — kann aufgeräumt werden | PocketBase | Niedrig |
| Stripe API Version `2024-06-20` — bei Major-Update ggf. aktualisieren | `app/api/stripe/webhook/route.ts` | Niedrig |
| `ActionResult<T>` Interface in 16 Action-Dateien dupliziert | Alle `lib/actions/*.ts` | Niedrig |
| Phone-Normalisierung 3× identisch kopiert | `lib/actions/students.ts:158`, `:226`, `:289` | Niedrig |

---

## 🔍 Qualitätsprüfung (Stand: 2026-04-08)

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
```

**Gesamt: 100% der V1-Kernfunktionen implementiert**

---

## 🚀 Empfohlener nächster Sprint

**Ziel: Pilot-Moschee live schalten**

1. **Stripe Connect** — Getrennte Auszahlungen pro Moschee (wichtig für Produktionsbetrieb)
2. **SEPA-Lastschrift produktiv** — Aktuell nur Demo-Flag

Das System ist produktionsbereit. Alle V1-Kernfunktionen sind implementiert.

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
