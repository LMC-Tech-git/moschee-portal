#!/usr/bin/env node
/**
 * Recon: Σ(paid donations) vs Σ(income_received events) je Moschee+Jahr.
 *
 * READ-ONLY. Sprint-2-Vorlauf + Nachlauf (Plan §13.1).
 *
 * Phase 1: nur Received-Richtung (Donations). Refund-Recon = Sprint 5.
 *
 * Nutzung:
 *   node scripts/recon-source-vs-events.mjs --mosque <id>      # eine Moschee
 *   node scripts/recon-source-vs-events.mjs --all              # alle
 *   node scripts/recon-source-vs-events.mjs --mosque <id> --year 2026
 *
 * Exit:
 *   0 = alle Δ=0 (keine Drift)
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
  console.error("Pflicht: --mosque <id> ODER --all (Safety-Guard, kein silent default-all)");
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

async function pageAll(path) {
  const items = [];
  let page = 1;
  const perPage = 200;
  while (true) {
    const url = path + (path.includes("?") ? "&" : "?") + `perPage=${perPage}&page=${page}`;
    const r = await pbFetch(url);
    const batch = r?.items || [];
    items.push(...batch);
    if (batch.length < perPage) break;
    page++;
  }
  return items;
}

function donationAmountCents(d) {
  return d.amount_cents || Math.round(Number(d.amount || 0) * 100) || 0;
}

function year(iso) {
  if (!iso) return "";
  return String(iso).slice(0, 4);
}

async function reconMosque(mosqueId) {
  // Paid donations
  let filter = `mosque_id="${mosqueId}" && status="paid"`;
  if (yearArg) filter += ` && paid_at>="${yearArg}-01-01" && paid_at<"${Number(yearArg)+1}-01-01"`;
  const donations = await pageAll(`/api/collections/donations/records?filter=${encodeURIComponent(filter)}`);

  // income_received events
  let eFilter = `mosque_id="${mosqueId}" && event_type="income_received" && source_collection="donations"`;
  if (yearArg) eFilter += ` && occurred_at>="${yearArg}-01-01" && occurred_at<"${Number(yearArg)+1}-01-01"`;
  const events = await pageAll(`/api/collections/finance_source_events/records?filter=${encodeURIComponent(eFilter)}`);

  // Per-year roll-up
  const buckets = new Map();
  function getBucket(y) {
    if (!buckets.has(y)) buckets.set(y, { donations_count: 0, donations_sum: 0, events_count: 0, events_sum: 0 });
    return buckets.get(y);
  }

  for (const d of donations) {
    const y = year(d.paid_at) || year(d.created);
    const b = getBucket(y);
    b.donations_count++;
    b.donations_sum += donationAmountCents(d);
  }
  for (const e of events) {
    const y = year(e.occurred_at);
    const b = getBucket(y);
    b.events_count++;
    b.events_sum += Number(e.betrag_cents || 0);
  }

  // Set of source_ids check (uncovered = paid without event)
  const eventSourceIds = new Set(events.map(e => e.source_id));
  const missing = donations.filter(d => !eventSourceIds.has(d.id));

  return { buckets, missing };
}

async function main() {
  await authenticate();
  console.log("=== Finance Recon: Source ↔ Event (Phase 1 = received only) ===");
  console.log(`PB:    ${PB_URL}`);
  console.log(`Scope: ${mosqueArg || "alle Moscheen"}${yearArg ? " Jahr=" + yearArg : ""}\n`);

  const mosques = await listMosques();
  let totalMissing = 0;
  let totalDeltaCents = 0;

  for (const m of mosques) {
    const r = await reconMosque(m.id);
    console.log(`→ ${m.id}`);
    if (r.buckets.size === 0) {
      console.log("   (keine Daten)");
      continue;
    }
    for (const [y, b] of [...r.buckets.entries()].sort()) {
      const deltaCount = b.donations_count - b.events_count;
      const deltaSum = b.donations_sum - b.events_sum;
      const flag = (deltaCount === 0 && deltaSum === 0) ? "✅" : "⚠️ ";
      console.log(
        `   ${y || "(no-year)"}: donations=${b.donations_count}/${(b.donations_sum/100).toFixed(2)}€  ` +
        `events=${b.events_count}/${(b.events_sum/100).toFixed(2)}€  ` +
        `Δcount=${deltaCount} Δsum=${(deltaSum/100).toFixed(2)}€ ${flag}`
      );
      totalDeltaCents += Math.abs(deltaSum);
    }
    if (r.missing.length > 0) {
      console.log(`   ⚠️  ${r.missing.length} paid-Donation(s) ohne income_received-Event:`);
      for (const d of r.missing.slice(0, 5)) {
        console.log(`      - ${d.id} (${(donationAmountCents(d)/100).toFixed(2)}€, paid_at=${d.paid_at || "null"})`);
      }
      if (r.missing.length > 5) console.log(`      ... +${r.missing.length - 5} weitere`);
      totalMissing += r.missing.length;
    }
  }

  console.log("");
  if (totalMissing === 0 && totalDeltaCents === 0) {
    console.log("✅ Keine Drift (Δcount=0, Δsum=0 alle Moscheen).");
    process.exit(0);
  } else {
    console.log(`⚠️  Drift: ${totalMissing} fehlende Events, Σ|Δ|=${(totalDeltaCents/100).toFixed(2)}€`);
    console.log("    Drift-Sweeper laufen lassen: node scripts/backfill-finance-events.mjs");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("❌ Recon-Fehler:", e?.message || e);
  process.exit(2);
});
