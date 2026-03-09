# Security-Audit Report: Moschee-Portal

**Datum:** 2026-02-11
**Auditor:** Automatisierter Security-Audit (Claude)
**Projekt:** Moschee-Portal (Next.js 14 SaaS)
**Version:** 0.1.0
**Installierte Next.js-Version:** 14.2.35

---

## Zusammenfassung

| Schweregrad | Anzahl |
|-------------|--------|
| KRITISCH    | 3      |
| HOCH        | 5      |
| MITTEL      | 7      |
| NIEDRIG     | 4      |
| **Gesamt**  | **19** |

Das Projekt befindet sich in einem fruehen Entwicklungsstadium (v0.1.0). Viele Sicherheitsmechanismen sind noch nicht implementiert, was in der aktuellen Phase erwartbar, aber vor einem Produktivbetrieb zwingend zu beheben ist.

---

## 1. KRITISCHE Schwachstellen

### K-01: Fehlende Content-Security-Policy (CSP)
- **Schweregrad:** KRITISCH
- **Betroffene Datei:** `next.config.mjs` (Zeile 4-28)
- **Beschreibung:** Es fehlt ein `Content-Security-Policy`-Header. Ohne CSP besteht erhoehtes Risiko fuer XSS-Angriffe, da beliebige Skripte, Styles und Ressourcen von externen Quellen geladen werden koennen.
- **Vorhandene Header:**
  - `X-Frame-Options: DENY` (gut)
  - `X-Content-Type-Options: nosniff` (gut)
  - `Referrer-Policy: strict-origin-when-cross-origin` (gut)
  - `X-XSS-Protection: 1; mode=block` (veraltet, aber vorhanden)
- **Fehlende Header:**
  - `Content-Security-Policy`
  - `Strict-Transport-Security` (HSTS)
  - `Permissions-Policy`
- **Empfehlung:** Content-Security-Policy Header in `next.config.mjs` hinzufuegen:
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://api.stripe.com; frame-src https://js.stripe.com;
  ```
  Zusaetzlich `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` und `Permissions-Policy: camera=(), microphone=(), geolocation=()` hinzufuegen.

---

### K-02: Auth-Layout ohne Authentifizierungspruefung
- **Schweregrad:** KRITISCH
- **Betroffene Datei:** `app/(auth)/layout.tsx` (Zeile 1-8)
- **Beschreibung:** Das Auth-Layout (`(auth)`) enthaelt keinerlei Authentifizierungspruefung. Der Kommentar `// Hier wird spaeter die Auth-Pruefung implementiert` zeigt, dass dies geplant aber nicht umgesetzt ist. Jede Route unter `(auth)` ist ohne Login zugaenglich.
- **Code:**
  ```tsx
  export default function AuthLayout({ children }: { children: React.ReactNode }) {
    // Hier wird spaeter die Auth-Pruefung implementiert
    return <>{children}</>;
  }
  ```
- **Empfehlung:** Vor Produktivgang muss eine Authentifizierungspruefung implementiert werden. Server-seitig per `supabase.auth.getUser()` den Login-Status pruefen und nicht-authentifizierte Benutzer auf die Login-Seite umleiten.

---

### K-03: Middleware-Auth ist bedingt deaktiviert
- **Schweregrad:** KRITISCH
- **Betroffene Datei:** `middleware.ts` (Zeile 8-20)
- **Beschreibung:** Die Middleware-Auth-Pruefung wird nur aktiviert, wenn `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` gesetzt sind. Wenn diese Variablen fehlen oder leer sind, wird `NextResponse.next()` ohne jegliche Pruefung zurueckgegeben. In der aktuellen `.env.local` stehen nur Platzhalter-Werte (`your-project.supabase.co`), sodass die Auth-Middleware effektiv **deaktiviert** ist.
- **Code:**
  ```ts
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const { updateSession } = await import("@/lib/supabase/middleware");
    return await updateSession(request);
  }
  return NextResponse.next(); // <-- Komplett offen ohne Auth
  ```
- **Empfehlung:** Fuer den Produktivbetrieb sollte ein Fallback-Mechanismus implementiert werden, der bei fehlenden Credentials den Zugriff auf geschuetzte Routen blockiert, anstatt ihn zu erlauben.

