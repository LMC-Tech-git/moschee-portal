# CLAUDE.md — Projektregeln für moschee-portal

## Nach jeder Implementierung

Nach dem Abschließen einer Aufgabe **immer automatisch pushen** — ohne darauf gewartet zu werden.
Ablauf: `git add` (nur betroffene Dateien) → `git commit` → `git push`
Der User deployed dann selbst via `git pull && npm run build && pm2 restart moschee-portal` auf dem Server.

---

## Pflichtregeln bei jeder Änderung

### 1. Türkische Übersetzung mitpflegen
Bei jeder Textänderung (neue Labels, Fehlermeldungen, UI-Texte, Banner-Texte usw.) **immer beide Sprachdateien anpassen**:
- `messages/de.json` — Deutsch
- `messages/tr.json` — Türkisch

Kein Commit ohne beide Dateien, wenn Text geändert wurde.

### 3. Audit-Labels bei neuen Actions prüfen
Bei jeder neuen oder geänderten `logAudit({ action: "..." })`-Verwendung immer prüfen, ob ein Label in `messages/de.json` + `messages/tr.json` vorhanden ist:
- `audit.action.<action>` — Anzeige-Label für die Aktion
- `audit.entity.<entityType>` — Anzeige-Label für den Entity-Typ
- `audit.entityFilter.<entityType>` — Label für den Filter-Dropdown im Audit-Log

Fehlende Labels eintragen. Kein Commit ohne passende Labels für neue Actions.

### 4. Seed-Script bei neuen Feldern/Collections erweitern
Bei jedem neu hinzugefügten Feld oder jeder neuen Collection prüfen, ob `scripts/seed-demo-full.mjs` Beispieldaten dafür enthält. Falls nicht: Beispieldaten ergänzen, damit die Demo-Moschee repräsentativ befüllt bleibt.

### 2. Mobile / PWA mitdenken
Bei jeder UI-Änderung die mobile Darstellung mitberücksichtigen:
- Grid-Layouts brauchen `grid-cols-1` als Mobile-Basis (nicht nur `lg:grid-cols-X`)
- Buttons/Links müssen auf Touch-Geräten ausreichend groß sein
- Keine horizontalen Überläufe (`overflow-x`) einbauen
- PWA-Nutzer haben keinen Browser-Back-Button — Navigation muss im UI vorhanden sein

---

## Zugangsdaten & Konfiguration

Alle Secrets und URLs stehen in `.env.local` (nicht im Repo):
- `NEXT_PUBLIC_POCKETBASE_URL` — PocketBase URL (`http://91.98.142.128:8090`)
- `POCKETBASE_ADMIN_EMAIL` / `POCKETBASE_ADMIN_PASSWORD` — PocketBase Admin-Login
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — Stripe
- `RESEND_API_KEY` — E-Mail-Versand
- `CRON_SECRET` — Auth für Cron-Endpunkte
- `NEXT_PUBLIC_DEMO_MOSQUE_ID` — Demo-Moschee ID
- `NEXT_PUBLIC_ROOT_DOMAIN` — Root-Domain (`moschee.app`)
- `CLOUDFLARE_TURNSTILE_SECRET_KEY` — CAPTCHA

Keine Zugangsdaten im Code oder in Commit-Messages erwähnen.

---

## Projektstruktur (Kurzübersicht)

- `app/[slug]/` — Öffentliches Portal pro Moschee
- `app/(auth)/admin/` — Admin-Panel
- `app/(auth)/member/` — Member-Bereich
- `app/(auth)/lehrer/` — Lehrer-Panel
- `lib/actions/` — Server Actions (alle DB-Zugriffe)
- `lib/mosque-context.tsx` — Moschee-State (Client)
- `lib/pocketbase.ts` — PB Client-Singleton
- `lib/pocketbase-admin.ts` — PB Server-Admin (autoCancellation=false!)
- `messages/de.json` + `messages/tr.json` — Übersetzungen
- `types/index.ts` — Alle TypeScript-Typen
- `scripts/migrate-v1.mjs` — DB-Migration (idempotent)

---

## Wichtige Patterns

- **mosque_id** kommt IMMER vom Server, nie vom Client
- **getAdminPB()** für alle Admin-Ansichten (umgeht PB viewRule)
- **autoCancellation(false)** auf Server-PB-Singleton — Pflicht!
- **Zod v4**: `parsed.error.issues` (nicht `.errors`), `z.literal(true, { message: "..." })`
- **Map-Iteration**: `forEach` statt `for...of` (tsconfig kein `target`)
- **Donations**: `amount` (EUR) UND `amount_cents` immer beide Felder setzen
- **Demo-Limits**: Bei neuen Create-Actions `checkDemoLimit()` aus `lib/demo.ts` einbauen

---

## Server

- **VPS:** Hetzner, Ubuntu, Deutschland
- **PocketBase:** Version < 0.23 — Auth via `/api/admins/` (nicht `/api/collections/users/`)
- **PM2:** `pm2 restart moschee-portal`
- **Node.js lokal:** `C:\Program Files\nodejs\` (voller Pfad in Terminal nötig)
