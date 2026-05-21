/**
 * Integration-Test stornoTransaction (Sprint 3) — ECHTE Server-Action gegen DEMO.
 *
 * Deckt (Plan §4.2/4.3):
 *  - Storno einer Einnahme → Gegenbuchung neue Nummer, typ=ausgabe,
 *    classification=expense, storno_of gesetzt; Original unverändert (immutable)
 *  - EÜR-Netting: Σ signed_amount in Original-Kategorie = 0 (via toLedgerAtom)
 *  - Doppel-Storno → abgelehnt (already_storniert)
 *  - Storno eines Stornos → abgelehnt (cannot_storno_a_storno)
 *  - finally-Cleanup
 *
 * M6 Demo-Guard. Lauf:  npx tsx scripts/test-storno.mts <DEMO_MOSQUE_ID>
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
const { toLedgerAtom } = await import("@/lib/finance-to-ledger-atom");

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
async function throwsAsync(fn: () => Promise<unknown>, label: string, msgIncludes?: string) {
  try {
    await fn();
    console.log(`  ❌ ${label} (kein Throw)`);
    failures++;
  } catch (e) {
    const msg = (e as Error).message || "";
    if (msgIncludes && !msg.includes(msgIncludes)) {
      console.log(`  ❌ ${label} (falsche Meldung: ${msg})`);
      failures++;
    } else {
      console.log(`  ✅ ${label}`);
    }
  }
}

const createdTxIds: string[] = [];
async function getTx(id: string): Promise<any> {
  return pb(`/api/collections/transactions/records/${id}`);
}
async function cleanup() {
  for (const id of createdTxIds) {
    try {
      await pb(`/api/collections/transactions/records/${id}`, { method: "DELETE" });
    } catch (e) {
      console.warn(`  ⚠️  cleanup ${id}: ${(e as Error).message}`);
    }
  }
}

async function main() {
  await auth();
  console.log("=== Integration: stornoTransaction gegen DEMO ===\n");

  // Original-Einnahme
  console.log("1. Storno einer Einnahme:");
  const orig = await createManualTransaction({
    mosqueId: DEMO,
    buchungsdatum: "2026-04-01",
    betragCents: 7000,
    typ: "einnahme",
    kategorie: "spenden",
    beschreibung: "TEST Storno-Original",
    kontoTyp: "cash",
    zahlungskanal: "bar",
  });
  createdTxIds.push(orig.id);

  const storno = await stornoTransaction({ mosqueId: DEMO, transactionId: orig.id, grund: "Testkorrektur" });
  createdTxIds.push(storno.id);

  const sTx = await getTx(storno.id);
  ok(storno.beleg_nummer !== orig.beleg_nummer, `Storno hat eigene Belegnummer (${storno.beleg_nummer})`);
  ok(sTx.typ === "ausgabe", "Storno typ=ausgabe (invertiert)");
  ok(sTx.classification === "expense", "Storno classification=expense (invertiert)");
  ok(sTx.storno_of === orig.id, "storno_of zeigt auf Original");
  ok(sTx.is_storno === true, "is_storno=true");
  ok(sTx.quelle === "storno", "quelle=storno");
  ok(sTx.betrag_cents === 7000, "gleicher Betrag");
  ok(sTx.kategorie === "spenden", "gleiche Kategorie (Netting in Original-Topf)");
  ok(sTx.interne_notiz === "Testkorrektur", "grund → interne_notiz");
  // V-A: offene Periode → Storno bucht ins Original-Datum (2026-04-01), nicht heute
  ok(String(sTx.buchungsdatum).slice(0, 10) === "2026-04-01", "V-A: Storno bucht in Original-Periode (same period)");

  // Original unverändert
  const origAfter = await getTx(orig.id);
  ok(origAfter.is_storno === false, "Original is_storno weiterhin false");
  ok(origAfter.typ === "einnahme", "Original typ unverändert");
  ok(origAfter.betrag_cents === 7000, "Original betrag unverändert");

  // EÜR-Netting via toLedgerAtom: Σ signed (Original + Storno) = 0
  console.log("\n2. EÜR-Netting:");
  const aOrig = toLedgerAtom(origAfter as any);
  const aStorno = toLedgerAtom(sTx as any);
  ok(aOrig.signed_amount_cents === 7000, "Original signed = +7000");
  ok(aStorno.signed_amount_cents === -7000, "Storno signed = -7000");
  ok(aOrig.signed_amount_cents + aStorno.signed_amount_cents === 0, "Netting Σ = 0 in Kategorie spenden");

  // Doppel-Storno → abgelehnt
  console.log("\n3. Doppel-Storno abgelehnt:");
  await throwsAsync(
    () => stornoTransaction({ mosqueId: DEMO, transactionId: orig.id }),
    "zweites Storno → already_storniert",
    "already_storniert"
  );

  // Storno eines Stornos → abgelehnt
  console.log("\n4. Storno eines Stornos abgelehnt:");
  await throwsAsync(
    () => stornoTransaction({ mosqueId: DEMO, transactionId: storno.id }),
    "Storno der Storno-Buchung → cannot_storno_a_storno",
    "cannot_storno_a_storno"
  );
}

main()
  .then(async () => {
    await cleanup();
    console.log("");
    if (failures > 0) {
      console.error(`❌ ${failures} Test(s) fehlgeschlagen.`);
      process.exit(1);
    }
    console.log("✅ Alle stornoTransaction-Tests grün.");
    process.exit(0);
  })
  .catch(async (e) => {
    await cleanup();
    console.error("❌ Test-Fehler:", e?.message || e);
    process.exit(2);
  });
