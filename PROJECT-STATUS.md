# Moschee-Portal — Projektstatus (Stand: März 2026, Session 21)

## Tech-Stack
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn/ui (12 Komponenten)
- **Backend:** PocketBase (Hetzner VPS, Germany) — ältere Version < 0.23
- **Payments:** Stripe (Test-Mode), SEPA-Lastschrift
- **APIs:** AlAdhan (Gebetszeiten), Cloudflare Turnstile (CAPTCHA)

---

## ✅ Vollständig implementierte Features

### Fundament
| Feature | Dateien |
|---|---|
| Multi-Tenant Portal (Slug-basiert) | `lib/resolve-mosque.ts`, `app/[slug]/layout.tsx` |
| Auth (Admin/Member/Teacher/Imam) | `lib/auth-context.tsx`, `app/login`, `app/register` |
| PocketBase Admin Client (Singleton) | `lib/pocketbase-admin.ts` |
| Env-Validation (Zod) | `lib/env.ts` |
| Security (CSP, HSTS, Rate-Limiting, Turnstile) | `next.config.mjs`, `lib/rate-limit.ts`, `lib/turnstile.ts` |
| Audit-Logging | `lib/audit.ts`, `lib/actions/audit.ts`, `app/(auth)/admin/audit` |
| Health-Check API | `app/api/health/route.ts` |
| PocketBase Backup-Script | `scripts/backup-pocketbase.sh` |
| Migration-Script (idempotent) | `scripts/migrate-v1.mjs` |
| **Mehrsprachigkeit (DE/TR)** | `messages/de.json`, `messages/tr.json`, `i18n/routing.ts`, alle Admin- + Member-Seiten |

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
| Impressum, Datenschutz, AGB | `app/impressum`, `app/datenschutz`, `app/agb` |
| **Globales Kontaktformular** (`moschee.app/kontakt`) | `app/kontakt/page.tsx`, `app/api/contact/route.ts`, `components/contact/ContactForm.tsx` |
| **Per-Moschee Kontaktformular** (`[slug]/kontakt`) | `app/[slug]/kontakt/page.tsx`, `app/api/[slug]/contact/route.ts` |

### Admin-Panel (`/admin/...`)
| Feature | Dateien |
|---|---|
| Dashboard (KPI-Tiles) | `app/(auth)/admin/page.tsx`, `lib/actions/dashboard.ts` |
| Beiträge (CRUD, Kategorien, Sichtbarkeit) | `app/(auth)/admin/posts/` |
| Veranstaltungen (CRUD, Anmeldungen, CSV-Export, **Wiederkehrend**) | `app/(auth)/admin/events/` |
| Spenden (Liste, manuell erfassen, Stripe-Status) | `app/(auth)/admin/spenden/` |
| Kampagnen (CRUD, Fortschritt SUM-basiert) | `app/(auth)/admin/kampagnen/` |
| Mitglieder (Liste, Detail) | `app/(auth)/admin/mitglieder/` |
| Newsletter (email_outbox) | `app/(auth)/admin/newsletter/` |
| Einladungen (erstellen, kopieren, widerrufen) | `app/(auth)/admin/invites/` |
| Audit-Log (paginiert, gefiltert) | `app/(auth)/admin/audit/` |
| Einstellungen (Branding, Gebetszeiten, Defaults, **Madrasa**, **Kontaktformular**) | `app/(auth)/admin/settings/` |
| **Madrasa: Schuljahre, Kurse, Einschreibungen** | `app/(auth)/admin/madrasa/` |
| **Madrasa: Anwesenheit + Statistiken** | `app/(auth)/admin/madrasa/[id]/attendance/` |
| **Madrasa: Gebühren (Bar/Überweisung/Erlassen)** | `app/(auth)/admin/madrasa/gebuehren/` |
| **Förderpartner (CRUD, Stripe, Kontakt, Laufzeit, Erinnerungs-Indikator)** | `app/(auth)/admin/foerderpartner/` |

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
| **Förderpartner-Tab (nur für verknüpfte Kontakte, Stripe-Zahlung)** | `app/(auth)/member/profile/` (Tab) |
| Spendenbescheinigung (Drucken + **Per E-Mail senden**) | `app/(auth)/member/spendenbescheinigung/` |

