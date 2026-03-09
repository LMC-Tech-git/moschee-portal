# Moschee-Portal

Die digitale Plattform für muslimische Gemeinden in Deutschland.

## Features

- **Spendenverwaltung** - Sichere Online-Spenden mit Stripe
- **Mitgliedersystem** - Digitale Verwaltung der Gemeindemitglieder
- **Ideenportal** - Ideen einreichen und gemeinsam abstimmen
- **Madrasa-Verwaltung** - Unterrichtspläne und Schülerverwaltung
- **Gebetszeiten** - Aktuelle Gebetszeiten für den Standort

## Tech-Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Backend:** Supabase (EU-Region Frankfurt)
- **Zahlungen:** Stripe
- **Deployment:** Vercel

## Setup

### Voraussetzungen

- Node.js 18+ ([Download](https://nodejs.org/))
- npm oder yarn
- Supabase Account ([supabase.com](https://supabase.com))
- Stripe Account ([stripe.com](https://stripe.com))

### Installation

1. **Repository klonen:**

   ```bash
   git clone <repository-url>
   cd moschee-portal
   ```

2. **Dependencies installieren:**

   ```bash
   npm install
   ```

3. **Umgebungsvariablen konfigurieren:**

   ```bash
   cp .env.local.example .env.local
   ```

   Fülle die Werte in `.env.local` aus:

   - `NEXT_PUBLIC_SUPABASE_URL` - Deine Supabase-Projekt-URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Dein Supabase Anon-Key
   - `STRIPE_SECRET_KEY` - Dein Stripe Secret Key
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Dein Stripe Publishable Key

4. **Entwicklungsserver starten:**

   ```bash
   npm run dev
   ```

   Öffne [http://localhost:3000](http://localhost:3000) im Browser.

## Projektstruktur

```
moschee-portal/
├── app/
│   ├── (auth)/          # Auth-geschützte Routes
│   ├── (public)/        # Öffentliche Routes
│   ├── api/             # API Routes
│   ├── globals.css      # Globale Styles
│   └── layout.tsx       # Root Layout
├── components/
│   ├── ui/              # UI Components (Buttons, Inputs, etc.)
│   └── shared/          # Geteilte Components (Header, Footer)
├── lib/
│   ├── supabase/        # Supabase Client (Browser + Server)
│   └── utils.ts         # Hilfsfunktionen
├── types/               # TypeScript Typ-Definitionen
└── public/              # Statische Dateien
```

## Scripts

| Befehl          | Beschreibung                    |
| --------------- | ------------------------------- |
| `npm run dev`   | Entwicklungsserver starten      |
| `npm run build` | Produktions-Build erstellen     |
| `npm run start` | Produktionsserver starten       |
| `npm run lint`  | ESLint Code-Prüfung ausführen   |

## Sicherheit

- Alle Umgebungsvariablen werden über `.env.local` verwaltet (nicht im Git)
- Security-Header sind in `next.config.mjs` konfiguriert
- Supabase Row Level Security (RLS) wird für alle Tabellen verwendet
- Stripe Webhooks werden serverseitig verifiziert
- Daten werden in der EU (Frankfurt) gespeichert

## Lizenz

Privat - Alle Rechte vorbehalten.