---

## 2. HOHE Schwachstellen

### H-01: Keine Input-Validation auf der Spenden-Seite
- **Schweregrad:** HOCH
- **Betroffene Datei:** `app/(public)/spenden/page.tsx` (Zeile 61-66)
- **Beschreibung:** Das Spenden-Eingabefeld hat nur ein HTML-`min="1"`-Attribut, aber keine serverseitige Validierung. Es existiert kein Form-Handler, kein CSRF-Token und keine serverseitige Betragspruefung. Der "Jetzt spenden"-Button hat keine `onClick`-Logik.
- **Code:**
  ```tsx
  <input type="number" placeholder="Betrag" min="1"
    className="w-full rounded-lg border border-gray-300 px-4 py-3..." />
  ```
- **Empfehlung:** Vor Aktivierung der Stripe-Integration muss:
  1. Zod-Schema fuer Betragsvalidierung implementiert werden (Min/Max, nur positive Zahlen)
  2. Server Action oder API-Route mit serverseitiger Validierung erstellt werden
  3. CSRF-Schutz implementiert werden
  4. Rate-Limiting fuer Spenden-Requests eingebaut werden

---

### H-02: Kein Rate-Limiting auf API-Routes
- **Schweregrad:** HOCH
- **Betroffene Datei:** `app/api/health/route.ts` (Zeile 1-8)
- **Beschreibung:** Die Health-Check-API (und zukuenftige APIs) haben kein Rate-Limiting. Dies ermoeglicht DDoS-Angriffe und Brute-Force-Attacken.
- **Empfehlung:** Rate-Limiting-Middleware implementieren, z.B. mit `@upstash/ratelimit` oder einem eigenen Token-Bucket-Algorithmus. Mindestens fuer:
  - Auth-Endpoints (Login/Register): max. 5 Versuche/Minute
  - API-Endpoints: max. 100 Requests/Minute
  - Spenden-Endpoints: max. 10 Requests/Minute

---

### H-03: Diskrepanz zwischen package.json und package-lock.json
- **Schweregrad:** HOCH
- **Betroffene Datei:** `package.json` vs `package-lock.json`
- **Beschreibung:** Die `package-lock.json` enthaelt wesentlich mehr Dependencies als die `package.json`. Folgende Pakete sind in der Lock-Datei vorhanden, aber **nicht** in der package.json deklariert:
  - `@hookform/resolvers` (^5.2.2)
  - `@radix-ui/react-*` (diverse UI-Komponenten)
  - `class-variance-authority` (^0.7.1)
  - `clsx` (^2.1.1)
  - `date-fns` (^4.1.0)
  - `lucide-react` (^0.563.0)
  - **`pocketbase` (^0.26.8)** - Alternative Datenbank neben Supabase
  - `react-hook-form` (^7.71.1)
  - `sonner` (^2.0.7)
  - `tailwind-merge` (^3.4.0)
  - `zod` (^4.3.6)
- **Risiko:** Die package.json spiegelt nicht den tatsaechlichen Dependency-Baum wider. Insbesondere `pocketbase` als zusaetzliches Backend-System neben Supabase erhoecht die Angriffsflaeche und koennte auf eine inkonsistente Architektur hindeuten.
- **Empfehlung:** `package.json` mit dem tatsaechlichen Lock-File synchronisieren. Nicht benoetigte Dependencies entfernen. Pruefen ob PocketBase wirklich genutzt wird oder entfernt werden soll.

---

### H-04: PowerShell-Skripte enthalten hartcodierte Pfade
- **Schweregrad:** HOCH
- **Betroffene Dateien:** `build.ps1`, `dev.ps1`, `install.ps1` (jeweils Zeile 2)
- **Beschreibung:** Die PowerShell-Skripte enthalten hartcodierte Benutzerpfade mit dem vollstaendigen OneDrive-Unternehmenspfad:
  ```powershell
  Set-Location "C:\Users\hmei\OneDrive - awisto business solutions GmbH\Desktop\halim\cami-portal\moschee-portal"
  ```
  Dies legt den internen Benutzernamen (`hmei`), den Arbeitgeber (`awisto business solutions GmbH`) und die Unternehmens-OneDrive-Struktur offen.
