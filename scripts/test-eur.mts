/**
 * Integration-Test getEUR (Sprint 4) gegen DEMO, isoliertes Jahr (2031, leer).
 * Deckt:
 *  - Σ je Kategorie über classification/kategorie (nie typ/event_type)
 *  - alle 15 Kategorien je Sektion vorhanden (auch 0)
 *  - Storno nettet in Original-Kategorie (kein Phantom in fremdem Topf)
 *  - Überschuss = ΣEinnahmen − ΣAusgaben
 *  - finally-Cleanup
 *
 * Lauf:  npx tsx scripts/test-eur.mts <DEMO_MOSQUE_ID>
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
process.env.PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || ADMIN_EMAIL;
process.env.PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || ADMIN_PASSWORD;

const { createManualTransaction, stornoTransaction } = await import("@/lib/actions/finance-domain");
const { getEUR } = await import("@/lib/actions/finance");

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

const createdTxIds: string[] = [];
async function cleanup() {
  for (const id of createdTxIds) {
    try { await pb(`/api/collections/transactions/records/${id}`, { method: "DELETE" }); }
    catch (e) { console.warn(`  ⚠️  cleanup ${id}: ${(e as Error).message}`); }
  }
}

const YEAR = 2031; // isoliert/leer in der Demo

async function main() {
  await auth();
  console.log("=== Integration: getEUR Netting gegen DEMO (Jahr 2031) ===\n");

  const i1 = await createManualTransaction({ mosqueId: DEMO, buchungsdatum: `${YEAR}-02-01`, betragCents: 10000, typ: "einnahme", kategorie: "spenden", beschreibung: "TEST EUR i1", kontoTyp: "bank" });
  createdTxIds.push(i1.id);
  const i2 = await createManualTransaction({ mosqueId: DEMO, buchungsdatum: `${YEAR}-03-01`, betragCents: 5000, typ: "einnahme", kategorie: "spenden", beschreibung: "TEST EUR i2", kontoTyp: "bank" });
  createdTxIds.push(i2.id);
  const e1 = await createManualTransaction({ mosqueId: DEMO, buchungsdatum: `${YEAR}-04-01`, betragCents: 3000, typ: "ausgabe", kategorie: "miete", beschreibung: "TEST EUR e1", kontoTyp: "bank" });
  createdTxIds.push(e1.id);

  // Storno von i2 (5000 spenden) → nettet in spenden, kein Phantom in Ausgaben
  const s = await stornoTransaction({ mosqueId: DEMO, transactionId: i2.id, grund: "TEST" });
  createdTxIds.push(s.id);

  const eur = await getEUR(DEMO, YEAR);

  console.log("1. Kategorie-Netting:");
  const spenden = eur.einnahmen.find((x) => x.kategorie === "spenden")?.cents ?? -1;
  const miete = eur.ausgaben.find((x) => x.kategorie === "miete")?.cents ?? -1;
  ok(spenden === 10000, `spenden netto = 10000 (10000+5000−5000 Storno), got ${spenden}`);
  ok(miete === 3000, `miete = 3000, got ${miete}`);

  console.log("\n2. Kein Phantom:");
  ok(!eur.ausgaben.some((x) => x.kategorie === "spenden"), "spenden NICHT in Ausgaben (Storno nettete in Original-Topf)");

  console.log("\n3. Alle 15 Kategorien:");
  ok(eur.einnahmen.length === 7, `7 Einnahme-Kategorien (got ${eur.einnahmen.length})`);
  ok(eur.ausgaben.length === 8, `8 Ausgabe-Kategorien (got ${eur.ausgaben.length})`);

  console.log("\n4. Überschuss:");
  ok(eur.einnahmen_total_cents === 10000, `Einnahmen total = 10000 (got ${eur.einnahmen_total_cents})`);
  ok(eur.ausgaben_total_cents === 3000, `Ausgaben total = 3000 (got ${eur.ausgaben_total_cents})`);
  ok(eur.ueberschuss_cents === 7000, `Überschuss = 7000 (got ${eur.ueberschuss_cents})`);
}

main()
  .then(async () => {
    await cleanup();
    console.log("");
    if (failures > 0) { console.error(`❌ ${failures} Test(s) fehlgeschlagen.`); process.exit(1); }
    console.log("✅ Alle EUR-Tests grün.");
    process.exit(0);
  })
  .catch(async (e) => {
    await cleanup();
    console.error("❌ Test-Fehler:", e?.message || e);
    process.exit(2);
  });
