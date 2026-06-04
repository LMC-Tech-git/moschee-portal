/**
 * Integration-Test: 2× partial refundIncome → 2 Events, Σ=parent.
 * Wiederhole → UNIQUE +0.
 *
 * Lauf: npx tsx scripts/test-partial-refunds.mts <DEMO_MOSQUE_ID>
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
    console.log("=== test-partial-refunds ===");

    const ts = Date.now();
    const don = await pb.collection("donations").create({
      mosque_id: DEMO_ID,
      amount: 100,
      amount_cents: 10000,
      status: "paid",
      paid_at: new Date().toISOString(),
      provider: "stripe",
      provider_ref: `test_pi_partial_${ts}`,
      currency: "EUR",
    });
    donationId = don.id;

    await markDonationPaidAndEmit(donationId, new Date().toISOString(), { mosqueIdHint: DEMO_ID, ctx: { backfill: true } });

    // 1. 50% Refund
    const r1 = await refundIncome({
      mosqueId: DEMO_ID,
      sourceCollection: "donations",
      sourceId: donationId,
      refundAmountCents: 5000,
      externalEventId: `re_a_${ts}`,
      occurredAt: new Date().toISOString(),
      ctx: { backfill: true },
    });
    console.log(`✅ Partial 1: eventUuid=${r1.eventUuid} total=${r1.refundTotalCents}`);
    if (r1.refundTotalCents !== 5000) throw new Error(`total=${r1.refundTotalCents} erwartet 5000`);

    // 2. 50% Refund
    const r2 = await refundIncome({
      mosqueId: DEMO_ID,
      sourceCollection: "donations",
      sourceId: donationId,
      refundAmountCents: 5000,
      externalEventId: `re_b_${ts}`,
      occurredAt: new Date().toISOString(),
      ctx: { backfill: true },
    });
    console.log(`✅ Partial 2: eventUuid=${r2.eventUuid} total=${r2.refundTotalCents}`);
    if (r2.refundTotalCents !== 10000) throw new Error(`total=${r2.refundTotalCents} erwartet 10000`);

    // 3. Wiederhole → UNIQUE → dup=true
    const r3 = await refundIncome({
      mosqueId: DEMO_ID,
      sourceCollection: "donations",
      sourceId: donationId,
      refundAmountCents: 5000,
      externalEventId: `re_a_${ts}`,
      occurredAt: new Date().toISOString(),
      ctx: { backfill: true },
    });
    if (!r3.duplicated) throw new Error("r3 soll duplicated=true sein");
    console.log("✅ Doppel-Call → duplicated");

    // 4. Verify 2 Events in DB
    const evts = await pb.collection("finance_source_events").getFullList({
      filter: `source_id="${donationId}" && (event_type="income_refunded" || event_type="chargeback")`,
    });
    if (evts.length !== 2) throw new Error(`${evts.length} Events erwartet 2`);
    console.log("✅ 2 Partial-Events in DB");

    console.log("\n✅ test-partial-refunds BESTANDEN");
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