- **Empfehlung:**
  1. Relative Pfade verwenden oder `$PSScriptRoot` nutzen
  2. Sensible Pfad-Informationen aus den Skripten entfernen
  3. Falls diese Skripte committed werden, sind Unternehmensinformationen oeffentlich sichtbar

---

### H-05: Fehlende CSRF-Schutzmaßnahmen
- **Schweregrad:** HOCH
- **Betroffene Dateien:** Gesamtes Projekt
- **Beschreibung:** Im gesamten Projekt gibt es keine CSRF-Token-Implementierung. Weder in der Middleware noch in API-Routes oder Formularen werden CSRF-Tokens verwendet. Next.js Server Actions bieten zwar eingebauten CSRF-Schutz, aber da aktuell keine Server Actions implementiert sind und die Formulare keine Handler haben, fehlt jeglicher Schutz.
- **Empfehlung:** Bei Implementierung der Formular-Logik Next.js Server Actions verwenden (haben eingebauten CSRF-Schutz) oder manuell CSRF-Tokens implementieren.

---

## 3. MITTLERE Schwachstellen

### M-01: Supabase Anon-Key als NEXT_PUBLIC exponiert
- **Schweregrad:** MITTEL
- **Betroffene Dateien:** `.env.local.example` (Zeile 8-9), `lib/supabase/client.ts` (Zeile 9-10)
- **Beschreibung:** Der Supabase Anon-Key wird als `NEXT_PUBLIC_SUPABASE_ANON_KEY` exponiert und ist damit im Client-Bundle sichtbar. Der Anon-Key ist zwar by-design fuer den oeffentlichen Zugriff gedacht, aber:
  - Ohne Row Level Security (RLS) in Supabase koennte ein Angreifer direkt auf die Datenbank zugreifen
  - Es gibt keine Anzeichen, dass RLS-Policies konfiguriert sind
- **Empfehlung:** Sicherstellen, dass in Supabase strenge Row Level Security (RLS) Policies fuer alle Tabellen aktiv sind. Den Anon-Key niemals fuer Operationen verwenden, die Admin-Rechte erfordern.

---

### M-02: Non-Null-Assertion (!) bei Environment Variables
- **Schweregrad:** MITTEL
- **Betroffene Dateien:**
  - `lib/supabase/client.ts` (Zeile 9-10)
  - `lib/supabase/server.ts` (Zeile 12-13)
  - `lib/supabase/middleware.ts` (Zeile 12-13)
- **Beschreibung:** Alle Supabase-Client-Initialisierungen verwenden den Non-Null-Assertion-Operator (`!`):
  ```ts
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ```
  Falls die Environment-Variablen nicht gesetzt sind, wuerde dies zu einem Runtime-Error fuehren, der moeglicherweise sensible Stack-Trace-Informationen preisgibt.
- **Empfehlung:** Validierung der Environment-Variablen beim App-Start implementieren, z.B. mit Zod:
  ```ts
  const envSchema = z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  });
  ```

---

### M-03: Fehlende Error-Boundary-Komponenten
- **Schweregrad:** MITTEL
- **Betroffene Dateien:** `app/layout.tsx`, `app/(public)/layout.tsx`, `app/(auth)/layout.tsx`
- **Beschreibung:** Es gibt keine `error.tsx` oder `global-error.tsx` Dateien im Projekt. Unbehandelte Fehler koennen sensible Informationen (Stack-Traces, Dateipfade, Umgebungsvariablen) an den Client leaken.
- **Empfehlung:** `error.tsx` und `global-error.tsx` Dateien erstellen, die benutzerfreundliche Fehlermeldungen anzeigen, ohne technische Details preiszugeben.

---

### M-04: Health-Endpoint exponiert Server-Timestamp
- **Schweregrad:** MITTEL
- **Betroffene Datei:** `app/api/health/route.ts` (Zeile 4-5)
- **Beschreibung:** Der Health-Check-Endpoint gibt den Server-Timestamp zurueck:
  ```ts
  { status: "ok", timestamp: new Date().toISOString() }
  ```
  Dies kann fuer Server-Timing-Angriffe oder Fingerprinting missbraucht werden.
