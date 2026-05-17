/**
 * READ-ONLY Diagnose: findet "leere" und verwaiste Records in allen Base-Collections.
 * Löscht NICHTS. Liest Zugangsdaten aus .env.local.
 *
 * "Leer" = alle Nicht-System-Felder sind null / "" / [] / leeres Objekt.
 * "Verwaist" = required relation-Feld (z.B. mosque_id) ist leer.
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dirname, "../.env.local");
  const raw = readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx === -1) continue;
    env[t.slice(0, idx).trim()] = t.slice(idx + 1).trim();
  }
  return env;
}

const env = loadEnv();
const PB_URL = env.POCKETBASE_URL || env.NEXT_PUBLIC_POCKETBASE_URL;
const ADMIN_EMAIL = env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = env.PB_ADMIN_PASSWORD;

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
  if (!res.ok) throw new Error(`PB API ${res.status} ${path}: ${await res.text()}`);
  return res.json();
}

async function authenticate() {
  for (const ep of ["/api/admins/auth-with-password", "/api/collections/_superusers/auth-with-password"]) {
    try {
      const data = await pbFetch(ep, {
        method: "POST",
        body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      });
      authToken = data.token;
      return;
    } catch {}
  }
  throw new Error("Admin-Auth fehlgeschlagen.");
}

const SYSTEM_FIELDS = new Set(["id", "created", "updated", "collectionId", "collectionName", "expand"]);

function isBlank(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v).length === 0;
  return false; // numbers (incl. 0), booleans → NOT blank
}

async function main() {
  if (!PB_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error("Fehler: POCKETBASE_URL / PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD fehlen in .env.local");
    process.exit(1);
  }
  await authenticate();
  console.log(`🔐 Auth OK — ${PB_URL}\n`);

  const cols = (await pbFetch("/api/collections?perPage=200")).items || [];
  const baseCols = cols.filter(
    (c) => c.type === "base" && !c.name.startsWith("_") && c.system !== true
  );

  const report = [];

  for (const col of baseCols) {
    const schema = col.schema || col.fields || [];
    const dataFields = schema
      .map((f) => f.name)
      .filter((n) => !SYSTEM_FIELDS.has(n));
    const requiredRelations = schema
      .filter((f) => f.required && (f.type === "relation"))
      .map((f) => f.name);

    let page = 1;
    let total = 0;
    const emptyIds = [];
    const orphanIds = [];

    while (true) {
      const res = await pbFetch(
        `/api/collections/${col.name}/records?page=${page}&perPage=200`
      );
      const items = res.items || [];
      total = res.totalItems ?? total;
      for (const rec of items) {
        const allBlank = dataFields.every((f) => isBlank(rec[f]));
        if (allBlank) {
          emptyIds.push(rec.id);
        } else {
          const missingRel = requiredRelations.find((f) => isBlank(rec[f]));
          if (missingRel) orphanIds.push(`${rec.id} (kein ${missingRel})`);
        }
      }
      if (page >= (res.totalPages || 1)) break;
      page++;
    }

    if (emptyIds.length || orphanIds.length) {
      report.push({ name: col.name, total, emptyIds, orphanIds });
    }
  }

  if (report.length === 0) {
    console.log("✅ Keine leeren oder verwaisten Records gefunden.");
    return;
  }

  console.log("=== Befund (NICHTS gelöscht) ===\n");
  for (const r of report) {
    console.log(`📦 ${r.name}  (gesamt: ${r.total})`);
    if (r.emptyIds.length) {
      console.log(`   🗑️  ${r.emptyIds.length} LEERE Records:`);
      console.log(`      ${r.emptyIds.join(", ")}`);
    }
    if (r.orphanIds.length) {
      console.log(`   ⚠️  ${r.orphanIds.length} VERWAISTE Records (required relation leer):`);
      console.log(`      ${r.orphanIds.join(", ")}`);
    }
    console.log("");
  }
  console.log("→ Zum Löschen Script mit Bestätigung erweitern. Aktuell read-only.");
}

main().catch((e) => {
  console.error("\n❌ Scan fehlgeschlagen:", e.message);
  process.exit(1);
});
