/**
 * Integration-Test refundIncome (Sprint 5) — DEMO-only.
 *
 * Deckt:
 *  - Donation + income_received → refundIncome voll → Event-Felder korrekt
 *  - donation.refund_amount_cents = parent.betrag_cents, status="refunded"
 *
 * Lauf: npx tsx scripts/test-refund-flow.mts <DEMO_MOSQUE_ID>
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

if (!DEMO_ID) {
  console.error("Kein DEMO_MOSQUE_ID — Lauf: npx tsx scripts/test-refund-flow.mts <id>");
  process.exit(1);
}

// Guard: nur Demo
if (DEMO_ID !== (env.NEXT_PUBLIC_DEMO_MOSQUE_ID || DEMO_ID)) {
  console.error("Nicht die Demo-Moschee — Abbruch.");
  process.exit(1);
}

async function main() {
  const pb = await getAdminPB();
  let donationId: string | null = null;
  let eventIds: string[] = [];

  try {
    console.log("=== test-refund-flow ===");

    // 1. Donation erstellen
    const don = await pb.collection("donations").create({
      mosque_id: DEMO_ID,
      amount: 50,
      amount_cents: 5000,
      status: "paid",
      paid_at: new Date().toISOString(),
      provider: "stripe",
      provider_ref: `test_pi_refund_${Date.now()}`,
      currency: "EUR",
    });
    donationId = don.id;
    console.log(`✅ Donation erstellt: ${donationId}`);

    // 2. income_received-Event emittieren
    const incomeResult = await markDonationPaidAndEmit(donationId, new Date().toISOString(), { mosqueIdHint: DEMO_ID, ctx: { backfill: true } });
    console.log(`✅ income_received: eventUuid=${incomeResult.eventUuid} dup=${incomeResult.duplicated}`);
    if (incomeResult.eventUuid) eventIds.push(incomeResult.eventUuid);

    // 3. refundIncome (voller Betrag)
    const refResult = await refundIncome({
      mosqueId: DEMO_ID,
      sourceCollection: "donations",
      sourceId: donationId,
      refundAmountCents: 5000,
      externalEventId: `re_test_full_${Date.now()}`,
      eventType: "income_refunded",
      occurredAt: new Date().toISOString(),
      ctx: { backfill: true },
    });
    console.log(`✅ refundIncome: eventUuid=${refResult.eventUuid} dup=${refResult.duplicated} total=${refResult.refundTotalCents}`);
    if (refResult.eventUuid) eventIds.push(refResult.eventUuid);

    // 4. Assertions
    const updatedDon = await pb.collection("donations").getOne(donationId);
    if (updatedDon.refund_amount_cents !== 5000) throw new Error(`refund_amount_cents=${updatedDon.refund_amount_cents} erwartet 5000`);
    if (updatedDon.status !== "refunded") throw new Error(`status=${updatedDon.status} erwartet refunded`);
    console.log("✅ donation.refund_amount_cents=5000, status=refunded");

    // Refund-Event Felder prüfen
    const refEvts = await pb.collection("finance_source_events").getFullList({
      filter: `source_id="${donationId}" && (event_type="income_refunded" || event_type="chargeback")`,
    });
    if (refEvts.length !== 1) throw new Error(`${refEvts.length} Refund-Events, erwartet 1`);
    const re = refEvts[0];
    if (re.classification !== "expense") throw new Error(`classification=${re.classification}`);
    if (re.betrag_cents !== 5000) throw new Error(`betrag_cents=${re.betrag_cents}`);
    if (!re.related_event_id) throw new Error("related_event_id leer");
    if (re.relation_type !== "refund_of") throw new Error(`relation_type=${re.relation_type}`);
    console.log("✅ Refund-Event-Felder korrekt");

    console.log("\n✅ test-refund-flow BESTANDEN");
  } finally {
    // Cleanup
    const evtPb = pb;
    for (const uuid of eventIds) {
      try {
        const list = await evtPb.collection("finance_source_events").getFullList({ filter: `event_uuid="${uuid}"` });
        for (const r of list) await evtPb.collection("finance_source_events").delete(r.id);
      } catch {}
    }
    // Auch alle Events für diese Donation löschen
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
