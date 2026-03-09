# Moschee-Portal — Projektstatus (Stand: März 2026)

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

### Öffentliches Portal (`/[slug]/...`)
| Feature | Dateien |
|---|---|
| Dashboard (Gebetszeiten, Events, Posts, Kampagnen) | `app/[slug]/page.tsx` |
| Gebetszeiten-Widget (AlAdhan, Cache, Tune) | `lib/prayer/` |
| Beiträge / Blog | `app/[slug]/posts/` |
| Veranstaltungen + Gast-Anmeldung | `app/[slug]/events/` |
| Spenden-Seite (Stripe, SEPA, Kampagnen) | `app/[slug]/donate/`, `app/[slug]/campaigns/` |
| Einladungs-Registrierung | `app/[slug]/invite/[token]/` |
| Impressum, Datenschutz, AGB | `app/impressum`, `app/datenschutz`, `app/agb` |

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
| Einstellungen (Branding, Gebetszeiten, Defaults, **Madrasa**) | `app/(auth)/admin/settings/` |
| **Madrasa: Schuljahre, Kurse, Einschreibungen** | `app/(auth)/admin/madrasa/` |
| **Madrasa: Anwesenheit + Statistiken** | `app/(auth)/admin/madrasa/[id]/attendance/` |
| **Madrasa: Gebühren (Bar/Überweisung/Erlassen)** | `app/(auth)/admin/madrasa/gebuehren/` |

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
| Spendenbescheinigung | `app/(auth)/member/spendenbescheinigung/` |

### API-Endpunkte
| Endpunkt | Zweck |
|---|---|
| `POST /api/[slug]/donations/stripe/create-checkout` | Stripe Checkout für Spenden |
| `POST /api/[slug]/events/[id]/register-guest` | Gast-Anmeldung zu Events |
| `GET/POST /api/[slug]/invite/[token]` | Einladungs-Token validieren + registrieren |
| `POST /api/stripe/webhook` | Stripe Webhooks (Spenden + Gebühren) |
| `GET /api/health` | Health-Check |

### Server Actions (`lib/actions/`)
| Action-File | Zuständig für |
|---|---|
| `posts.ts` | Beiträge CRUD |
| `events.ts` | Events CRUD, Anmeldungen, CSV-Export, Statistik |
| `campaigns.ts` | Kampagnen CRUD + Fortschritt |
| `donations.ts` | Spenden CRUD + KPIs |
| `members.ts` | Mitglieder CRUD |
| `newsletter.ts` | email_outbox CRUD |
| `invites.ts` | Einladungen CRUD + Token-Validierung |
| `dashboard.ts` | Dashboard KPI-Aggregation |
| `settings.ts` | Einstellungen (Branding, Gebetszeiten, Defaults, Madrasa) |
| `audit.ts` | Audit-Log lesen (paginiert) |
| `academic-years.ts` | Schuljahre CRUD |
| `courses.ts` | Madrasa-Kurse CRUD |
| `enrollments.ts` | Kurseinschreibungen |
| `attendance.ts` | Anwesenheit (Bulk-Save, Statistik) |
| `students.ts` | Schüler CRUD + Bulk-Import (CSV/Excel) |
| `student-fees.ts` | Gebühren: Overview, Bulk-Erstellen, Markieren, Stripe |

---

## 🗃️ PocketBase Collections (18)

| Collection | Beschreibung |
|---|---|
| `mosques` | Haupttenant (Branding, Koordinaten, Stripe-Config) |
| `settings` | Einstellungen pro Moschee |
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

---

## 📋 Mögliche nächste Schritte (Priorisierung)

### P1 — Hohe Priorität (fehlende Kernfunktionen)

| Feature | Beschreibung | Aufwand |
|---|---|---|
| **E-Mail-Versand** | `email_outbox` ist vorhanden, aber kein Sender. Newsletter, Event-Bestätigung, Gebühren-Erinnerung per E-Mail | M |
| **Passwort zurücksetzen** | Forgot-Password Flow für Member (PocketBase hat das, aber kein UI) | S |
| **Admin: Schüler ↔ Eltern verknüpfen** | Admin soll einem bestehenden Portal-User als `parent_id` zuweisen können (aktuell nur bei Schüler-Erstellung) | S |
| **Gebühren: CSV-Export** | Admin kann Gebühren-Übersicht als CSV/Excel exportieren | S |

### P2 — Mittlere Priorität (UX-Verbesserungen)

| Feature | Beschreibung | Aufwand |
|---|---|---|
| **Gebühren: Erinnerungs-E-Mail** | Button "Erinnerung senden" an Eltern für offene Gebühren (braucht P1 E-Mail) | S |
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
| Pre-existing TS-Fehler | `app/(auth)/admin/page.tsx`, `CreateInviteDialog.tsx`, `enrollments.ts`, `members.ts`, `students.ts`, `mosque-context.tsx` | Niedrig |
| `logAudit` call in `updateBrandingSettings` / `updatePrayerSettings` / `updateDefaultSettings` nutzt `collection`/`recordId` statt `entityType`/`entityId` | `lib/actions/settings.ts` (ältere Funktionen) | Niedrig |
| `email_outbox` — kein tatsächlicher Versand implementiert | `lib/actions/newsletter.ts` | Mittel |
| `members` Legacy Collection leer — kann aufgeräumt werden | PocketBase | Niedrig |
| Stripe API Version `2024-06-20` — bei PB-Update ggf. aktualisieren | `app/api/stripe/webhook/route.ts` | Niedrig |

---

## 📊 Fortschritt-Übersicht

```
Fundament & Infrastruktur    ████████████ 100%
Öffentliches Portal           ████████████ 100%
Admin-Panel (Core)            ████████████ 100%
Madrasa-Modul                 ████████████ 100%
Member-Bereich                ██████████░░  85%  (E-Mail, Passwort-Reset fehlt)
Zahlungen                     ████████████ 100%
Security                      ████████████ 100%
E-Mail-Infrastruktur          ██░░░░░░░░░░  20%  (Queue vorhanden, Sender fehlt)
```

**Gesamt: ~90% der V1-Kernfunktionen implementiert**

---

## 🚀 Empfohlener nächster Sprint

**Ziel: E-Mail-Versand + UX-Polishing**

1. E-Mail-Versand via SMTP oder Resend.com (Queue bereits in `email_outbox`)
2. Passwort-Reset Flow (Forgot Password UI → PocketBase Auth)
3. Schüler ↔ Parent-Verknüpfung im Admin verbessern
4. Gebühren: CSV-Export für Buchhaltung

Diese 4 Punkte schließen die letzten "kritischen" Lücken für einen Produktivbetrieb.
