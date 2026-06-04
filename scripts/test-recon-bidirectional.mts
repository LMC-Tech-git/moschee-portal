/**
 * Integration-Test: Recon 6-Bucket bidirektional.
 * Seed: 2 paid donations + 1 refund + 1 fee paid + 1 sponsor paid
 * → Recon exit 0, alle 6 Buckets Δ=0.
 * Dann: manipuliere donation.refund_amount_cents → Recon exit 1 (Drift).
 *
 * Lauf: npx tsx scripts/test-recon-bidirectional.mts <DEMO_MOSQUE_ID>
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync, spawnSync } from "node:child_process";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { markDonationPaidAndEmit } from "@/lib/actions/donations";
import { refundIncome } from "@/lib/actions/finance-domain";
import { markStudentFeePaidAndEmit } from "@/lib/actions/student-fees";
import { markSponsorPaidAndEmit } from "@/lib/actions/sponsors";

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

const NODE = `"C:\\Program Files\\nodejs\\node.exe"`;

function runRecon(expectExit: number) {
  const r = spawnSync(NODE, ["scripts/recon-source-vs-events.mjs", "--mosque", DEMO_ID], {
    shell: true,
    cwd: resolve(__dirname, ".."),
    encoding: "utf-8",
  });
  console.log(r.stdout || r.stderr || "");
  if (r.status !== expectExit) throw new Error(`Recon exit=${r.status} erwartet ${expectExit}`);
}

async function main() {
  const pb = await getAdminPB();
  const created: { coll: string; id: string }[] = [];

  try {
    console.log("=== test-recon-bidirectional ===");

    const ts = Date.now();
    const now = new Date().toISOString();

    // 1. 2 paid donations
    const d1 = await pb.collection("donations").create({
      mosque_id: DEMO_ID, amount: 50, amount_cents: 5000, status: "paid",
      paid_at: now, provider: "stripe", provider_ref: `pi_rb1_${ts}`, currency: "EUR",
    });
    created.push({ coll: "donations", id: d1.id });
    const d2 = await pb.collection("donations").create({
      mosque_id: DEMO_ID, amount: 30, amount_cents: 3000, status: "paid",
      paid_at: now, provider: "manual", provider_ref: `pi_rb2_${ts}`, currency: "EUR",
    });
    created.push({ coll: "donations", id: d2.id });
    await markDonationPaidAndEmit(d1.id, now, { mosqueIdHint: DEMO_ID, ctx: { backfill: true } });
    await markDonationPaidAndEmit(d2.id, now, { mosqueIdHint: DEMO_ID, ctx: { backfill: true } });

    // 2. 1 refund
    await refundIncome({
      mosqueId: DEMO_ID, sourceCollection: "donations", sourceId: d1.id,
      refundAmountCents: 2000, externalEventId: `re_rb1_${ts}`,
      occurredAt: now, ctx: { backfill: true },
    });

    // 3. 1 fee paid
    const fee = await pb.collection("student_fees").create({
      mosque_id: DEMO_ID, student_id: "dummy", month_key: `2026-01`,
      amount_cents: 1000, status: "paid", paid_at: now, payment_method: "cash",
    });
    created.push({ coll: "student_fees", id: fee.id });
    await markStudentFeePaidAndEmit(fee.id, now, { mosqueIdHint: DEMO_ID, paymentMethod: "cash", ctx: { backfill: true } });

    // 4. 1 sponsor paid
    const sp = await pb.collection("sponsors").create({
      mosque_id: DEMO_ID, name: `ReconTest ${ts}`, amount_cents: 3000,
      payment_status: "paid", payment_method: "transfer", months_paid: 1,
      paid_at: now, is_active: true, is_approved: true,
    });
    created.push({ coll: "sponsors", id: sp.id });
    await markSponsorPaidAndEmit(sp.id, now, { mosqueIdHint: DEMO_ID, paymentMethod: "transfer", monthsPaid: 1, ctx: { backfill: true } });

    console.log("✅ Seeds erstellt. Recon läuft (erwartet exit=0)...");
    runRecon(0);
    console.log("✅ Recon exit=0 (kein Drift)");

    // 5. Drift erzeugen: donation.refund_amount_cents manipulieren
    await pb.collection("donations").update(d1.id, { refund_amount_cents: 3000 }); // war 2000
    console.log("→ refund_amount_cents manipuliert (2000→3000). Recon (erwartet exit=1)...");
    runRecon(1);
    console.log("✅ Recon exit=1 (Drift erkannt)");

    // Repair
    await pb.collection("donations").update(d1.id, { refund_amount_cents: 2000 });

    console.log("\n✅ test-recon-bidirectional BESTANDEN");
  } finally {
    // Events zuerst, dann Quellen
    for (const { id } of created) {
      try {
        const list = await pb.collection("finance_source_events").getFullList({ filter: `source_id="${id}"` });
        for (const r of list) await pb.collection("finance_source_events").delete(r.id);
      } catch {}
    }
    for (const { coll, id } of created) {
      try { await pb.collection(coll).delete(id); } catch {}
    }
    console.log("🧹 Cleanup done");
  }
}

main().catch((e) => { console.error("❌", e?.message || e); process.exit(1); });
