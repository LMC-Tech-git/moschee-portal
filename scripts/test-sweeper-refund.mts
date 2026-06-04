/**
 * Integration-Test: Sweeper refund-Branch.
 * Donation+received-Event manuell + refund_amount_cents>0 ohne Refund-Event
 * → Sweeper emittiert 1 Σ-Event, 2. Lauf 0 emit.
 *
 * Lauf: npx tsx scripts/test-sweeper-refund.mts <DEMO_MOSQUE_ID>
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "node:child_process";
import { getAdminPB } from "@/lib/pocketbase-admin";
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
const DEMO_ID = process.argv[2] || env.NEXT_PUBLIC_DEMO_MOSQUE_ID || "";
if (!DEMO_ID) { console.error("Kein DEMO_MOSQUE_ID"); process.exit(1); }

async function main() {
  const pb = await getAdminPB();
  let donationId: string | null = null;

  try {
    console.log("=== test-sweeper-refund ===");

    const ts = Date.now();

    // 1. Donation + income_received
    const don = await pb.collection("donations").create({
      mosque_id: DEMO_ID,
      amount: 30,
      amount_cents: 3000,
      status: "refunded",
      paid_at: new Date().toISOString(),
      refunded_at: new Date().toISOString(),
      refund_amount_cents: 3000,
      provider: "stripe",
      provider_ref: `test_pi_sw_${ts}`,
      currency: "EUR",
    });
    donationId = don.id;

    await markDonationPaidAndEmit(donationId, new Date().toISOString(), { mosqueIdHint: DEMO_ID, ctx: { backfill: true } });
    console.log("✅ Donation + income_received erstellt");

    // Verify kein Refund-Event existiert
    const before = await pb.collection("finance_source_events").getFullList({
      filter: `source_id="${donationId}" && (event_type="income_refunded" || event_type="chargeback")`,
    });
    if (before.length !== 0) throw new Error(`${before.length} Refund-Events vor Sweeper erwartet 0`);

    // 2. Sweeper laufen lassen
    console.log("→ Sweeper laufen lassen...");
    const nodeExe = `"C:\\Program Files\\nodejs\\node.exe"`;
    execSync(`${nodeExe} scripts/backfill-finance-events.mjs ${DEMO_ID}`, {
      cwd: resolve(__dirname, ".."),
      stdio: "inherit",
    });

    // 3. Verify 1 Refund-Event existiert
    const after = await pb.collection("finance_source_events").getFullList({
      filter: `source_id="${donationId}" && (event_type="income_refunded" || event_type="chargeback")`,
    });
    if (after.length !== 1) throw new Error(`${after.length} Refund-Events nach Sweeper erwartet 1`);
    console.log("✅ 1 Refund-Event nach Sweeper");

    // 4. 2. Sweeper-Lauf → 0 neue Events
    execSync(`${nodeExe} scripts/backfill-finance-events.mjs ${DEMO_ID}`, {
      cwd: resolve(__dirname, ".."),
      stdio: "inherit",
    });
    const after2 = await pb.collection("finance_source_events").getFullList({
      filter: `source_id="${donationId}" && (event_type="income_refunded" || event_type="chargeback")`,
    });
    if (after2.length !== 1) throw new Error(`${after2.length} Events nach 2. Sweeper erwartet 1`);
    console.log("✅ 2. Sweeper-Lauf → 0 neue Events (idempotent)");

    console.log("\n✅ test-sweeper-refund BESTANDEN");
  } finally {
    if (donationId) {
      try {
        const list = await pb.collection("finance_source_events").getFullList({ filter: `source_id="${donationId}"` });
        for (const r of list) await pb.collection("finance_source_events").delete(r.id);
      } catch {}
      try { await pb.collection("donations").delete(donationId); } catch {}
    }
    console.log("🧹 Cleanup done");
  }
}

main().catch((e) => { console.error("❌", e?.message || e); process.exit(1); });
