/**
 * Integritäts-Test (V-D, Sprint 4) — über ALLE Demo-transactions:
 *  - assertTransactionIntegrity grün (betrag>0, typ↔classification konsistent)
 *  - toLedgerAtom(tx) wirft nicht
 *  - jede is_storno-Row hat storno_of → existierende non-storno-Row gleicher mosque
 *
 * Read-only (kein Cleanup nötig). Lauf:  npx tsx scripts/test-tx-integrity.mts <DEMO_MOSQUE_ID>
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(): Record<string, string> {
  const raw = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
  const env: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnv();
const PB_URL = env.POCKETBASE_URL || env.NEXT_PUBLIC_POCKETBASE_URL;
const ADMIN_EMAIL = env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = env.PB_ADMIN_PASSWORD;
const DEMO = env.NEXT_PUBLIC_DEMO_MOSQUE_ID;
const target = process.argv[2];

if (!DEMO || target !== DEMO) {
  console.error(`Refuse: Tests run only against DEMO_MOSQUE_ID. Got: ${target}, expected: ${DEMO}`);
  process.exit(2);
}
process.env.POCKETBASE_URL = process.env.POCKETBASE_URL || PB_URL;
process.env.NEXT_PUBLIC_POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || PB_URL;

const { toLedgerAtom, assertTransactionIntegrity } = await import("@/lib/finance-to-ledger-atom");
import type { Transaction } from "@/types";

let token = "";
async function pb(path: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(`${PB_URL}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}), ...(opts.headers || {}) },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`PB ${res.status} ${path}: ${text}`);
  return json;
}
async function auth() {
  for (const ep of ["/api/admins/auth-with-password", "/api/collections/_superusers/auth-with-password"]) {
    try {
      const d = await pb(ep, { method: "POST", body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }) });
      token = d.token;
      return;
    } catch {}
  }
  throw new Error("Auth fehlgeschlagen");
}

let failures = 0;
function ok(cond: boolean, label: string) {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  if (!cond) failures++;
}

async function main() {
  await auth();
  console.log("=== Integritäts-Test: alle Demo-transactions (V-D) ===\n");

  const all: Transaction[] = [];
  let page = 1;
  for (;;) {
    const res = await pb(
      `/api/collections/transactions/records?filter=${encodeURIComponent(`mosque_id="${DEMO}"`)}&perPage=200&page=${page}`
    );
    all.push(...(res.items as Transaction[]));
    if (page >= res.totalPages || res.items.length === 0) break;
    page++;
  }
  console.log(`  ${all.length} transactions geladen\n`);

  const byId = new Map<string, Transaction>();
  all.forEach((t) => byId.set(t.id, t));

  console.log("1. assertTransactionIntegrity + toLedgerAtom:");
  let integrityFails = 0;
  all.forEach((t) => {
    try {
      assertTransactionIntegrity(t);
      toLedgerAtom(t);
    } catch (e) {
      integrityFails++;
      console.log(`     ❌ ${t.id} (${t.beleg_nummer}): ${(e as Error).message}`);
    }
  });
  ok(integrityFails === 0, `alle ${all.length} integrity-grün`);

  console.log("\n2. Storno-Pointer:");
  const stornos = all.filter((t) => t.is_storno === true);
  let pointerFails = 0;
  stornos.forEach((s) => {
    if (!s.storno_of) { pointerFails++; console.log(`     ❌ ${s.beleg_nummer}: kein storno_of`); return; }
    const orig = byId.get(s.storno_of);
    // Original kann außerhalb der geladenen Menge liegen nur wenn gelöscht — in Demo sollte es existieren
    if (!orig) { pointerFails++; console.log(`     ❌ ${s.beleg_nummer}: storno_of ${s.storno_of} nicht gefunden`); return; }
    if (orig.is_storno === true) { pointerFails++; console.log(`     ❌ ${s.beleg_nummer}: Original ist selbst Storno`); }
  });
  ok(pointerFails === 0, `${stornos.length} Storno-Rows: storno_of → valide non-storno-Row`);
}

main()
  .then(() => {
    console.log("");
    if (failures > 0) { console.error(`❌ ${failures} Test(s) fehlgeschlagen.`); process.exit(1); }
    console.log("✅ Alle Integritäts-Tests grün.");
    process.exit(0);
  })
  .catch((e) => {
    console.error("❌ Test-Fehler:", e?.message || e);
    process.exit(2);
  });
