/**
 * Integration-Test: chargeback-Variant von refundIncome.
 * event_type=chargeback, relation_type=chargeback_of, donation.status=disputed.
 *
 * Lauf: npx tsx scripts/test-chargeback.mts <DEMO_MOSQUE_ID>
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
    console.log("=== test-chargeback ===");

    const ts = Date.now();
    const don = await pb.collection("donations").create({
      mosque_id: DEMO_ID,
      amount: 20,
      amount_cents: 2000,
      status: "paid",
      paid_at: new Date().toISOString(),
      provider: "stripe",
      provider_ref: `test_pi_cb_${ts}`,
      currency: "EUR",
    });
    donationId = don.id;

    await markDonationPaidAndEmit(donationId, new Date().toISOString(), { mosqueIdHint: DEMO_ID, ctx: { backfill: true } });

    const r = await refundIncome({
      mosqueId: DEMO_ID,
      sourceCollection: "donations",
      sourceId: donationId,
      refundAmountCents: 2000,
      externalEventId: `dp_test_${ts}`,
      eventType: "chargeback",
      reason: "fraudulent",
      occurredAt: new Date().toISOString(),
      ctx: { backfill: true },
    });

    if (r.duplicated) throw new Error("Unexpectedly duplicated");
    console.log(`✅ chargeback: eventUuid=${r.eventUuid}`);

    // Verify event_type=chargeback, relation_type=chargeback_of
    const evts = await pb.collection("finance_source_events").getFullList({
      filter: `source_id="${donationId}" && event_type="chargeback"`,
    });
    if (evts.length !== 1) throw new Error(`${evts.length} chargeback-Events`);
    if (evts[0].relation_type !== "chargeback_of") throw new Error(`relation_type=${evts[0].relation_type}`);
    console.log("✅ event_type=chargeback, relation_type=chargeback_of");

    // donation.status=disputed
    const updDon = await pb.collection("donations").getOne(donationId);
    if (updDon.status !== "disputed") throw new Error(`status=${updDon.status} erwartet disputed`);
    console.log("✅ donation.status=disputed");

    console.log("\n✅ test-chargeback BESTANDEN");
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
