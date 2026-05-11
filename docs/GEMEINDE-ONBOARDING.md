# Gemeinde-Onboarding Checkliste

> Schritt-für-Schritt-Leitfaden für das Aufsetzen einer neuen Moschee-Gemeinde auf moschee.app.
> Halim durchläuft diese Checkliste bei jeder neuen Gemeinde — `halim.moschee.app` war der erste Testlauf.

---

## Inhaltsverzeichnis

0. [Vorgespräch mit Gemeinde](#0-vorgespräch-mit-gemeinde)
1. [Verträge & Rechtliches](#1-verträge--rechtliches)
2. [Versicherung (für Halim)](#2-versicherung-für-halim)
3. [Domain & DNS](#3-domain--dns)
4. [Stripe-Setup pro Gemeinde](#4-stripe-setup-pro-gemeinde)
5. [Spendenquittungen & Steuern](#5-spendenquittungen--steuern)
6. [Portal-Setup (PocketBase)](#6-portal-setup-pocketbase)
7. [Übergabe an Gemeinde](#7-übergabe-an-gemeinde)
8. [Smoke-Test vor Übergabe](#8-smoke-test-vor-übergabe)
9. [Cleanup / Reset (falls nötig)](#9-cleanup--reset-falls-nötig)
- [Anhang A: Vorlagen & Quellen](#anhang-a-vorlagen--quellen)
- [Anhang B: Subunternehmer (für AVV)](#anhang-b-subunternehmer-für-avv)
- [Anhang C: TOMs-Stichworte](#anhang-c-toms-stichworte)

---

## 0. Vorgespräch mit Gemeinde

Vor allem anderen klären:

- [ ] **Ansprechpartner:** Wer unterschreibt? (Vorstand / Imam / Geschäftsführer)
- [ ] **Rechtsform:** e.V. / KdöR / DİTİB-Untergliederung — wichtig für Vertrag & Stripe-KYC
- [ ] **Gewünschte Module:**
  - [ ] Gebetszeiten
  - [ ] Posts / Neuigkeiten
  - [ ] Veranstaltungen / Events
  - [ ] Spendenfunktion (Stripe)
  - [ ] Madrasa (Kurse, Schüler, Gebühren)
  - [ ] Mitgliederverwaltung
- [ ] **Erwartete Mitgliederzahl** (Kapazitätsplanung)
- [ ] **Wunsch-Subdomain** (z.B. `ditib-ulm.moschee.app`)
  - Prüfen: noch frei? (kein bestehender PB-Record mit diesem Slug)
- [ ] **Logo** vorhanden? (PNG, transparent, mind. 200×200px)
- [ ] **Brand-Farbe** (Hex-Code, z.B. `#1d6b38`)
- [ ] **Koordinaten** (Lat/Lng der Moschee — via Google Maps: Rechtsklick → "Was ist hier?")
- [ ] **Kontakt-Email + Telefon** der Gemeinde
- [ ] **Preismodell** vereinbaren: kostenlos / Spendenbasis / monatliche Gebühr
- [ ] **Starttermin** realistisch festlegen

---

## 1. Verträge & Rechtliches

> ⚠️ **VOR dem technischen Setup unterschreiben lassen!**

### 1.1 Hauptvertrag (Nutzungsvertrag)

Muss enthalten:
- [ ] Leistungsbeschreibung (welche Module, auf welcher Domain)
- [ ] SLA-Rahmen (z.B. "Best Effort", kein garantiertes Uptime-SLA für Kleinkunden)
- [ ] Laufzeit + Kündigungsfrist (z.B. 12 Monate, 3 Monate Frist)
- [ ] Preis + Zahlungsmodalitäten (jährlich im Voraus empfohlen)
- [ ] Datenexport-Anspruch bei Kündigung (DSGVO-Pflicht)
- [ ] Haftungsbeschränkung (besonders bei Spendenfunktion!)
- [ ] Änderungsvorbehalt (Halim kann Features weiterentwickeln)

### 1.2 Auftragsverarbeitungsvertrag (AVV / DPA)

**Pflicht nach Art. 28 DSGVO** — da Halim personenbezogene Daten der Gemeindemitglieder verarbeitet.

- [ ] AVV erstellen und beidseitig unterzeichnen
- [ ] Zweck + Datenarten benennen (Name, Email, Adresse, Zahlungsdaten)
- [ ] Subunternehmer-Liste beifügen (→ [Anhang B](#anhang-b-subunternehmer-für-avv))
- [ ] TOMs als Anhang beifügen (→ [Anhang C](#anhang-c-toms-stichworte))
- [ ] Weisungsrecht der Gemeinde (als Verantwortliche) dokumentieren
- [ ] Löschfristen vereinbaren (z.B. Mitgliederdaten 30 Tage nach Kündigung)

> Vorlagen: BITKOM AVV-Muster, eRecht24, LfDI-Muster (→ [Anhang A](#anhang-a-vorlagen--quellen))

### 1.3 Impressum & Datenschutzerklärung

- [ ] Gemeinde liefert eigenen Impressums-Text (V.i.S.d.P. = **Gemeinde**, nicht Halim)
- [ ] Datenschutzerklärung anpassen: Hosting bei Halim als Auftragsverarbeiter erwähnen
- [ ] Texte in PB/Admin-UI hinterlegen (oder als statische Seite — je nach Implementierung)
- [ ] Routes prüfen: `/impressum` und `/datenschutz` unter der Gemeinde-Domain erreichbar

---

## 2. Versicherung (für Halim)

> Einmalig abschließen — gilt für alle Gemeinden als Kunden.

- [ ] **Betriebs-/Berufshaftpflicht IT**
  - Deckt: Vermögensschäden durch Software-Ausfall, Fehler, Datenverlust
  - Mindestdeckung: 250.000 €
- [ ] **Cyber-Versicherung** mit Datenschutzbaustein
  - Deckt: DSGVO-Bußgelder, Forensik-Kosten, Krisen-PR bei Datenleck, Benachrichtigungskosten
  - Besonders wichtig wegen Mitglieder- und Zahlungsdaten

**Anbieter zum Vergleichen:**
- [exali.de](https://www.exali.de) — speziell IT-Freiberufler, günstig
- [Hiscox](https://www.hiscox.de) — IT-Berufshaftpflicht + Cyber
- [Markel](https://www.markel.com/de) — Cyber-Spezialversicherer
- [Allianz](https://www.allianz.de) — Cyberversicherung für Selbständige

**Kosten-Richtwert:** 30–80 €/Monat als Einzelanbieter (abhängig von Umsatz + Deckungssumme)

**Außerdem klären:**
- [ ] Steuerstatus: Kleinunternehmer (§ 19 UStG) oder Regelbesteuerung?
  - ELSTER-Fragebogen liegt im Projekt-Root: `ELSTER - FsE EUn - Fragebogen...`
- [ ] Gewerbe angemeldet? Pflicht sobald regelmäßige Einnahmen aus moschee.app.

---

## 3. Domain & DNS

> Einmalig für die gesamte Plattform — kein Extra-Schritt pro Gemeinde.

### 3.1 Wildcard-DNS einrichten

```
*.moschee.app  A  →  <Server-IP>   TTL 300
moschee.app    A  →  <Server-IP>   TTL 300
```

- [ ] Beim DNS-Provider (Cloudflare/Hetzner-DNS) eintragen
- [ ] Verifikation: `nslookup halim.moschee.app` → muss Server-IP zurückgeben
- [ ] Wildcard-TLS-Zertifikat einrichten (`*.moschee.app` via Let's Encrypt DNS-01 Challenge)
  - Caddy: `*.moschee.app` Wildcard direkt via Cloudflare-DNS-Provider möglich
  - certbot: `certbot certonly --dns-cloudflare -d *.moschee.app -d moschee.app`

### 3.2 Reverse-Proxy (pro Subdomain automatisch)

```nginx
# nginx Beispiel
server {
    listen 443 ssl;
    server_name *.moschee.app;
    ssl_certificate     /etc/letsencrypt/live/moschee.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/moschee.app/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

- [ ] Reverse-Proxy konfiguriert und aktiv
- [ ] HSTS-Header aktiv (bereits in `next.config.mjs`)

### 3.3 Pro-Gemeinde-Aktion

Nach einmaligem Wildcard-Setup: **keine DNS-Aktion mehr nötig** pro neuer Gemeinde.
Neuer Slug = sofort unter `<slug>.moschee.app` erreichbar (sobald PB-Record existiert).

---

## 4. Stripe-Setup pro Gemeinde

### 4.1 Variante A: Stripe Connect Express (empfohlen)

```
Halim (Plattform-Account) → Gemeinde (Connected Account)
Geldfluss: Zahler → Stripe → direkt auf Gemeinde-Bankkonto
Halim: sieht keinen Geldfluss, kein Geldwäsche-Risiko
```

- [ ] Halims Plattform-Account auf [dashboard.stripe.com](https://dashboard.stripe.com) → Connect aktivieren
- [ ] Onboarding-Link für Gemeinde generieren → Gemeinde registriert sich selbst
- [ ] Gemeinde braucht: Vereinsregisterauszug, Vorstand-Ausweise (KYC), IBAN

### 4.2 Variante B: Eigener Stripe-Account der Gemeinde

- [ ] Gemeinde legt selbst Account an
- [ ] Gemeinde gibt Halim Webhook-Zugang (oder trägt Keys selbst ins Portal ein)
- [ ] Mehr Support-Aufwand — nur wenn Gemeinde es so möchte

### 4.3 Checkliste je Variante

- [ ] **Webhook-Endpoint** in Stripe-Dashboard eintragen:
  ```
  https://<slug>.moschee.app/api/stripe/webhook
  ```
- [ ] **Webhook-Secret** (`STRIPE_WEBHOOK_SECRET`) → in `.env.local` auf Server (gilt server-weit)
- [ ] **Test-Modus** zuerst:
  - Testkarte: `4242 4242 4242 4242` — beliebiges Datum, CVC 3 Ziffern
  - Test-Spende durchführen → Prüfen ob in PB `donations` erscheint
- [ ] **Live-Modus** erst freischalten wenn Gemeinde bereit
- [ ] `stripe_account` (Connected Account ID) am `mosques`-Record in PB eintragen

### 4.4 Stripe für `halim.moschee.app`

- [ ] Eigenen Stripe-Test-Account anlegen unter [dashboard.stripe.com](https://dashboard.stripe.com)
- [ ] Im Test-Mode bleiben (kein Live-Betrieb für eigene Test-Gemeinde)
- [ ] Connect-ID am Mosque-Record nachtragen

---

## 5. Spendenquittungen & Steuern

- [ ] **Freistellungsbescheid** der Gemeinde anfordern (Pflicht für Zuwendungsbestätigungen)
  - Ohne Freistellungsbescheid: Gemeinde darf keine steuerlich abzugsfähigen Spendenquittungen ausstellen
- [ ] Klären: Spendenquittungen automatisch via Portal oder manuell durch Gemeinde?
  - Aktuell im Portal: **nicht implementiert** — Gemeinde stellt manuell aus
  - Bei Bedarf: Feature in Roadmap aufnehmen
- [ ] Betragsgrenzen beachten:
  - Bis 300 € Einzelspende: vereinfachter Verwendungsnachweis (Kontoauszug reicht)
  - Über 300 €: förmliche Zuwendungsbestätigung nötig

---

## 6. Portal-Setup (PocketBase)

> Alle Schritte im PocketBase-Admin-UI: `http://91.98.142.128:8090/_/`

### 6.1 Mosque-Record anlegen

Collection: `mosques`

| Feld | Wert |
|------|------|
| `slug` | z.B. `ditib-ulm` (URL-safe, lowercase, keine Leerzeichen) |
| `name` | Vollständiger Name der Gemeinde |
| `description` | Kurzbeschreibung (optional) |
| `city` | Stadt |
| `address` | Vollständige Adresse |
| `email` | Kontakt-Email der Gemeinde |
| `phone` | Telefonnummer |
| `latitude` | GPS-Koordinate (z.B. `48.3984`) |
| `longitude` | GPS-Koordinate (z.B. `9.9920`) |
| `timezone` | `Europe/Berlin` |
| `brand_primary_color` | Hex-Code (z.B. `#1d6b38`) |
| `public_enabled` | `true` |
| `stripe_account` | Connect-ID (später nachtragen) |

- [ ] Record gespeichert, ID notiert: `_______________`

### 6.2 Settings-Record anlegen

Collection: `settings`

| Feld | Wert |
|------|------|
| `mosque_id` | ID aus Schritt 6.1 |
| `prayer_provider` | `aladhan` (oder `off` wenn nicht gewünscht) |
| `prayer_method` | `13` (Diyanet — Standard für DE/TR-Gemeinden) |
| `donation_enabled` | `true` / `false` |
| `events_enabled` | `true` / `false` |
| `posts_enabled` | `true` / `false` |
| `madrasa_enabled` | `true` / `false` |
| `madrasa_fees_enabled` | `true` / `false` |
| `madrasa_default_fee_cents` | z.B. `1500` (= 15 €) |

- [ ] Record gespeichert

### 6.3 Admin-User anlegen

Collection: `users`

| Feld | Wert |
|------|------|
| `email` | Admin-Email der Gemeinde |
| `password` | Sicheres Temporär-Passwort (mind. 12 Zeichen) |
| `first_name` | Vorname |
| `last_name` | Nachname |
| `full_name` | Vor- + Nachname |
| `membership_number` | `ADMIN-001` (Pflichtfeld!) |
| `member_no` | `ADMIN-001` |
| `mosque_id` | ID aus Schritt 6.1 |
| `role` | `admin` |
| `status` | `active` |
| `emailVisibility` | `true` |

- [ ] User angelegt
- [ ] Login-Daten sicher übermitteln (1Password Share / Bitwarden Send — NICHT per Email)

### 6.4 Nachträglich einpflegen (durch Gemeinde-Admin selbst)

Nach Übergabe trägt der Gemeinde-Admin selbst über das Admin-Panel ein:
- Logo → Admin → Einstellungen → Branding
- Brand-Farbe anpassen
- Erste Posts / Events anlegen
- Weitere Mitglieder via Invite-Links anlegen (`/admin/invites`)
- Madrasa: Academic Year, Kurse, Schüler

---

## 7. Übergabe an Gemeinde

- [ ] **Schulung (ca. 30 min)** mit Gemeinde-Admin:
  - Login + Passwort ändern
  - Posts und Events anlegen
  - Mitglieder einladen via `/admin/invites`
  - Stripe-Status prüfen (Testspende)
  - Gebetszeiten-Koordinaten prüfen
  - Logo + Farbe setzen
- [ ] **Kurz-Anleitung** als PDF (1–2 Seiten) übergeben
  - Enthält: Login-URL, wichtigste Admin-Funktionen, Support-Kontakt
- [ ] **Support-Kanal** vereinbaren: Email / WhatsApp / Telegram
- [ ] **Backup-Info** kommunizieren:
  - Tägliches PB-Backup, 7 Tage Aufbewahrung (`scripts/backup-pocketbase.sh`)
  - Auf Anfrage: Datenexport als JSON möglich
- [ ] **Passwort-Änderung** durch Admin-User bestätigt

---

## 8. Smoke-Test vor Übergabe

- [ ] `https://<slug>.moschee.app` öffnet Public-Portal mit korrektem Namen
- [ ] Logo + Brand-Farbe sichtbar
- [ ] Gebetszeiten-Widget zeigt Werte (lat/lng korrekt)
- [ ] Admin-Login klappt → Admin-Panel erreichbar
- [ ] Test-Post anlegen → auf Portal sichtbar
- [ ] Test-Event anlegen → auf Portal sichtbar
- [ ] Stripe: Test-Spende mit `4242 4242 4242 4242` → erscheint in PB `donations`
- [ ] Invite-Link generieren → Registrierung über Invite funktioniert
- [ ] Mobile: Seite auf Smartphone testen (Layout ok, kein horizontaler Overflow)
- [ ] PWA: Add-to-Homescreen funktioniert
- [ ] Impressum-Seite zeigt Gemeinde-Inhalt (nicht Platzhalter)
- [ ] Datenschutz-Seite zeigt Gemeinde-Inhalt

---

## 9. Cleanup / Reset (falls nötig)

Wenn Test-Gemeinde gelöscht werden soll oder Fehler-Rollback nötig:

```bash
node scripts/cleanup-mosque.mjs <pb-url> <admin-email> <admin-password> <mosque-id>
```

> ⚠️ **Unwiderruflich!** Löscht Mosque + alle abhängigen Records (Settings, Users, Events, Posts, Donations, Students, ...).
> Mosque-ID vorher aus PB-Admin-UI kopieren.

---

## Anhang A: Vorlagen & Quellen

### AVV-Vorlagen (Auftragsverarbeitungsvertrag)
- [BITKOM AVV-Muster](https://www.bitkom.org/Themen/Datenschutz-und-Sicherheit/Auftragsdatenverarbeitung) — kostenlos, solide
- [eRecht24 AVV-Generator](https://www.e-recht24.de/muster-auftragsverarbeitung.html) — mit Generator, kostenpflichtig
- [LfDI Baden-Württemberg Muster](https://www.baden-wuerttemberg.datenschutz.de) — kostenlos, Länderbehörde

### Nutzungsvertrag-Vorlagen
- IHK-Musterverträge für IT-Dienstleistungen
- Anwalt-Beratung empfohlen beim ersten echten Kunden (Einmalkosten: 300–600 €)

### Versicherungs-Vergleich
| Anbieter | Fokus | Einstieg |
|----------|-------|----------|
| [exali.de](https://www.exali.de) | IT-Freiberufler, günstig | ~25 €/Monat |
| [Hiscox](https://www.hiscox.de) | IT-Haftpflicht + Cyber | ~40 €/Monat |
| [Markel](https://www.markel.com/de) | Cyber-Spezialist | ~50 €/Monat |
| [Allianz](https://www.allianz.de) | Cyber für Selbständige | ~60 €/Monat |

### Steuer / Gewerbe
- Finanzamt: ELSTER Fragebogen zur steuerlichen Erfassung (liegt im Projekt-Root)
- Gewerbeamt: Gewerbeanmeldung online möglich (Ulm: [ulm.de](https://www.ulm.de))

---

## Anhang B: Subunternehmer (für AVV)

Diese Dienste sind im AVV als Subunternehmer zu nennen:

| Anbieter | Sitz | Daten | Rechtsgrundlage |
|----------|------|-------|-----------------|
| **Hetzner Online GmbH** | Gunzenhausen, DE | Server-Hosting (alle Daten) | EU-DSGVO direkt |
| **Stripe, Inc.** | Dublin, IE (EU) | Zahlungsdaten | EU-DSGVO + SCCs |
| **Resend** | San Francisco, US | E-Mail-Versand (Name, Email) | SCCs (Standard Contractual Clauses) |
| **Cloudflare, Inc.** | San Francisco, US | CDN, Turnstile (IP-Adressen) | SCCs |

> SCCs = EU-Standardvertragsklauseln nach Art. 46 Abs. 2 lit. c DSGVO — Voraussetzung für Datenübermittlung in Drittländer (USA).

---

## Anhang C: TOMs-Stichworte

Technische und Organisatorische Maßnahmen (Art. 32 DSGVO) — für AVV-Anhang:

### Zugangskontrolle
- Admin-Zugang nur mit starkem Passwort (mind. 12 Zeichen)
- PocketBase-Admin-UI nicht öffentlich exponiert (Port 8090 nur intern oder hinter VPN)
- 2FA für Hetzner-Account

### Übertragungssicherheit
- TLS 1.2+ für alle HTTPS-Verbindungen (HSTS aktiv)
- Stripe-Webhooks mit Signaturprüfung (kein ungeprüfter Payload)

### Datensparsamkeit
- `mosque_id` kommt immer vom Server (nie vom Client übernehmbar)
- Rate-Limiting auf Gast-Endpunkte (5 Req/h für Spenden, 20/h für Invite-Validation)
- IP-Hashing statt Klarttext-IPs im Rate-Limiter

### Verfügbarkeit / Integrität
- Tägliches PocketBase-Backup, 7 Tage Rotation (`scripts/backup-pocketbase.sh`)
- PM2 für automatischen Next.js-Neustart bei Absturz
- Audit-Log für alle CRUD-Operationen, Spenden, Event-Registrierungen

### Löschung
- Cleanup-Skript löscht alle abhängigen Daten bei Kündigung
- Vereinbarte Löschfrist im AVV (z.B. 30 Tage nach Vertragsende)

---

*Letzte Aktualisierung: 2026-05 | Halim Elmaci — moschee.app*
