#!/usr/bin/env node
/**
 * Moschee-Portal - Attachments Migration
 *
 * Fügt das Mehrfach-Datei-Feld `attachments` (Bilder + PDFs) zu den
 * Collections `events` und `campaigns` hinzu und zieht die mimeTypes-Whitelist
 * für das bereits vorhandene `posts.attachments` nach.
 *
 * Registriert ausserdem die Thumbnail-Größen (`thumbs`), damit ältere
 * PocketBase-Versionen (< 0.23) `?thumb=WxH`-URLs verkleinern (sonst kommt
 * still das Original zurück). Die Liste MUSS zu THUMB_SIZES in
 * lib/attachments.ts passen.
 *
 * Liest Zugangsdaten aus .env.local.
 *
 * Nutzung:
 *   node scripts/migrate-attachments.mjs            # ausführen
 *   node scripts/migrate-attachments.mjs --dry-run  # nur anzeigen
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dirname, "../.env.local");
  try {
    const raw = readFileSync(envPath, "utf-8");
    const env = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
    return env;
  } catch {
    return {};
  }
}

const DRY_RUN = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";

const env = loadEnv();
const PB_URL = env.POCKETBASE_URL || env.NEXT_PUBLIC_POCKETBASE_URL;
const ADMIN_EMAIL = env.PB_ADMIN_EMAIL || env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = env.PB_ADMIN_PASSWORD || env.POCKETBASE_ADMIN_PASSWORD;

if (!PB_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "Fehler: (NEXT_PUBLIC_)POCKETBASE_URL + (POCKETBASE|PB)_ADMIN_EMAIL + (POCKETBASE|PB)_ADMIN_PASSWORD müssen in .env.local gesetzt sein."
  );
  process.exit(1);
}

// Muss zu lib/attachments.ts (THUMB_SIZES) passen!
const THUMBS = ["100x100", "0x300"];
const MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const ATTACHMENT_FIELD = {
  name: "attachments",
  type: "file",
  required: false,
  options: {
    maxSelect: 10,
    maxSize: 10485760,
    mimeTypes: MIME_TYPES,
    thumbs: THUMBS,
  },
};

let authToken = "";

async function pbFetch(path, options = {}) {
  const res = await fetch(`${PB_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: authToken } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PB API ${res.status} ${path}: ${text}`);
  }
  return res.json();
}

async function authenticate() {
  console.log("🔐 Authentifiziere als Admin...");
  const endpoints = [
    "/api/admins/auth-with-password",
    "/api/collections/_superusers/auth-with-password",
  ];
  for (const endpoint of endpoints) {
    try {
      const data = await pbFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      });
      authToken = data.token;
      console.log(`   ✅ Erfolgreich authentifiziert (${endpoint})\n`);
      return;
    } catch {
      // nächsten Endpunkt versuchen
    }
  }
  throw new Error("Admin-Authentifizierung fehlgeschlagen. Prüfe E-Mail und Passwort.");
}

async function createPbBackup() {
  if (DRY_RUN) {
    console.log("⚠️  PB-Backup übersprungen (--dry-run)\n");
    return;
  }
  if (process.env.SKIP_PB_BACKUP === "1") {
    console.log("⚠️  PB-Backup übersprungen (SKIP_PB_BACKUP=1)\n");
    return;
  }
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const name = `pre-attachments-${ts}.zip`;
  console.log(`💾 Erstelle PB-Backup "${name}" ...`);
  try {
    const res = await fetch(`${PB_URL}/api/backups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: authToken } : {}),
      },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PB API ${res.status} /api/backups: ${text}`);
    }
    console.log(`   ✅ Backup-Request gesendet: ${name}\n`);
  } catch (err) {
    console.error(`   ❌ PB-Backup fehlgeschlagen: ${err.message}`);
    console.error("   Abbruch — kein Schema-Schreiben ohne Snapshot. Mit SKIP_PB_BACKUP=1 erzwingbar.\n");
    process.exit(1);
  }
}

/** Schema-Array einer Collection (alte PB nutzt `schema`, neuere `fields`). */
function getSchemaArray(collection) {
  return collection.schema || collection.fields || [];
}

function sameStringSet(a, b) {
  const arrA = Array.isArray(a) ? a : [];
  const arrB = Array.isArray(b) ? b : [];
  if (arrA.length !== arrB.length) return false;
  const setB = new Set(arrB);
  return arrA.every((x) => setB.has(x));
}

async function migrateCollection(name) {
  console.log(`📦 Collection "${name}"`);
  let collection;
  try {
    collection = await pbFetch(`/api/collections/${name}`);
  } catch (err) {
    console.log(`   ⚠️  übersprungen (nicht gefunden): ${err.message}\n`);
    return;
  }

  const schema = getSchemaArray(collection).map((f) => ({ ...f }));
  const existing = schema.find((f) => f.name === "attachments");

  if (!existing) {
    schema.push({ ...ATTACHMENT_FIELD });
    console.log("   ➕ Feld 'attachments' wird hinzugefügt");
  } else {
    const opts = existing.options || {};
    const needsMime = !sameStringSet(opts.mimeTypes, MIME_TYPES);
    const needsThumbs = !sameStringSet(opts.thumbs, THUMBS);
    if (!needsMime && !needsThumbs) {
      console.log("   ⏭️  'attachments' bereits aktuell\n");
      return;
    }
    existing.options = {
      ...opts,
      maxSelect: opts.maxSelect || 10,
      maxSize: opts.maxSize || 10485760,
      mimeTypes: MIME_TYPES,
      thumbs: THUMBS,
    };
    console.log(
      `   🔄 'attachments' wird aktualisiert (${[needsMime && "mimeTypes", needsThumbs && "thumbs"].filter(Boolean).join(", ")})`
    );
  }

  if (DRY_RUN) {
    console.log("   [DRY-RUN] kein Schreibvorgang\n");
    return;
  }

  try {
    await pbFetch(`/api/collections/${collection.id || name}`, {
      method: "PATCH",
      body: JSON.stringify({ schema }),
    });
    console.log("   ✅ aktualisiert\n");
  } catch (err) {
    console.log(`   ⚠️  Fehler: ${err.message}\n`);
  }
}

async function main() {
  console.log(`\n🚀 Attachments-Migration ${DRY_RUN ? "(DRY-RUN)" : ""}\n   PB: ${PB_URL}\n`);
  await authenticate();
  await createPbBackup();
  for (const name of ["events", "campaigns", "posts"]) {
    await migrateCollection(name);
  }
  console.log("✅ Fertig.\n");
}

main().catch((err) => {
  console.error("❌ Migration fehlgeschlagen:", err.message);
  process.exit(1);
});
