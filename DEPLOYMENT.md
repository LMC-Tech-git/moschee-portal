# Deployment Guide — moschee.app

## Architektur

```
Browser → Vercel (Next.js)  →  Hetzner VPS (PocketBase)
              ↓
         moschee.app        api.moschee.app:8090
```

---

## 1. Domain kaufen

- **Empfohlen:** [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) (at-cost, ~12 €/Jahr)
- Domain: `moschee.app`
- `.app`-Domains erfordern HTTPS (automatisch durch HSTS Preload List erzwungen)

---

## 2. PocketBase auf HTTPS umstellen (Hetzner VPS)

PocketBase läuft aktuell auf `http://91.98.142.128:8090` (kein SSL, nur IP).
Für Produktion: Nginx als Reverse Proxy mit Let's Encrypt.

### a) DNS-Eintrag setzen
In Cloudflare DNS:
```
Type  Name              Value              Proxy
A     api.moschee.app   91.98.142.128      DNS only (kein Proxy!)
```
> ⚠️ Cloudflare-Proxy (orange) für PocketBase DEAKTIVIEREN — WebSocket-Probleme.

### b) Nginx + Certbot installieren (auf dem VPS)
```bash
apt update && apt install -y nginx certbot python3-certbot-nginx
certbot --nginx -d api.moschee.app
```

### c) Nginx-Config für PocketBase
Datei: `/etc/nginx/sites-available/pocketbase`
```nginx
server {
    listen 443 ssl;
    server_name api.moschee.app;

    ssl_certificate     /etc/letsencrypt/live/api.moschee.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.moschee.app/privkey.pem;

    # WebSocket-Support (für PB Realtime)
    location / {
        proxy_pass         http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api.moschee.app;
    return 301 https://$host$request_uri;
}
```
```bash
ln -s /etc/nginx/sites-available/pocketbase /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### d) PocketBase CORS einschränken
In PocketBase Admin → Settings → Application:
```
Allowed origins: https://moschee.app
```
> Aktuell ist wahrscheinlich `*` gesetzt — das für Produktion unbedingt einschränken!

---

## 3. Vercel-Projekt aufsetzen

### a) GitHub-Repository
Falls noch nicht vorhanden:
```bash
git init
git remote add origin https://github.com/DEIN-USERNAME/moschee-portal.git
git push -u origin main
```

### b) Vercel-Projekt erstellen
1. [vercel.com](https://vercel.com) → New Project → GitHub-Repo auswählen
2. Framework: **Next.js** (wird auto-erkannt)
3. Root Directory: `moschee-portal` (falls Monorepo)
4. Build-Command: `next build` (auto)

### c) Environment Variables in Vercel eintragen
Settings → Environment Variables:

| Variable | Wert |
|----------|------|
| `NEXT_PUBLIC_POCKETBASE_URL` | `https://api.moschee.app` |
| `POCKETBASE_URL` | `https://api.moschee.app` |
| `NEXT_PUBLIC_APP_URL` | `https://moschee.app` |
| `PB_ADMIN_EMAIL` | `halimelmaci@hotmail.com` |
| `PB_ADMIN_PASSWORD` | *(sicheres Passwort)* |
| `STRIPE_SECRET_KEY` | `sk_live_...` *(Live-Key!)* |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` *(Live-Key!)* |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` *(von Stripe Dashboard)* |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `0x4AAA...` |
| `TURNSTILE_SECRET_KEY` | `0x4AAA...` |
| `RESEND_API_KEY` | `re_...` |
| `RESEND_FROM_EMAIL` | `Moschee Portal <noreply@moschee.app>` |

### d) Custom Domain in Vercel
Settings → Domains → `moschee.app` hinzufügen

DNS in Cloudflare:
```
Type   Name    Value                    Proxy
A      @       76.76.21.21              ✅ Proxy an
CNAME  www     cname.vercel-dns.com     ✅ Proxy an
```
> Für moschee.app (Apex-Domain) A-Record auf Vercels IP.
> Vercel zeigt die genaue IP im Domain-Dialog.

---

## 4. Stripe auf Live-Modus umstellen

1. Stripe Dashboard → Live-Modus aktivieren
2. Live API-Keys kopieren → in Vercel eintragen
3. Webhook-Endpunkt erstellen:
   - URL: `https://moschee.app/api/stripe/webhook`
   - Events: `checkout.session.completed`, `invoice.payment_succeeded`
   - Secret kopieren → `STRIPE_WEBHOOK_SECRET` in Vercel

---

## 5. Cloudflare Turnstile konfigurieren

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → Turnstile → Add site
2. Domain: `moschee.app`
3. Widget-Type: **Managed** (empfohlen)
4. Site Key + Secret Key → in Vercel eintragen

---

## 6. E-Mail (Resend) einrichten

1. [resend.com](https://resend.com) → Kostenlos registrieren
2. Domain `moschee.app` verifizieren (DNS TXT-Einträge in Cloudflare)
3. API Key erstellen → in Vercel eintragen
4. Absender: `noreply@moschee.app`

---

## 7. Go-Live Checklist

- [ ] Domain `moschee.app` registriert
- [ ] DNS-Einträge für Vercel gesetzt
- [ ] DNS-Eintrag für `api.moschee.app` gesetzt (A-Record, kein Proxy)
- [ ] PocketBase läuft hinter Nginx mit SSL
- [ ] PocketBase CORS auf `https://moschee.app` eingeschränkt
- [ ] Alle Env-Variablen in Vercel eingetragen
- [ ] Stripe-Live-Keys aktiviert
- [ ] Stripe-Webhook-Endpunkt erstellt und Secret eingetragen
- [ ] Turnstile-Widget konfiguriert
- [ ] Resend-Domain verifiziert
- [ ] `https://moschee.app` im Browser testen
- [ ] `https://moschee.app/ditib-ulm` (Demo-Moschee) testen
- [ ] Admin-Login unter `/admin` testen
- [ ] Testspende durchführen (Stripe Test-Modus → Live)

---

## Troubleshooting

**Build schlägt fehl:**
```
Umgebungsvariablen sind nicht korrekt konfiguriert
```
→ `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` in Vercel env prüfen.

**PocketBase nicht erreichbar:**
→ CORS-Einstellung prüfen. Nginx-Status: `systemctl status nginx`.

**Stripe-Webhook schlägt fehl:**
→ `STRIPE_WEBHOOK_SECRET` muss zum Live-Endpunkt gehören (nicht zum Test-Endpunkt).

**CSP-Fehler in Browser-Console:**
→ `NEXT_PUBLIC_POCKETBASE_URL` in Vercel muss exakt `https://api.moschee.app` sein.
