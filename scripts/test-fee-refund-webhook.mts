/**
 * Integration-Test: fee-Refund via refundIncome(sourceCollection="student_fees").
 * Simuliert den Webhook-Pfad: Fee + income_received → refundIncome → 1 Refund-Event.
 *
 * Lauf: npx tsx scripts/test-fee-refund-webhook.mts <DEMO_MOSQUE_ID>
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { markStudentFeePaidAndEmit } from "@/lib/actions/student-fees";
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
  let feeId: string | null = null;

  try {
    console.log("=== test-fee-refund-webhook ===");

    const ts = Date.now();
    // Echten Schüler holen (student_id ist eine Relation)
    const students = await pb.collection("students").getList(1, 1, { filter: `mosque_id="${DEMO_ID}"` });
    const studentId = students.items[0]?.id;
    if (!studentId) throw new Error("Kein Schüler in Demo-Moschee gefunden");

    const fee = await pb.collection("student_fees").create({
      mosque_id: DEMO_ID,
      student_id: studentId,
      month_key: `2099-${String(ts).slice(-2).padStart(2, "0")}`,
      amount_cents: 4000,
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_method: "stripe",
      provider_ref: `cs_test_fee_${ts}`,
    });
    feeId = fee.id;

    // income_received emittieren
    await markStudentFeePaidAndEmit(feeId, new Date().toISOString(), {
      mosqueIdHint: DEMO_ID, paymentMethod: "stripe", ctx: { webhook: true },
    });
    console.log("✅ Fee + income_received erstellt");

    // refundIncome (Webhook-Pfad simuliert)
    const r = await refundIncome({
      mosqueId: DEMO_ID,
      sourceCollection: "student_fees",
      sourceId: feeId,
      refundAmountCents: 4000,
      externalEventId: `re_fee_${ts}`,
      eventType: "income_refunded",
      occurredAt: new Date().toISOString(),
      ctx: { webhook: true },
    });
    console.log(`✅ refundIncome(student_fees): eventUuid=${r.eventUuid} dup=${r.duplicated}`);

    // Assert: 1 Refund-Event mit korrektem source_collection + related_event_id
    const evts = await pb.collection("finance_source_events").getFullList({
      filter: `source_id="${feeId}" && source_collection="student_fees" && event_type="income_refunded"`,
    });
    if (evts.length !== 1) throw new Error(`${evts.length} Refund-Events erwartet 1`);
    if (evts[0].classification !== "expense") throw new Error(`classification=${evts[0].classification}`);
    if (evts[0].betrag_cents !== 4000) throw new Error(`betrag=${evts[0].betrag_cents}`);
    if (!evts[0].related_event_id) throw new Error("related_event_id leer");
    console.log("✅ Refund-Event: source=student_fees, expense, betrag=4000, related gesetzt");

    console.log("\n✅ test-fee-refund-webhook BESTANDEN");
  } finally {
    if (feeId) {
      try {
        const list = await pb.collection("finance_source_events").getFullList({ filter: `source_id="${feeId}"` });
        for (const r of list) await pb.collection("finance_source_events").delete(r.id);
      } catch {}
      try { await pb.collection("student_fees").delete(feeId); } catch {}
    }
    console.log("🧹 Cleanup done");
  }
}

main().catch((e) => { console.error("❌", e?.message || e); process.exit(1); });
