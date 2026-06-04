/**
 * Integration-Test: sponsor-Refund via refundIncome(sourceCollection="sponsors").
 * Simuliert den Webhook-Pfad: Sponsor + income_received → refundIncome → 1 Refund-Event.
 *
 * Lauf: npx tsx scripts/test-sponsor-refund-webhook.mts <DEMO_MOSQUE_ID>
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { markSponsorPaidAndEmit } from "@/lib/actions/sponsors";
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
for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
const DEMO_ID = process.argv[2] || env.NEXT_PUBLIC_DEMO_MOSQUE_ID || "";
if (!DEMO_ID) { console.error("Kein DEMO_MOSQUE_ID"); process.exit(1); }

async function main() {
  const pb = await getAdminPB();
  let sponsorId: string | null = null;

  try {
    console.log("=== test-sponsor-refund-webhook ===");

    const ts = Date.now();
    const sponsor = await pb.collection("sponsors").create({
      mosque_id: DEMO_ID,
      name: `RefundTest Sponsor ${ts}`,
      amount_cents: 6000,
      payment_status: "paid",
      payment_method: "stripe",
      months_paid: 2,
      paid_at: new Date().toISOString(),
      provider_ref: `cs_test_sp_${ts}`,
      is_active: true,
      is_approved: true,
    });
    sponsorId = sponsor.id;

    // income_received emittieren (betrag = 6000 × 2 = 12000)
    await markSponsorPaidAndEmit(sponsorId, new Date().toISOString(), {
      mosqueIdHint: DEMO_ID, paymentMethod: "stripe", monthsPaid: 2, ctx: { webhook: true },
    });
    console.log("✅ Sponsor + income_received (12000) erstellt");

    // refundIncome (Webhook-Pfad simuliert) — Teilerstattung 6000
    const r = await refundIncome({
      mosqueId: DEMO_ID,
      sourceCollection: "sponsors",
      sourceId: sponsorId,
      refundAmountCents: 6000,
      externalEventId: `re_sp_${ts}`,
      eventType: "income_refunded",
      occurredAt: new Date().toISOString(),
      ctx: { webhook: true },
    });
    console.log(`✅ refundIncome(sponsors): eventUuid=${r.eventUuid} dup=${r.duplicated}`);

    const evts = await pb.collection("finance_source_events").getFullList({
      filter: `source_id="${sponsorId}" && source_collection="sponsors" && event_type="income_refunded"`,
    });
    if (evts.length !== 1) throw new Error(`${evts.length} Refund-Events erwartet 1`);
    if (evts[0].classification !== "expense") throw new Error(`classification=${evts[0].classification}`);
    if (evts[0].betrag_cents !== 6000) throw new Error(`betrag=${evts[0].betrag_cents}`);
    if (!evts[0].related_event_id) throw new Error("related_event_id leer");
    console.log("✅ Refund-Event: source=sponsors, expense, betrag=6000, related gesetzt");

    console.log("\n✅ test-sponsor-refund-webhook BESTANDEN");
  } finally {
    if (sponsorId) {
      try {
        const list = await pb.collection("finance_source_events").getFullList({ filter: `source_id="${sponsorId}"` });
        for (const r of list) await pb.collection("finance_source_events").delete(r.id);
      } catch {}
      try { await pb.collection("sponsors").delete(sponsorId); } catch {}
    }
    console.log("🧹 Cleanup done");
  }
}

main().catch((e) => { console.error("❌", e?.message || e); process.exit(1); });
