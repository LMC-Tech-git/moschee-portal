/**
 * Integration-Test: markSponsorPaidAndEmit.
 * Sponsor + amount_cents × months_paid → Emit → betrag korrekt.
 *
 * Lauf: npx tsx scripts/test-sponsor-paid.mts <DEMO_MOSQUE_ID>
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getAdminPB } from "@/lib/pocketbase-admin";
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

async function main() {
  const pb = await getAdminPB();
  let sponsorId: string | null = null;

  try {
    console.log("=== test-sponsor-paid ===");

    const ts = Date.now();
    const sponsor = await pb.collection("sponsors").create({
      mosque_id: DEMO_ID,
      name: `Test Sponsor ${ts}`,
      amount_cents: 5000, // 50€/Monat
      payment_status: "paid",
      payment_method: "transfer",
      months_paid: 3,
      paid_at: new Date().toISOString(),
      is_active: true,
      is_approved: true,
    });
    sponsorId = sponsor.id;
    console.log(`✅ Sponsor erstellt: ${sponsorId} (50€/Monat × 3 = 150€)`);

    const paidAt = new Date().toISOString();
    await markSponsorPaidAndEmit(sponsorId, paidAt, {
      mosqueIdHint: DEMO_ID,
      paymentMethod: "transfer",
      monthsPaid: 3,
      ctx: { backfill: true },
    });

    const evts = await pb.collection("finance_source_events").getFullList({
      filter: `source_id="${sponsorId}" && event_type="income_received" && source_collection="sponsors"`,
    });
    if (evts.length !== 1) throw new Error(`${evts.length} Events erwartet 1`);
    const e = evts[0];
    if (e.betrag_cents !== 15000) throw new Error(`betrag=${e.betrag_cents} erwartet 15000 (50×3×100)`);
    if (e.konto_typ !== "bank") throw new Error(`konto=${e.konto_typ}`);
    if (e.zahlungskanal !== "ueberweisung") throw new Error(`kanal=${e.zahlungskanal}`);
    console.log("✅ Event: betrag=15000, konto=bank, kanal=ueberweisung");

    // Idempotenz
    await markSponsorPaidAndEmit(sponsorId, paidAt, {
      mosqueIdHint: DEMO_ID,
      paymentMethod: "transfer",
      monthsPaid: 3,
      ctx: { backfill: true },
    });
    const evts2 = await pb.collection("finance_source_events").getFullList({
      filter: `source_id="${sponsorId}" && event_type="income_received"`,
    });
    if (evts2.length !== 1) throw new Error(`Doppel: ${evts2.length} Events`);
    console.log("✅ Idempotent (Doppel-Call → 0 neue Events)");

    console.log("\n✅ test-sponsor-paid BESTANDEN");
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
