#!/usr/bin/env node
/**
 * Moschee-Portal — Rollback-Script für TV-Anzeige-Felder.
 *
 * Entfernt alle tv_*-Felder aus der settings-Collection.
 * Idempotent: Felder die nicht existieren werden übersprungen.
 *
 * Nutzung:
 *   node scripts/migrate-v1-rollback.mjs            (entfernt TV-Felder)
 *   node scripts/migrate-v1-rollback.mjs --dry-run  (zeigt nur was passieren würde)
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
  console.error("Fehler: (NEXT_PUBLIC_)POCKETBASE_URL + (POCKETBASE|PB)_ADMIN_EMAIL + (POCKETBASE|PB)_ADMIN_PASSWORD müssen in .env.local gesetzt sein.");
  process.exit(1);
}

const TV_FIELD_NAMES = [
  "tv_enabled",
  "tv_modules",
  "tv_slide_order",
  "tv_module_counts",
  "tv_rotation_seconds",
  "tv_locale_mode",
  "tv_locale_primary",
  "tv_locale_secondary",
  "tv_locale_rotate_seconds",
  "tv_bg_color",
  "tv_text_color",
  "tv_accent_color",
  "tv_announcement_text",
  "tv_announcement_text_secondary",
  "tv_show_hijri",
  "tv_show_arabic_prayer_names",
  "tv_highlight_active_prayer",
  "tv_highlight_duration_seconds",
];

let authToken = "";

async function pbFetch(path, options = {}) {
  const url = `${PB_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: authToken } : {}),
      ...options.headers,
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function authenticate() {
  const res = await pbFetch("/api/admins/auth-with-password", {
    method: "POST",
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  authToken = res.token;
  console.log(`✅ Authentifiziert als ${ADMIN_EMAIL}`);
}

async function main() {
  console.log(`\n=== TV-Anzeige Rollback ===`);
  console.log(`PocketBase: ${PB_URL}`);
  console.log(`Modus: ${DRY_RUN ? "DRY-RUN (keine Änderungen)" : "LIVE"}\n`);

  await authenticate();

  const cols = await pbFetch("/api/collections?perPage=200");
  const settings = (cols.items || []).find((c) => c.name === "settings");
  if (!settings) {
    console.error("❌ settings-Collection nicht gefunden");
    process.exit(1);
  }

  const existingSchema = settings.schema || [];
  const remainingSchema = existingSchema.filter((f) => !TV_FIELD_NAMES.includes(f.name));
  const removed = existingSchema.filter((f) => TV_FIELD_NAMES.includes(f.name));

  if (removed.length === 0) {
    console.log("⏭️  Keine TV-Felder vorhanden — nichts zu entfernen.");
    return;
  }

  console.log(`Entferne ${removed.length} TV-Felder: ${removed.map((f) => f.name).join(", ")}`);

  if (DRY_RUN) {
    console.log("\n(DRY-RUN: Schema bleibt unverändert.)\n");
    return;
  }

  await pbFetch(`/api/collections/${settings.id}`, {
    method: "PATCH",
    body: JSON.stringify({ schema: remainingSchema }),
  });

  console.log(`\n=== ✅ TV-Felder entfernt ===\n`);
}

main().catch((err) => {
  console.error("\n❌ Rollback fehlgeschlagen:", err.message);
  process.exit(1);
});
