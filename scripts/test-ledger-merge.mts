/**
 * Integration-Test getLedgerAtoms (Sprint 4) — Merge Events + manuelle Buchungen
 * gegen DEMO. Deckt:
 *  - additive Union (Event-Atoms + manuelle Atoms im selben Jahr)
 *  - source_system korrekt getaggt
 *  - deterministischer Sort (datum, beleg_nummer, id)
 *  - V-C: getFinanceKPIs.saldo == Σ(atoms.signed) (kein Filter-Drift, eine Quelle)
 *  - finally-Cleanup
 *
 * Lauf:  npx tsx scripts/test-ledger-merge.mts <DEMO_MOSQUE_ID>
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

const { createManualTransaction } = await import("@/lib/actions/finance-domain");
const { getLedgerAtoms, getFinanceKPIs } = await import("@/lib/actions/finance");

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
    try {
      await pb(`/api/collections/transactions/records/${id}`, { method: "DELETE" });
    } catch (e) {
      console.warn(`  ⚠️  cleanup ${id}: ${(e as Error).message}`);
    }
  }
}

const YEAR = 2026; // hat Donation-Events in der Demo

async function main() {
  await auth();
  console.log("=== Integration: getLedgerAtoms Merge gegen DEMO ===\n");

  const before = await getLedgerAtoms(DEMO, { year: YEAR, perPage: 100000 });

  const tx = await createManualTransaction({
    mosqueId: DEMO,
    buchungsdatum: `${YEAR}-06-15`,
    betragCents: 4200,
    typ: "ausgabe",
    kategorie: "miete",
    beschreibung: "TEST Ledger-Merge Miete",
    kontoTyp: "bank",
    zahlungskanal: "ueberweisung",
  });
  createdTxIds.push(tx.id);

  const after = await getLedgerAtoms(DEMO, { year: YEAR, perPage: 100000 });

  console.log("1. Additive Union:");
  ok(after.total === before.total + 1, `total +1 (vorher ${before.total} → ${after.total})`);
  ok(
    after.atoms.some((a) => a.source_system === "manual_transaction" && a.beleg_nummer === tx.beleg_nummer),
    "manuelle Buchung als manual_transaction-Atom vorhanden"
  );
  ok(after.atoms.some((a) => a.source_system === "external_event"), "Event-Atom vorhanden (additive Union)");

  console.log("\n2. Deterministischer Sort:");
  let sorted = true;
  for (let i = 1; i < after.atoms.length; i++) {
    const p = after.atoms[i - 1];
    const c = after.atoms[i];
    const cmp =
      p.datum !== c.datum ? (p.datum < c.datum ? -1 : 1)
      : p.beleg_nummer !== c.beleg_nummer ? (p.beleg_nummer < c.beleg_nummer ? -1 : 1)
      : p.id < c.id ? -1 : p.id > c.id ? 1 : 0;
    if (cmp > 0) { sorted = false; break; }
  }
  ok(sorted, "datum ASC, beleg_nummer ASC, id ASC");

  console.log("\n3. V-C: KPI == Σ(atoms):");
  const kpis = await getFinanceKPIs(DEMO, YEAR);
  const sumSigned = after.atoms.reduce((s, a) => s + a.signed_amount_cents, 0);
  ok(kpis.saldo_cents === sumSigned, `KPI.saldo (${kpis.saldo_cents}) == Σ(atoms.signed) (${sumSigned})`);
  ok(
    kpis.saldo_cents === kpis.einnahmen_cents - kpis.ausgaben_cents,
    "saldo == einnahmen − ausgaben"
  );
}

main()
  .then(async () => {
    await cleanup();
    console.log("");
    if (failures > 0) { console.error(`❌ ${failures} Test(s) fehlgeschlagen.`); process.exit(1); }
    console.log("✅ Alle Ledger-Merge-Tests grün.");
    process.exit(0);
  })
  .catch(async (e) => {
    await cleanup();
    console.error("❌ Test-Fehler:", e?.message || e);
    process.exit(2);
  });
