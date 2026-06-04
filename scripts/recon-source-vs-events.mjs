#!/usr/bin/env node
/**
 * Recon: Σ(paid sources) vs Σ(income events) je Moschee+Jahr — 6 Buckets (Sprint 5).
 *
 * READ-ONLY. Bidirektional: received + refund/chargeback für donations/fees/sponsors.
 *
 * Buckets pro Jahr:
 *  donations-received  | donations.amount_cents (status=paid)         | income_received events
 *  donations-refund    | donations.refund_amount_cents (Σ)            | refund+chargeback events
 *  fees-received       | student_fees.amount_cents (status=paid)      | income_received events
 *  fees-refund         | n/a (= 0)                                    | refund+chargeback events
 *  sponsors-received   | sponsors.amount_cents × months_paid (paid)   | income_received events
 *  sponsors-refund     | n/a (= 0)                                    | refund+chargeback events
 *
 * Nutzung:
 *   node scripts/recon-source-vs-events.mjs --mosque <id>
 *   node scripts/recon-source-vs-events.mjs --all
 *   node scripts/recon-source-vs-events.mjs --mosque <id> --year 2026
 *
 * Exit:
 *   0 = alle Δ=0
 *   1 = Drift erkannt
 *   2 = Fehler / falsche Args
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
    const env = {};
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
    return env;
  } catch {
    return {};
  }
}

const env = loadEnv();
const PB_URL = env.POCKETBASE_URL || env.NEXT_PUBLIC_POCKETBASE_URL;
const ADMIN_EMAIL = env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = env.PB_ADMIN_PASSWORD;

const args = process.argv.slice(2);
function flagValue(name) {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return "";
  const next = args[i + 1];
  if (String(next).startsWith("--")) return "";
  return next;
}
const mosqueArg = flagValue("--mosque");
const allFlag = args.includes("--all");
const yearArg = flagValue("--year");

if (!PB_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Fehler: POCKETBASE_URL/PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD fehlt in .env.local");
  process.exit(2);
}

if (!mosqueArg && !allFlag) {
  console.error("Pflicht: --mosque <id> ODER --all");
  process.exit(2);
}

let authToken = "";

async function pbFetch(path, options = {}) {
  const res = await fetch(`${PB_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: authToken } : {}),
      ...options.headers,
    },
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const err = new Error(`PB ${res.status} ${path}: ${text}`);
    err.status = res.status;
    err.data = json;
    throw err;
  }
  return json;
}

async function authenticate() {
  for (const ep of [
    "/api/admins/auth-with-password",
    "/api/collections/_superusers/auth-with-password",
  ]) {
    try {
      const d = await pbFetch(ep, {
        method: "POST",
        body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      });
      authToken = d.token;
      return;
    } catch {}
  }
  throw new Error("Admin-Auth fehlgeschlagen");
}

async function listMosques() {
  if (mosqueArg) return [{ id: mosqueArg }];
  const r = await pbFetch("/api/collections/mosques/records?perPage=500&fields=id");
  return r?.items || [];
}

async function pageAll(collection, filter, fields) {
  const items = [];
  let page = 1;
  const perPage = 200;
  while (true) {
    const enc = encodeURIComponent(filter);
    const url = `/api/collections/${collection}/records?filter=${enc}&perPage=${perPage}&page=${page}&fields=${fields}`;
    const r = await pbFetch(url);
    const batch = r?.items || [];
    items.push(...batch);
    if (batch.length < perPage || !r || page >= (r.totalPages || 1)) break;
    page++;
  }
  return items;
}

function yearOf(iso) {
  if (!iso) return "";
  return String(iso).slice(0, 4);
}

function donationAmountCents(d) {
  return d.amount_cents || Math.round(Number(d.amount || 0) * 100) || 0;
}

/**
 * 6-Bucket-Recon für eine Moschee.
 * Gibt Map<year, { [bucket]: { src, srcCount, evt, evtCount } }> zurück.
 */
