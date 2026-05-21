/**
 * Integration-Test createIncome (Plan §13.3) — ECHTE Server-Action gegen DEMO.
 *
 * Deckt:
 *  - manueller mark-paid → 1 Event + Quelle gesperrt
 *  - Webhook-ctx mark-paid → 1 Event + Quelle gesperrt (F2)
 *  - 2× selber Aufruf → 1 Event + duplicated
 *  - R1: Lock manuell entfernt → backfill-sweeper → Lock zurück
 *  - F8: finally-Cleanup (Event + Donation löschen)
 *
 * M6 Demo-Guard: läuft NUR gegen NEXT_PUBLIC_DEMO_MOSQUE_ID.
 *
 * Lauf:  npx tsx scripts/test-createincome-flow.mts <DEMO_MOSQUE_ID>
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "node:child_process";
import { markDonationPaidAndEmit } from "@/lib/actions/donations";

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

// M6 Demo-Guard
if (!DEMO || target !== DEMO) {
  console.error(`Refuse: Tests run only against DEMO_MOSQUE_ID. Got: ${target}, expected: ${DEMO}`);
  process.exit(2);
}
// Server-Actions lesen PB via process.env → sicherstellen dass gesetzt
process.env.POCKETBASE_URL = process.env.POCKETBASE_URL || PB_URL;
process.env.NEXT_PUBLIC_POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || PB_URL;
process.env.PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || ADMIN_EMAIL;
process.env.PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || ADMIN_PASSWORD;

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

async function countEvents(sourceId: string): Promise<number> {
  const r = await pb(
    `/api/collections/finance_source_events/records?filter=${encodeURIComponent(`source_id="${sourceId}"`)}&perPage=50`
  );
  return r.totalItems ?? (r.items?.length || 0);
}
async function getDonation(id: string): Promise<any> {
  return pb(`/api/collections/donations/records/${id}`);
}

const createdDonationIds: string[] = [];

async function createDemoDonation(suffix: string): Promise<string> {
  const rec = await pb(`/api/collections/donations/records`, {
    method: "POST",
    body: JSON.stringify({
      mosque_id: DEMO,
      donor_type: "guest",
      donor_name: `TEST-${suffix}-${crypto.randomUUID().slice(0, 8)}`,
      amount: 12.34,
      amount_cents: 1234,
      currency: "EUR",
      provider: "manual",
      category: "sadaqa",
      status: "pending",
    }),
  });
  createdDonationIds.push(rec.id);
  return rec.id;
}

async function cleanup() {
  for (const did of createdDonationIds) {
    try {
      const evs = await pb(
        `/api/collections/finance_source_events/records?filter=${encodeURIComponent(`source_id="${did}"`)}&perPage=50`
      );
      for (const e of evs.items || []) {
        await pb(`/api/collections/finance_source_events/records/${e.id}`, { method: "DELETE" });
      }
      await pb(`/api/collections/donations/records/${did}`, { method: "DELETE" });
    } catch (e) {
      console.warn(`  ⚠️  cleanup ${did}: ${(e as Error).message}`);
    }
  }
}

async function main() {
  await auth();
  console.log("=== Integration: createIncome gegen DEMO ===\n");

  // 1. Manueller mark-paid
  console.log("1. Manueller mark-paid:");
  const d1 = await createDemoDonation("manual");
  const paidAt = new Date().toISOString();
  const r1 = await markDonationPaidAndEmit(d1, paidAt, { mosqueIdHint: DEMO });
  ok(r1.duplicated === false, "erster Aufruf nicht duplicated");
  ok((await countEvents(d1)) === 1, "genau 1 Event");
  const ev1 = (await pb(`/api/collections/finance_source_events/records?filter=${encodeURIComponent(`source_id="${d1}"`)}`)).items[0];
  ok(ev1.classification === "income", "classification=income");
  ok(ev1.event_type === "income_received", "event_type=income_received");
  ok(!("amount_cents" in JSON.parse(ev1.payload_json)), "payload_json ohne amount_cents (R3)");
  ok((await getDonation(d1)).is_financially_locked === true, "Quelle gesperrt");

  // 2. 2× selber Aufruf → duplicated, weiterhin 1 Event
  console.log("\n2. Idempotenz (2. Aufruf):");
  const r1b = await markDonationPaidAndEmit(d1, paidAt, { mosqueIdHint: DEMO });
  ok(r1b.duplicated === true, "2. Aufruf duplicated");
  ok((await countEvents(d1)) === 1, "weiterhin genau 1 Event");

  // 3. R1: Lock entfernen → backfill-sweeper → Lock zurück
  console.log("\n3. R1 Lock-Drift-Recovery:");
  await pb(`/api/collections/donations/records/${d1}`, {
    method: "PATCH",
    body: JSON.stringify({ is_financially_locked: false }),
  });
  ok((await getDonation(d1)).is_financially_locked === false, "Lock manuell entfernt");
  execSync(`"${process.execPath}" scripts/backfill-finance-events.mjs ${DEMO}`, {
    cwd: resolve(__dirname, ".."),
    stdio: "ignore",
  });
  ok((await getDonation(d1)).is_financially_locked === true, "Sweeper hat Lock zurückgesetzt");
  ok((await countEvents(d1)) === 1, "Sweeper erzeugt kein Duplikat");

  // 4. Webhook-ctx (F2)
  console.log("\n4. Webhook-Pfad (F2, ctx:webhook):");
  const d2 = await createDemoDonation("webhook");
  const r2 = await markDonationPaidAndEmit(d2, new Date().toISOString(), {
    mosqueIdHint: DEMO,
    externalEventId: "evt_test_" + crypto.randomUUID().slice(0, 8),
    ctx: { webhook: true },
  });
  ok(r2.duplicated === false, "Webhook-Emit nicht duplicated");
  ok((await countEvents(d2)) === 1, "genau 1 Event (Webhook)");
  ok((await getDonation(d2)).is_financially_locked === true, "Quelle gesperrt (Webhook)");
}

main()
  .then(async () => {
    await cleanup();
    console.log("");
    if (failures > 0) {
      console.error(`❌ ${failures} Test(s) fehlgeschlagen.`);
      process.exit(1);
    }
    console.log("✅ Alle Integration-Tests grün.");
    process.exit(0);
  })
  .catch(async (e) => {
    await cleanup();
    console.error("❌ Test-Fehler:", e?.message || e);
    process.exit(2);
  });
