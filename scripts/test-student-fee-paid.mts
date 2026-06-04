/**
 * Integration-Test: markStudentFeePaidAndEmit.
 * Fee → 1 income_received-Event, konto/kanal korrekt. Doppel-Call → +0 Events.
 *
 * Lauf: npx tsx scripts/test-student-fee-paid.mts <DEMO_MOSQUE_ID>
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { markStudentFeePaidAndEmit } from "@/lib/actions/student-fees";

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
  let feeId: string | null = null;

  try {
    console.log("=== test-student-fee-paid ===");

    const ts = Date.now();

    // Dummy-Student (nur für FK, kein echter Student nötig in tests)
    // Wir erstellen eine Fee ohne Student (student_id optional falls PB-Schema erlaubt)
    // Falls nicht: PB gibt Fehler → wir überspringen Student-Erstellung und nutzen Dummy
    const fee = await pb.collection("student_fees").create({
      mosque_id: DEMO_ID,
      student_id: "test_dummy_student",
      month_key: `2026-${String(ts).slice(-2).padStart(2, "0")}`,
      amount_cents: 1500,
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_method: "cash",
    });
    feeId = fee.id;
    console.log(`✅ StudentFee erstellt: ${feeId}`);

    // 1. Emit
    const paidAt = new Date().toISOString();
    await markStudentFeePaidAndEmit(feeId, paidAt, {
      mosqueIdHint: DEMO_ID,
      paymentMethod: "cash",
      ctx: { backfill: true },
    });
    console.log("✅ markStudentFeePaidAndEmit OK");

    // 2. Verify Event
    const evts = await pb.collection("finance_source_events").getFullList({
      filter: `source_id="${feeId}" && event_type="income_received" && source_collection="student_fees"`,
    });
    if (evts.length !== 1) throw new Error(`${evts.length} Events erwartet 1`);
    const e = evts[0];
    if (e.konto_typ !== "cash") throw new Error(`konto_typ=${e.konto_typ} erwartet cash`);
    if (e.zahlungskanal !== "bar") throw new Error(`zahlungskanal=${e.zahlungskanal} erwartet bar`);
    if (e.betrag_cents !== 1500) throw new Error(`betrag_cents=${e.betrag_cents} erwartet 1500`);
    console.log("✅ Event: konto=cash, kanal=bar, betrag=1500");

    // 3. Doppel-Call → UNIQUE → +0 neue Events
    await markStudentFeePaidAndEmit(feeId, paidAt, {
      mosqueIdHint: DEMO_ID,
      paymentMethod: "cash",
      ctx: { backfill: true },
    });
    const evts2 = await pb.collection("finance_source_events").getFullList({
      filter: `source_id="${feeId}" && event_type="income_received"`,
    });
    if (evts2.length !== 1) throw new Error(`Doppel-Call: ${evts2.length} Events erwartet 1`);
    console.log("✅ Doppel-Call → 0 neue Events (idempotent)");

    // 4. Transfer-Kanal
    const fee2 = await pb.collection("student_fees").create({
      mosque_id: DEMO_ID,
      student_id: "test_dummy_student",
      month_key: `2026-0${String(ts).slice(-1)}`,
      amount_cents: 2000,
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_method: "transfer",
    });
    await markStudentFeePaidAndEmit(fee2.id, new Date().toISOString(), {
      mosqueIdHint: DEMO_ID,
      paymentMethod: "transfer",
      ctx: { backfill: true },
    });
    const evts3 = await pb.collection("finance_source_events").getFullList({
      filter: `source_id="${fee2.id}" && event_type="income_received"`,
    });
    if (evts3[0].konto_typ !== "bank" || evts3[0].zahlungskanal !== "ueberweisung") {
      throw new Error(`transfer: konto=${evts3[0].konto_typ} kanal=${evts3[0].zahlungskanal}`);
    }
    console.log("✅ Transfer-Kanal: konto=bank, kanal=ueberweisung");
    // Cleanup fee2
    try {
      await pb.collection("finance_source_events").delete(evts3[0].id);
      await pb.collection("student_fees").delete(fee2.id);
    } catch {}

    console.log("\n✅ test-student-fee-paid BESTANDEN");
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