async function reconMosque(mosqueId) {
  const yf = yearArg;

  // ─── Quell-Daten laden ───────────────────────────────────────────────────

  // 1. Donations received: alle die jemals Geld erhielten (paid + später
  //    refunded/disputed). Eine erstattete Spende hat ihr income_received-Event
  //    behalten — der Refund läuft separat über den refund-Bucket (Double-Entry).
  let donFilter = `mosque_id="${mosqueId}" && (status="paid" || status="refunded" || status="disputed")`;
  if (yf) donFilter += ` && paid_at>="${yf}-01-01" && paid_at<"${Number(yf)+1}-01-01"`;
  const paidDonations = await pageAll("donations", donFilter, "id,amount_cents,amount,paid_at,created,refund_amount_cents");

  // 2. Donations refund_amount_cents (alle Status die refund_amount_cents > 0 haben)
  let donRefFilter = `mosque_id="${mosqueId}" && refund_amount_cents > 0`;
  if (yf) donRefFilter += ` && refunded_at>="${yf}-01-01" && refunded_at<"${Number(yf)+1}-01-01"`;
  const refundedDonations = await pageAll("donations", donRefFilter, "id,refund_amount_cents,refunded_at,created");

  // 3. Fees paid
  let feeFilter = `mosque_id="${mosqueId}" && status="paid"`;
  if (yf) feeFilter += ` && paid_at>="${yf}-01-01" && paid_at<"${Number(yf)+1}-01-01"`;
  const paidFees = await pageAll("student_fees", feeFilter, "id,amount_cents,paid_at,created");

  // 4. Sponsors paid
  let sponsFilter = `mosque_id="${mosqueId}" && payment_status="paid"`;
  if (yf) sponsFilter += ` && paid_at>="${yf}-01-01" && paid_at<"${Number(yf)+1}-01-01"`;
  const paidSponsors = await pageAll("sponsors", sponsFilter, "id,amount_cents,months_paid,paid_at,created");

  // ─── Event-Daten laden ───────────────────────────────────────────────────

  const evtBaseFilter = (coll, type) => {
    let f = `mosque_id="${mosqueId}" && source_collection="${coll}" && event_type="${type}"`;
    if (yf) f += ` && occurred_at>="${yf}-01-01" && occurred_at<"${Number(yf)+1}-01-01"`;
    return f;
  };

  const evtRefundFilter = (coll) => {
    let f = `mosque_id="${mosqueId}" && source_collection="${coll}" && (event_type="income_refunded" || event_type="chargeback")`;
    if (yf) f += ` && occurred_at>="${yf}-01-01" && occurred_at<"${Number(yf)+1}-01-01"`;
    return f;
  };

  const [
    donEvtReceived,
    donEvtRefund,
    feeEvtReceived,
    feeEvtRefund,
    spEvtReceived,
    spEvtRefund,
  ] = await Promise.all([
    pageAll("finance_source_events", evtBaseFilter("donations", "income_received"), "id,betrag_cents,occurred_at"),
    pageAll("finance_source_events", evtRefundFilter("donations"), "id,betrag_cents,occurred_at"),
    pageAll("finance_source_events", evtBaseFilter("student_fees", "income_received"), "id,betrag_cents,occurred_at"),
    pageAll("finance_source_events", evtRefundFilter("student_fees"), "id,betrag_cents,occurred_at"),
    pageAll("finance_source_events", evtBaseFilter("sponsors", "income_received"), "id,betrag_cents,occurred_at"),
    pageAll("finance_source_events", evtRefundFilter("sponsors"), "id,betrag_cents,occurred_at"),
  ]);

  // ─── Per-Jahr Aggregation ────────────────────────────────────────────────

  // Buckets: Map<year, Record<bucket, {src, srcCount, evt, evtCount}>>
  const years = new Set();
  const mkBucket = () => ({ src: 0, srcCount: 0, evt: 0, evtCount: 0 });
  const byYear = {};

  function getYear(y) {
    if (!byYear[y]) {
      byYear[y] = {
        "don-recv": mkBucket(),
        "don-ref":  mkBucket(),
        "fee-recv": mkBucket(),
        "fee-ref":  mkBucket(),
        "sp-recv":  mkBucket(),
        "sp-ref":   mkBucket(),
      };
      years.add(y);
    }
    return byYear[y];
  }

  // Source aggregation
  paidDonations.forEach((d) => {
    const y = yearOf(d.paid_at) || yearOf(d.created) || "unknown";
    const b = getYear(y)["don-recv"];
    b.src += donationAmountCents(d); b.srcCount++;
  });
  refundedDonations.forEach((d) => {
    const y = yearOf(d.refunded_at) || yearOf(d.created) || "unknown";
    const b = getYear(y)["don-ref"];
    b.src += d.refund_amount_cents || 0; b.srcCount++;
  });
  paidFees.forEach((f) => {
    const y = yearOf(f.paid_at) || yearOf(f.created) || "unknown";
    const b = getYear(y)["fee-recv"];
    b.src += f.amount_cents || 0; b.srcCount++;
  });
  paidSponsors.forEach((s) => {
    const y = yearOf(s.paid_at) || yearOf(s.created) || "unknown";
    const b = getYear(y)["sp-recv"];
    b.src += (s.amount_cents || 0) * (s.months_paid || 1); b.srcCount++;
  });

  // Event aggregation
  [donEvtReceived, donEvtRefund, feeEvtReceived, feeEvtRefund, spEvtReceived, spEvtRefund]
    .forEach((evts, idx) => {
      const keys = ["don-recv","don-ref","fee-recv","fee-ref","sp-recv","sp-ref"];
      const key = keys[idx];
      evts.forEach((e) => {
        const y = yearOf(e.occurred_at) || "unknown";
        const b = getYear(y)[key];
        b.evt += e.betrag_cents || 0; b.evtCount++;
      });
    });

  return { byYear, years: [...years].sort() };
}