### E-Mail-Infrastruktur
| Komponente | Beschreibung |
|---|---|
| **Resend.com** | Transaktionale E-Mails (noreply@mail.moschee.app), Domain verifiziert (DKIM, SPF, DMARC) |
| **PocketBase SMTP** | smtp.resend.com:587 (StartTLS) für Passwort-Reset + Verifizierungsmails |
| **Email Queue** | `email_outbox` Collection → `GET/POST /api/email/process-queue` (CRON_SECRET) |
| **Cron-Job** | Alle 5 Min: `curl https://moschee.app/api/email/process-queue` via Linux-Crontab |
| **Stripe Webhook** | `checkout.session.completed` → Spendenbestätigungs-Mail |
| **E-Mail-Templates** | 9 HTML-Templates: Newsletter, Event-Bestätigung, Gebühren-Erinnerung, Admin-Notiz, Spendenquittung, Jahresbescheinigung, Sponsor-Ablauferinnerung, **Kontakt-Benachrichtigung (Admin)**, **Kontakt-Auto-Reply (Absender)** |
| **Cron: Sponsor-Erinnerungen** | Jeden 21. des Monats: ablaufende Sponsors per E-Mail erinnern (`app/api/cron/sponsor-reminders/`) |

### API-Endpunkte
| Endpunkt | Zweck |
|---|---|
| `POST /api/[slug]/donations/stripe/create-checkout` | Stripe Checkout für Spenden |
| `POST /api/[slug]/events/[id]/register-guest` | Gast-Anmeldung zu Events |
| `GET/POST /api/[slug]/invite/[token]` | Einladungs-Token validieren + registrieren |
| `POST /api/stripe/webhook` | Stripe Webhooks (Spenden + Gebühren + **Förderpartner**) |
| `GET /api/cron/sponsor-reminders` | Sponsor-Ablauferinnerungen senden (Bearer Auth, Cron 21./Monat) |
| `GET/POST /api/email/process-queue` | E-Mail-Queue verarbeiten (Cron + manuell) |
| `GET /api/health` | Health-Check |
| `POST /api/contact` | Globales Kontaktformular (moschee.app, speichert in `inquiries`) |
| `POST /api/[slug]/contact` | **Per-Moschee Kontaktformular** (Rate-Limit, Honeypot, IP-Hash, Demo-Guard, speichert in `contact_messages`) |

