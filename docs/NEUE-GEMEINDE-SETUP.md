# Neue Gemeinde anlegen — Schritt-für-Schritt

> Legende:
> - 🤖 **Claude übernimmt** — du sagst es, Claude erledigt es
> - 👤 **Du** — musst du selbst machen (Browser, externe Dienste)
> - ✅ **Einmalig erledigt** — einmalig eingerichtet, läuft dauerhaft

---

## Übersicht (Kurzversion)

```
1. [✅ Erledigt] DNS Wildcard + Caddy On-Demand TLS → läuft automatisch
2. 🤖 Claude: PocketBase-Records anlegen (Slug, Name, Stadt, Farbe, Module, Admin-Email)
3. 👤 Du: Branding + Logo im Admin-Panel setzen
4. 👤 Du: Smoke-Test
5. Fertig
```

> **Für jede neue Gemeinde nur noch Schritt 2–4 nötig.**
> Kein DNS-Eintrag, kein Server-Zugriff, kein Caddy-Eingriff.

---

## Schritt 1 — DNS + Caddy ✅ Einmalig erledigt

**DNS:** Wildcard `*.moschee.app → 91.98.142.128` in Hetzner DNS aktiv.
Jede neue Subdomain (`ditib-ulm.moschee.app`, `berlin.moschee.app`, ...) funktioniert automatisch — kein extra DNS-Record nötig.

**Caddy:** On-Demand TLS konfiguriert (`/etc/caddy/Caddyfile`).
Caddy holt TLS-Zertifikat automatisch beim ersten Aufruf einer neuen Subdomain.

Aktuelles Caddyfile (zur Referenz, nicht ändern):
```caddy
{
    on_demand_tls {
        ask http://localhost:2019/config/
    }
}

moschee.app, www.moschee.app {
    handle /pb/* {
        uri strip_prefix /pb
        reverse_proxy 127.0.0.1:8090
    }
    handle {
        reverse_proxy 127.0.0.1:3000
    }
}

*.moschee.app {
    tls {
        on_demand
    }
    reverse_proxy 127.0.0.1:3000
}

lmctech.de, www.lmctech.de {
    root * /var/www/lmctech.de
    file_server
}
```

---

## Schritt 2 — PocketBase-Records anlegen 🤖 Claude

**Du sagst Claude:**
- Slug (z.B. `ditib-ulm`) — wird Teil der URL
- Name der Gemeinde
- Stadt + Adresse
- GPS-Koordinaten (Lat/Lng) → [maps.google.com](https://maps.google.com): Rechtsklick auf Moschee → erste Zeile
- Brand-Farbe (Hex, z.B. `#1d6b38`) — oder "Standard grün"
- Module aktiv: Spenden / Events / Posts / Madrasa / Gebetszeiten (oder "alles")
- Email für ersten Admin-User

**Claude erstellt automatisch:**
- `mosques`-Record (slug, name, adresse, koordinaten, farbe)
- `settings`-Record (Module, Gebetszeiten-Methode Diyanet=13)
- Erster `users`-Record mit `role=admin`

**Ausgabe von Claude:** URL + Login-Daten

> ⚠️ Login-Daten sicher übergeben — NICHT per Email. 1Password Share oder Bitwarden Send nutzen.

---

## Schritt 3 — Branding & Erstkonfiguration 👤 Du (Admin-Panel)

Login: `https://<slug>.moschee.app/login`

- [ ] Passwort ändern (Profil-Seite)
- [ ] Logo hochladen: Admin → Einstellungen → Branding
- [ ] Brand-Farbe prüfen / anpassen
- [ ] Gebetszeiten prüfen: Dashboard → Widget mit Uhrzeiten sichtbar?
- [ ] Stripe Connect-ID eintragen (wenn Spenden aktiv): PB-Admin-UI → `mosques`-Record → `stripe_account`

---

## Schritt 4 — Smoke-Test 👤 Du

| Test | Aktion | Erwartung |
|------|--------|-----------|
| Public-Portal | `https://<slug>.moschee.app` | Portal mit Gemeinde-Name + Farbe |
| Admin-Login | `/login` → Daten eingeben | Weiterleitung zu `/admin` |
| Gebetszeiten | Dashboard | Widget mit Uhrzeiten |
| Event anlegen | Admin → Events → Neu | Erscheint auf Portal |
| Post anlegen | Admin → Neuigkeiten → Neu | Erscheint auf Portal |
| Mitglied einladen | Admin → Einladungen | Invite-Link → Registrierung klappt |
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

### TLS-Fehler / Seite nicht erreichbar beim ersten Aufruf
Caddy holt Zertifikat beim ersten Aufruf — das dauert 3–10 Sekunden.
Einfach 10 Sekunden warten und nochmal laden. Falls dauerhaft:
```bash
journalctl -u caddy -n 30 --no-pager
```

### Portal öffnet, zeigt aber falsche Gemeinde / 404
Slug im `mosques`-Record prüfen — muss exakt mit Subdomain übereinstimmen (lowercase, keine Leerzeichen, keine Sonderzeichen).

### Gebetszeiten-Widget fehlt
Lat/Lng im `mosques`-Record prüfen (beide müssen gesetzt sein).
`prayer_provider` in `settings` muss `aladhan` sein (nicht `off`).

### Admin-Login schlägt fehl
`status` im `users`-Record: muss `active` sein.
`mosque_id` im `users`-Record: muss gesetzt sein.

### Gemeinde sieht Daten einer anderen Gemeinde
Kann durch korrekte Architektur nicht passieren — `mosque_id` wird immer serverseitig via Slug aufgelöst, nie vom Client.
Zur Sicherheit: `mosque_id` im `users`-Record des betroffenen Admins prüfen.

### Gemeinde komplett löschen (Reset / Kündigung)
```bash
node scripts/cleanup-mosque.mjs http://91.98.142.128:8090 <admin-email> <password> <mosque-id>
```
Löscht: Mosque + Settings + Users + alle Inhalte (Events, Posts, Donations, Students, ...).

---

*Letzte Aktualisierung: 2026-05 | DNS + Caddy einmalig eingerichtet — ab jetzt nur noch PB-Records anlegen.*
