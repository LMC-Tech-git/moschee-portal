/**
 * Integration-Test: Sum-Guard — refund > original → throw.
 *
 * Lauf: npx tsx scripts/test-sum-guard.mts <DEMO_MOSQUE_ID>
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { markDonationPaidAndEmit } from "@/lib/actions/donations";
import { refundIncome } from "@/lib/actions/finance-domain";

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
    console.log("=== test-sum-guard ===");

    const ts = Date.now();
    const don = await pb.collection("donations").create({
      mosque_id: DEMO_ID,
      amount: 10,
      amount_cents: 1000,
      status: "paid",
      paid_at: new Date().toISOString(),
      provider: "stripe",
      provider_ref: `test_pi_sg_${ts}`,
      currency: "EUR",
    });
    donationId = don.id;

    await markDonationPaidAndEmit(donationId, new Date().toISOString(), { mosqueIdHint: DEMO_ID, ctx: { backfill: true } });

    // refund > original → throw
    let threw = false;
    try {
      await refundIncome({
        mosqueId: DEMO_ID,
        sourceCollection: "donations",
        sourceId: donationId,
        refundAmountCents: 2000, // > 1000
        externalEventId: `re_over_${ts}`,
        occurredAt: new Date().toISOString(),
        ctx: { backfill: true },
      });
    } catch (e: unknown) {
      if (String(e).includes("refund_exceeds_original")) {
        threw = true;
        console.log("✅ refund_exceeds_original geworfen");
      } else throw e;
    }
    if (!threw) throw new Error("Sum-Guard hat NICHT geworfen");

    // Partial 60% ok
    await refundIncome({
      mosqueId: DEMO_ID,
      sourceCollection: "donations",
      sourceId: donationId,
      refundAmountCents: 600,
      externalEventId: `re_p1_${ts}`,
      occurredAt: new Date().toISOString(),
      ctx: { backfill: true },
    });
    console.log("✅ Partial 60% ok");

    // 2. Partial 60% → Σ=1200 > 1000 → throw
    let threw2 = false;
    try {
      await refundIncome({
        mosqueId: DEMO_ID,
        sourceCollection: "donations",
        sourceId: donationId,
        refundAmountCents: 600,
        externalEventId: `re_p2_${ts}`,
        occurredAt: new Date().toISOString(),
        ctx: { backfill: true },
      });
    } catch (e: unknown) {
      if (String(e).includes("refund_exceeds_original")) {
        threw2 = true;
        console.log("✅ Sequentieller Sum-Guard ok (Σ > original)");
      } else throw e;
    }
    if (!threw2) throw new Error("Sum-Guard 2 hat NICHT geworfen");

    console.log("\n✅ test-sum-guard BESTANDEN");
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