### Server Actions (`lib/actions/`)
| Action-File | Zuständig für |
|---|---|
| `posts.ts` | Beiträge CRUD |
| `events.ts` | Events CRUD, Anmeldungen, CSV-Export, Statistik |
| `campaigns.ts` | Kampagnen CRUD + Fortschritt |
| `donations.ts` | Spenden CRUD + KPIs |
| `members.ts` | Mitglieder CRUD + **sendDonationReceiptByEmail** |
| `newsletter.ts` | email_outbox CRUD |
| `email.ts` | Gebühren-Erinnerungsmails |
| `invites.ts` | Einladungen CRUD + Token-Validierung |
| `dashboard.ts` | Dashboard KPI-Aggregation |
| `settings.ts` | Einstellungen (Branding, Gebetszeiten, Defaults, Madrasa, **Kontaktformular**); `updateContactSettings()`, `getFeatureFlags()` (team/sponsors/**contact**) |
| `audit.ts` | Audit-Log lesen (paginiert) |
| `academic-years.ts` | Schuljahre CRUD |
| `courses.ts` | Madrasa-Kurse CRUD |
| `enrollments.ts` | Kurseinschreibungen |
| `attendance.ts` | Anwesenheit (Bulk-Save, Statistik) |
| `students.ts` | Schüler CRUD + Bulk-Import (CSV/Excel) |
| `student-fees.ts` | Gebühren: Overview, Bulk-Erstellen, Markieren, Stripe, **Mehrmonats-Zahlung** |
| `sponsors.ts` | Förderpartner CRUD, Stripe Checkout, Contact-Suche, Laufzeit, Ablauf-Check |

---

## 🗃️ PocketBase Collections (20)

| Collection | Beschreibung |
|---|---|
| `mosques` | Haupttenant (Branding, Koordinaten, Stripe-Config) |
| `settings` | Einstellungen pro Moschee (inkl. `contact_enabled`, `contact_email`, `contact_notify_admin`, `contact_auto_reply`) |
| `users` | Portal-Mitglieder (auth collection) |
| `posts` | Blog-Beiträge |
| `events` | Veranstaltungen (inkl. Wiederkehrend) |
| `event_registrations` | Gast- + Mitglieds-Anmeldungen |
| `donations` | Einzel-Spenden |
| `campaigns` | Spendenaktionen |
| `campaign_contributions` | Spenden einer Kampagne |
| `email_outbox` | Ausgehende Emails (Queue) |
| `invites` | Einladungslinks (Token, Rollen, Max-Uses) |
| `audit_logs` | Audit-Trail aller CRUD-Ops |
| `prayer_times_cache` | AlAdhan-Monatskalender Cache (TTL 24h) |
| `academic_years` | Schuljahre für Madrasa |
| `courses` | Madrasa-Kurse |
| `students` | Schüler (Kinder, ohne Portal-Account) |
| `course_enrollments` | Kurseinschreibungen |
| `attendance` | Anwesenheitserfassung |
| `student_fees` | Monatliche Madrasa-Gebühren |
| `sponsors` | Förderpartner (Name, Logo, Kontakt-User, Stripe, Laufzeit, Erinnerung) |
| `contact_messages` | Per-Moschee Kontaktnachrichten (mosque_id, name, email, message, inquiry_type, ip_address SHA-256) |

---

## 📋 Mögliche nächste Schritte (Priorisierung)

### P1 — Hohe Priorität (fehlende Kernfunktionen)

| Feature | Beschreibung | Aufwand |
|---|---|---|
| **Admin: Schüler ↔ Eltern verknüpfen** | Admin soll einem bestehenden Portal-User als `parent_id` zuweisen können (aktuell nur bei Schüler-Erstellung) | S |
| **Gebühren: CSV-Export** | Admin kann Gebühren-Übersicht als CSV/Excel exportieren | S |
| **Invite-Mail** | Einladungslink per E-Mail versenden (aktuell nur Link kopieren) | S |
| **Stripe Connect** | Getrennte Auszahlungen pro Moschee für Pilot-Betrieb | M |

### P2 — Mittlere Priorität (UX-Verbesserungen)

| Feature | Beschreibung | Aufwand |
|---|---|---|
| **Events: Warteliste** | Wenn max_participants erreicht → Warteliste | M |
| **Öffentliche Gebetszeiten-Seite** | `/[slug]/gebetszeiten` — volle Monatsansicht, Tages-Widget | S |
| **Member: Profil-Bild** | Upload + Anzeige im Profil | S |
| **Dashboard-Widgets konfigurierbar** | Admin wählt welche Widgets öffentlich sichtbar sind | M |
| **Spenden: Wiederkehrende Spenden** | Stripe Subscriptions für monatliche Daueraufträge | L |

### P3 — Niedrige Priorität / Nice-to-have

| Feature | Beschreibung | Aufwand |
|---|---|---|
| **Push-Notifications** | Web Push API für Member (neue Events, Posts) | L |
| **Schüler: Noten-/Leistungserfassung** | Zusätzlich zur Anwesenheit | L |
| **Multi-Moschee Super-Admin** | Plattform-Ebene: alle Moscheen verwalten | XL |
| **2FA** | TOTP für Admins | M |
| **PWA-Verbesserungen** | Offline-Seiten, App-Icon, Service Worker | M |
| **Dark Mode** | Tailwind dark: Klassen aktivieren | M |
| **Spendenbescheinigung: PDF** | Automatisch generierte PDF-Quittung via React-PDF | M |

---

## 🔧 Bekannte technische Schulden

| Problem | Betroffen | Priorität |
|---|---|---|
| Pre-existing TS-Fehler | `app/(auth)/admin/page.tsx`, `enrollments.ts`, `members.ts`, `students.ts`, `mosque-context.tsx` | Niedrig |
| `logAudit` call in `updateBrandingSettings` / `updatePrayerSettings` / `updateDefaultSettings` nutzt `collection`/`recordId` statt `entityType`/`entityId` | `lib/actions/settings.ts` (ältere Funktionen) | Niedrig |
| `members` Legacy Collection leer — kann aufgeräumt werden | PocketBase | Niedrig |
| Stripe API Version `2024-06-20` — bei PB-Update ggf. aktualisieren | `app/api/stripe/webhook/route.ts` | Niedrig |
| Invite-Mail fehlt (Link nur kopierbar, kein E-Mail-Versand) | `app/(auth)/admin/invites/` | Mittel |

---

## 📊 Fortschritt-Übersicht

```
Fundament & Infrastruktur    ████████████ 100%
Öffentliches Portal           ████████████ 100%
Admin-Panel (Core)            ████████████ 100%
Madrasa-Modul                 ████████████ 100%
Förderpartner-Modul           ████████████ 100%
Kontaktformular-Modul         ████████████ 100%
Member-Bereich                ███████████░  98%  (Invite-Mail fehlt)
Zahlungen                     ████████████ 100%
Security                      ████████████ 100%
Mehrsprachigkeit (DE/TR)      ████████████ 100%
E-Mail-Infrastruktur          ███████████░  98%  (Invite-Mail ausstehend)
```

**Gesamt: ~99% der V1-Kernfunktionen implementiert**

---

## 🚀 Empfohlener nächster Sprint

**Ziel: Pilot-Moschee live schalten**

1. Invite-Mail — Einladungslinks direkt per E-Mail versenden (letztes fehlendes P1-Feature)
2. Gebühren: CSV-Export für Buchhaltung
3. Schüler ↔ Parent-Verknüpfung im Admin verbessern
4. Stripe Connect für Pilot-Moschee aktivieren (getrennte Auszahlungen)

Das System ist produktionsbereit — Förderpartner-Modul, Madrasa, E-Mails, Zahlungen und alle Kernfunktionen funktionieren. Nur noch Invite-Mail und Stripe Connect für den Pilot-Betrieb ausstehend.

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
| 15–17 | (diverse Bugfixes, Polishing, Admin-Einstellungen) |
| **18** | **Vollständige Mehrsprachigkeit DE/TR** — 19 Dateien, ~1050 neue Übersetzungsschlüssel: alle Admin-Seiten (newsletter, invites, audit, settings, madrasa, spenden, posts/new, events/new), Formular-Komponenten (PostForm, EventForm, CampaignForm, CourseForm, CreateInviteDialog), Listenseiten (Kategorie-/Status-Labels), Member-Profil (Monatsanzeige locale-aware) |
| **19** | **E-Mail-Infrastruktur vollständig in Betrieb** — Resend.com eingerichtet (Domain verifiziert: mail.moschee.app, DKIM/SPF/DMARC), PocketBase SMTP für Passwort-Reset/Verifikation, Cron-Job für email_outbox (alle 5 Min), Stripe Webhook für Spendenbestätigung, PocketBase als systemd-Dienst (Auto-Restart), CSP-Fix (`connect-src` Origin statt Pfad), JSON-Syntaxfehler in Übersetzungsdateien behoben, **Spendenbescheinigung per E-Mail** (neues Feature: `renderAnnualDonationReceipt`, `sendDonationReceiptByEmail`, E-Mail-Button auf Bescheinigungsseite) |
| **20** | **Förderpartner-Modul vollständig** — `sponsors` Collection (19. Collection), Admin-CRUD mit Kontaktfeldern (`contact_user_id`, `contact_email`), Laufzeit-Felder (Von/Bis im Dialog + auto-Berechnung via Stripe-Webhook), Kategoriefilter auf öffentlicher Seite, safeHref-Fix für Website-URLs, **Stripe-Checkout für Sponsors** (analog zu Schülergebühren), **Mehrmonats-Zahlung** (1/3/6/12 Monate) für Sponsors UND Madrasa-Gebühren, Förderpartner-Tab im Member-Profil (nur wenn als Kontakt hinterlegt), Erinnerungs-Indikator (Bell-Icon, `notification_sent`), Cron-Job am 21. jeden Monats (`/api/cron/sponsor-reminders`), E-Mail-Template für Ablauferinnerung, Mehrsprachigkeit DE/TR vollständig, VPS-Crontab konfiguriert |
| **21** | **Per-Moschee Kontaktformular + Header-Fix** — `contact_messages` Collection (20. Collection), 4 neue Settings-Felder (`contact_enabled`, `contact_email`, `contact_notify_admin`, `contact_auto_reply`), `app/[slug]/kontakt/page.tsx` (notFound wenn deaktiviert), `app/api/[slug]/contact/route.ts` (Rate-Limit `contact:${slug}:${ipHash}`, Honeypot, Demo-Guard, E-Mail-Fallback-Kette mit `console.warn`), Admin-Settings "Kontaktformular"-Tab (E-Mail-Validierung, Sub-Toggles), `ContactForm` erweitert (`apiPath?`, `mosqueName?`), E-Mail-Templates mit `mosqueName?` Parameter (Admin-Notif + Auto-Reply), i18n DE/TR `settings.contact.*` + `contact.success.messageNamed`, **Header-Fix**: "Registrieren"-Button auf Root-Domain `moschee.app` ausgeblendet (`{slug && <Link>}`) |