- **Empfehlung:** In der Produktion den Timestamp entfernen oder nur fuer authentifizierte Admin-Requests bereitstellen.

---

### M-05: Fehlende Cookie-Sicherheitseinstellungen
- **Schweregrad:** MITTEL
- **Betroffene Datei:** `lib/supabase/middleware.ts` (Zeile 19-26)
- **Beschreibung:** Die Cookie-Optionen werden von Supabase SSR gesteuert, aber es gibt keine explizite Konfiguration fuer:
  - `SameSite`-Attribut
  - `Secure`-Flag
  - `HttpOnly`-Flag
  - Cookie-Praefixe (`__Host-` oder `__Secure-`)
- **Empfehlung:** Sicherstellen, dass Supabase-Cookies mit `SameSite=Lax`, `Secure=true` (in Produktion) und `HttpOnly=true` gesetzt werden. Die Supabase SSR-Bibliothek unterstuetzt Konfigurationsoptionen fuer Cookies.

---

### M-06: Keine robots.txt oder Security.txt
- **Schweregrad:** MITTEL
- **Betroffene Datei:** `public/` (Verzeichnis leer)
- **Beschreibung:** Es fehlen:
  - `robots.txt` - Suchmaschinen-Crawler koennen alle Seiten indexieren, auch solche die nicht oeffentlich sein sollen
  - `.well-known/security.txt` - Kein Kontaktpunkt fuer Sicherheitsforscher
  - `sitemap.xml` - Fehlende SEO-Grundlage
- **Empfehlung:** `robots.txt` erstellen, die geschuetzte Bereiche (z.B. `/admin`, `/dashboard`) blockiert. Eine `security.txt` mit Kontaktinformationen fuer verantwortungsvolle Offenlegung erstellen.

---

### M-07: Veralteter X-XSS-Protection Header
- **Schweregrad:** MITTEL
- **Betroffene Datei:** `next.config.mjs` (Zeile 22-25)
- **Beschreibung:** Der Header `X-XSS-Protection: 1; mode=block` ist veraltet und wird von modernen Browsern nicht mehr unterstuetzt. Er kann in manchen Faellen sogar XSS-Angriffe erleichtern.
- **Empfehlung:** Diesen Header entfernen oder auf `X-XSS-Protection: 0` setzen und stattdessen eine strikte Content-Security-Policy verwenden.

---

## 4. NIEDRIGE Schwachstellen

### N-01: Stripe Secret Key Platzhalter in .env-Dateien
- **Schweregrad:** NIEDRIG
- **Betroffene Dateien:** `.env.local.example` (Zeile 12), `.env.local` (Zeile 10)
- **Beschreibung:** Beide Dateien enthalten den Platzhalter `sk_test_your-secret-key-here` fuer den Stripe Secret Key. Aktuell sind keine echten Keys gespeichert. Die `.gitignore` schliesst `.env.local` korrekt aus.
- **Positive Aspekte:**
  - `.gitignore` enthaelt `.env`, `.env*.local`, `.env.local` (dreifache Absicherung)
  - `.env.local.example` enthaelt nur Platzhalter-Werte
  - Stripe Secret Key ist **nicht** als `NEXT_PUBLIC_` markiert (korrekt)
- **Empfehlung:** `.env.local.example` umbenennen zu `.env.example` (Best Practice). Sicherstellen, dass niemals echte API-Keys in die Example-Datei gelangen.

---

### N-02: Fehlende TypeScript-Strict-Null-Checks Nutzung
- **Schweregrad:** NIEDRIG
- **Betroffene Datei:** `tsconfig.json` (Zeile 6)
- **Beschreibung:** TypeScript `strict: true` ist aktiviert (gut), aber die Non-Null-Assertions (`!`) in den Supabase-Clients umgehen die Sicherheitsvorteile.
- **Empfehlung:** Non-Null-Assertions durch explizite Pruefungen oder Environment-Validierung ersetzen.

---