async function main() {
  await authenticate();
  console.log("=== Finance Recon: Source ↔ Event — 6 Buckets (Sprint 5) ===");
  console.log(`PB:    ${PB_URL}`);
  console.log(`Scope: ${mosqueArg || "alle Moscheen"}${yearArg ? " Jahr=" + yearArg : ""}\n`);

  const mosques = await listMosques();
  let anyDrift = false;

  for (const m of mosques) {
    const { byYear, years } = await reconMosque(m.id);
    console.log(`→ ${m.id}`);

    if (years.length === 0) {
      console.log("   (keine Daten)");
      continue;
    }

    for (const y of years) {
      const buckets = byYear[y];
      const rows = [
        ["donations", "received", buckets["don-recv"]],
        ["donations", "refund",   buckets["don-ref"]],
        ["fees     ", "received", buckets["fee-recv"]],
        ["fees     ", "refund",   buckets["fee-ref"]],
        ["sponsors ", "received", buckets["sp-recv"]],
        ["sponsors ", "refund",   buckets["sp-ref"]],
      ];
      console.log(`   ${y}`);
      for (const [src, dir, b] of rows) {
        const deltaSum = b.src - b.evt;
        const ok = deltaSum === 0;
        if (!ok) anyDrift = true;
        // fees/sponsors-refund: src=0 immer → nur evt zeigen
        const srcDisplay = (src.trim() === "fees" || src.trim() === "sponsors") && dir === "refund"
          ? "—"
          : `${b.srcCount}/${(b.src/100).toFixed(2)}€`;
        console.log(
          `     ${src} ${dir.padEnd(9)} src=${srcDisplay.padEnd(16)} events=${b.evtCount}/${(b.evt/100).toFixed(2)}€  Δ=${(deltaSum/100).toFixed(2)}€ ${ok ? "✅" : "⚠️ DRIFT"}`
        );
      }
    }
    console.log("");
  }

  if (!anyDrift) {
    console.log("✅ Kein Drift — alle 6 Buckets Δ=0.");
    process.exit(0);
  } else {
    console.log("⚠️  Drift erkannt. Sweeper laufen lassen: node scripts/backfill-finance-events.mjs");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("❌ Recon-Fehler:", e?.message || e);
  process.exit(2);
});
