# Neue Gemeinde anlegen — Schritt-für-Schritt

> Legende:
> - 🤖 **Claude übernimmt** — du sagst es, Claude erledigt es
> - 👤 **Du** — musst du selbst machen (SSH, Browser, externe Dienste)
> - ✅ **Einmalig** — nur beim allerersten Mal nötig, danach automatisch

---

## Übersicht (Kurzversion)

```
1. [Einmalig] Caddy-Config auf Server → Wildcard-TLS
2. PocketBase-Records anlegen (Claude)
3. Branding + Logo setzen (Du, im Admin-Panel)
4. Smoke-Test (Du)
5. Fertig
```

---

## Schritt 1 — Caddy Wildcard-TLS einrichten ✅ Einmalig 👤 Du

> Nur EINMAL nötig. Danach gilt jede neue `*.moschee.app`-Subdomain automatisch.

Das aktuelle Problem: Caddy stellt nur für bekannte Domains ein Zertifikat aus.
Lösung: On-Demand TLS aktivieren → Caddy holt Zertifikat automatisch für jede neue Subdomain.

### 1.1 SSH in den Server

```bash
ssh root@91.98.142.128
```

### 1.2 Aktuelle Caddy-Config anzeigen und zeigen (mir schicken)

```bash
cat /etc/caddy/Caddyfile
```

→ Inhalt hier reinschicken, dann passe ich die Config an.

### 1.3 Caddyfile ersetzen (ich gebe dir den exakten Inhalt)

Wahrscheinlich wird es so aussehen:

```caddy
{
    # On-Demand TLS: Caddy holt automatisch Zertifikate für neue Subdomains
    on_demand_tls {
        interval 2m
        burst     5
    }
}

# Alle moschee.app-Subdomains → Next.js
*.moschee.app moschee.app {
    tls {
        on_demand
    }
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
    }
}
```

```bash
nano /etc/caddy/Caddyfile
# Inhalt ersetzen, dann:
caddy validate --config /etc/caddy/Caddyfile
caddy reload --config /etc/caddy/Caddyfile
```

### 1.4 Test

```bash
# Vom Server aus:
curl -I https://halim.moschee.app
# Erwartung: HTTP 200 oder 308-Redirect (kein TLS-Fehler)
```

---

## Schritt 2 — PocketBase-Records anlegen 🤖 Claude

**Du sagst mir:**
- Slug (z.B. `ditib-ulm`)
- Name der Gemeinde
- Stadt
- Adresse
- Kontakt-Email
- GPS-Koordinaten (Lat/Lng — via [Google Maps](https://maps.google.com): Rechtsklick → "Was ist hier?")
- Brand-Farbe (Hex, z.B. `#1d6b38`)
- Welche Module aktiv: Spenden / Events / Posts / Madrasa / Gebetszeiten
- Email-Adresse für ersten Admin-User

**Claude erstellt dann automatisch:**
- [ ] `mosques`-Record (slug, name, adresse, koordinaten, farbe)
- [ ] `settings`-Record (alle Module, Gebetszeiten-Methode Diyanet=13)
- [ ] Erster `users`-Record mit `role=admin`

**Ausgabe:** Mosque-ID + Login-Daten

> ⚠️ Login-Daten sicher übergeben — NICHT per Email. 1Password Share oder Bitwarden Send nutzen.

---

## Schritt 3 — Branding & Erstkonfiguration 👤 Du (Admin-Panel)

Login: `https://<slug>.moschee.app/login`

- [ ] Passwort ändern (Admin → Profil)
- [ ] Logo hochladen: Admin → Einstellungen → Branding
- [ ] Brand-Farbe prüfen / anpassen
- [ ] Gebetszeiten prüfen: Admin → Einstellungen → Gebetszeiten → Widget auf Dashboard sichtbar?
- [ ] Stripe Connect-ID eintragen (wenn Spenden aktiv): PB-Admin-UI → `mosques`-Record → `stripe_account`

---

## Schritt 4 — Smoke-Test 👤 Du

| Test | URL / Aktion | Erwartung |
|------|-------------|-----------|
| Public-Portal | `https://<slug>.moschee.app` | Portal mit Gemeinde-Name |
| Admin-Login | `/login` → Admin-Daten | Weiterleitung zu `/admin` |
| Gebetszeiten | Dashboard | Widget mit Uhrzeiten |
| Event anlegen | Admin → Events → Neu | Erscheint auf Portal |
| Post anlegen | Admin → Neuigkeiten → Neu | Erscheint auf Portal |
| Mitglied einladen | Admin → Einladungen | Invite-Link kopieren, Browser-Tab öffnen, Registrierung |
| Test-Spende | Portal → Spenden | Stripe Testkarte `4242 4242 4242 4242` |
| Mobile | Smartphone | Kein horizontaler Overflow |
| PWA | Smartphone → "Zum Homescreen" | App-Icon erscheint |

---

## Schritt 5 — Fertig

Gemeinde-Admin hat:
- ✅ Funktionierendes Portal unter eigener Subdomain
- ✅ Admin-Zugang
- ✅ Alle gewünschten Module aktiv

Halim kommuniziert:
- Support-Kanal (Email / WhatsApp)
- Backup-Hinweis: täglich automatisch, 7 Tage Aufbewahrung

---

## Troubleshooting

### Subdomain erreichbar, aber nur HTTP (kein HTTPS / Zertifikatsfehler)
→ Schritt 1 noch nicht gemacht oder Caddy-Reload fehlt.
```bash
caddy reload --config /etc/caddy/Caddyfile
journalctl -u caddy -n 50
```

### Portal öffnet, zeigt aber falsche Gemeinde
→ Slug im PocketBase-Record prüfen. Muss exakt mit Subdomain übereinstimmen (lowercase, kein Leerzeichen).

### Gebetszeiten-Widget fehlt
→ Lat/Lng-Koordinaten im `mosques`-Record prüfen. Beide müssen gesetzt sein. `prayer_provider` in `settings` muss `aladhan` sein (nicht `off`).

### Admin-Login schlägt fehl
→ `status` im `users`-Record prüfen: muss `active` sein. `mosque_id` muss gesetzt sein.

### Gemeinde sieht Demo-Daten
→ Kann nicht passieren (Tenant-Isolation über `mosque_id` serverseitig). Aber prüfen: ist `mosque_id` im `users`-Record korrekt?

---

## Für halim.moschee.app (aktueller Stand)

| Schritt | Status |
|---------|--------|
| DNS Wildcard | ✅ Aktiv (`*.moschee.app → 91.98.142.128`) |
| PocketBase-Records | ✅ Angelegt (Mosque-ID: `e2l5ggycgowidzr`) |
| Caddy Wildcard-TLS | ❌ **Noch nicht gemacht** → Schritt 1 oben |
| Branding / Logo | ⏳ Nach Schritt 1 |
| Smoke-Test | ⏳ Nach Schritt 1 |

**Login (nach Schritt 1):**
- URL: `https://halim.moschee.app/login`
- Email: `admin@halim.moschee.app`
- Passwort: `Halim1234!`

---

*Letzte Aktualisierung: 2026-05 | Nächste Aktion: SSH → Caddyfile zeigen*