### N-03: Keine Pruefung auf veraltete Dependencies automatisiert
- **Schweregrad:** NIEDRIG
- **Betroffene Datei:** `package.json`
- **Beschreibung:** Es fehlt eine automatisierte Pruefung auf Sicherheitsupdates (z.B. Dependabot, Renovate, oder `npm audit` in CI/CD).
- **Empfehlung:** Dependabot oder Renovate in der GitHub-Konfiguration aktivieren. `npm audit` als CI/CD-Step einfuegen.

---

### N-04: Fehlende Loading/Not-Found-Seiten
- **Schweregrad:** NIEDRIG
- **Betroffene Dateien:** `app/` Verzeichnis
- **Beschreibung:** Es fehlen `loading.tsx` und `not-found.tsx` Dateien. Eine fehlende `not-found.tsx` kann dazu fuehren, dass die Standard-Next.js-404-Seite angezeigt wird, die Informationen ueber das Framework preisgeben kann.
- **Empfehlung:** Eigene `not-found.tsx` und `loading.tsx` Dateien erstellen.

---

## 5. DSGVO-Compliance Pruefung

| Aspekt | Status | Bemerkung |
|--------|--------|-----------|
| Datenschutzerklaerung | Vorhanden | `app/(public)/datenschutz/page.tsx` |
| Impressum | Vorhanden | `app/(public)/impressum/page.tsx` - Platzhalter-Daten |
| AGB | Vorhanden | `app/(public)/agb/page.tsx` |
| Cookie-Banner | FEHLT | Kein Cookie-Consent-Banner implementiert |
| Datenloeschung | Erwaehnt | In Datenschutzerklaerung erwaehnt, aber keine Funktion |
| Stripe-Hinweis | Vorhanden | Link zur Stripe-Datenschutzrichtlinie |
| Hosting-Info | Vorhanden | Vercel + Supabase EU-Frankfurt erwaehnt |
| Rechte der Betroffenen | Erwaehnt | Auskunft, Berichtigung, Loeschung |
| Datenschutzbeauftragter | FEHLT | Kein Datenschutzbeauftragter benannt |
| Verarbeitungsverzeichnis | FEHLT | Art. 30 DSGVO Verarbeitungsverzeichnis fehlt |

### DSGVO-Empfehlungen:
1. **Cookie-Consent-Banner** implementieren (trotz nur technisch notwendiger Cookies empfohlen)
2. **Impressum vervollstaendigen** - Platzhalter durch echte Daten ersetzen
3. **Datenschutzbeauftragten** benennen oder pruefen ob erforderlich (ab 20 Personen die regelmaessig personenbezogene Daten verarbeiten)
4. **Verarbeitungsverzeichnis** nach Art. 30 DSGVO erstellen
5. **Auftragsverarbeitungsvertraege (AVV)** mit Vercel, Supabase und Stripe abschliessen

---

## 6. Dependency-Analyse

### Installierte Versionen (aus package-lock.json):

| Paket | Version | Bekannte Probleme |
|-------|---------|-------------------|
| next | 14.2.35 | Pruefung auf CVEs empfohlen - Next.js 14.2.x hatte mehrere Sicherheitsupdates |
| stripe | 16.12.0 | Keine bekannten kritischen CVEs |
| react | 18.3.x | Stabil, keine bekannten CVEs |
| pocketbase | 0.26.8 | Nicht in package.json deklariert - Unklare Nutzung |
| eslint | 8.57.x | End-of-Life (ESLint 8 wird nicht mehr gewartet) |

### Empfehlungen:
1. `npm audit` regelmaessig ausfuehren
2. Next.js auf neueste 14.2.x-Patch-Version aktualisieren
3. ESLint auf Version 9.x aktualisieren (ESLint 8 ist EOL)
4. PocketBase-Abhaengigkeit klaeren oder entfernen
5. `@supabase/ssr` ist nicht in der package-lock.json zu finden - wird aber in `lib/supabase/` importiert. Dies koennte zu Runtime-Fehlern fuehren.

---

## 7. Positive Sicherheitsaspekte

Das Projekt hat bereits einige gute Security-Grundlagen:

1. **Grundlegende Security-Header** sind in `next.config.mjs` konfiguriert (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
2. **TypeScript mit strict-Mode** ist aktiviert (`tsconfig.json`)
3. **`.gitignore` ist umfassend** - alle `.env`-Varianten werden ausgeschlossen
4. **Stripe Secret Key ist nicht als NEXT_PUBLIC markiert** - wird korrekt nur serverseitig verwendet
5. **Server Components als Standard** - Die meisten Seiten sind Server Components (kein `"use client"` Directive), was die Angriffsflaeche reduziert
6. **Keine `dangerouslySetInnerHTML`-Nutzung** - kein XSS durch unsichere HTML-Einbettung
7. **Keine `eval()` oder `new Function()`** - keine Code-Injection-Vektoren
8. **Supabase EU-Region Frankfurt** - DSGVO-konformes Hosting der Datenbank
9. **Zod ist installiert** (in package-lock.json) - Schema-Validierung ist vorbereitet, aber noch nicht implementiert

---

## 8. Checkliste fuer zukuenftige Entwicklung

### Vor dem naechsten Sprint:
- [ ] Content-Security-Policy Header implementieren
- [ ] Strict-Transport-Security (HSTS) Header hinzufuegen
- [ ] Permissions-Policy Header hinzufuegen
- [ ] X-XSS-Protection Header entfernen oder auf `0` setzen
- [ ] `error.tsx` und `global-error.tsx` erstellen
- [ ] `not-found.tsx` erstellen
- [ ] `robots.txt` erstellen
- [ ] `security.txt` erstellen
- [ ] Environment-Variablen-Validierung mit Zod implementieren
- [ ] PowerShell-Skripte von hartcodierten Pfaden bereinigen
- [ ] package.json mit package-lock.json synchronisieren

### Vor dem Produktivgang:
- [ ] Authentifizierung im `(auth)`-Layout implementieren
- [ ] Middleware-Auth-Fallback fuer fehlende Credentials implementieren
- [ ] Rate-Limiting fuer alle API-Endpoints implementieren
- [ ] CSRF-Schutz implementieren (Server Actions verwenden)
- [ ] Input-Validierung mit Zod fuer alle Formulare
- [ ] Cookie-Sicherheitseinstellungen explizit konfigurieren
- [ ] Cookie-Consent-Banner implementieren
- [ ] Impressum mit echten Daten vervollstaendigen
- [ ] Row Level Security (RLS) in Supabase konfigurieren und testen
- [ ] npm audit in CI/CD-Pipeline integrieren
- [ ] Dependabot oder Renovate aktivieren
- [ ] Penetrationstest durchfuehren
- [ ] DSGVO-Verarbeitungsverzeichnis erstellen
- [ ] AVVs mit Dienstleistern (Vercel, Supabase, Stripe) abschliessen

### Regelmaessig:
- [ ] `npm audit` woechentlich ausfuehren
- [ ] Dependencies monatlich aktualisieren
- [ ] Security-Headers mit https://securityheaders.com testen
- [ ] SSL-Konfiguration mit https://www.ssllabs.com/ssltest/ pruefen
- [ ] OWASP ZAP oder aehnliche Tools fuer automatisierte Sicherheitstests nutzen

---

## 9. Gesamtbewertung

**Security-Score: 5/10**

Das Projekt hat eine solide Grundstruktur mit einigen guten Security-Entscheidungen (TypeScript strict, .gitignore, Server Components, keine XSS-Vektoren). Allerdings fehlen kritische Sicherheitsmechanismen wie Authentifizierung, CSP, Rate-Limiting und Input-Validierung.

**Prioritaeten:**
1. **Sofort:** Content-Security-Policy und fehlende Security-Headers (K-01)
2. **Sofort:** PowerShell-Skripte bereinigen (H-04) - Firmeninformationen sind exponiert
3. **Vor naechstem Feature:** Auth-Layout implementieren (K-02)
4. **Vor naechstem Feature:** Middleware-Fallback (K-03)
5. **Vor Stripe-Integration:** Input-Validierung und CSRF-Schutz (H-01, H-05)
6. **Vor Produktivgang:** Rate-Limiting, Cookie-Sicherheit, DSGVO-Vervollstaendigung

---

*Dieser Report wurde automatisch erstellt und ersetzt keine professionelle Sicherheitspruefung. Vor dem Produktivgang wird ein manueller Penetrationstest empfohlen.*
