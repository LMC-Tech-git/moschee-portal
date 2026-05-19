#!/usr/bin/env node
/**
 * Sprint-1-DoD-Beweis: UNIQUE-Idempotenz auf `finance_source_events.source_event_key`.
 *
 * Testet drei Behavior-Aussagen (Plan §11a):
 *  (1) 10× derselbe `income_received` (gleiche mosque/coll/id) → genau 1 Row.
 *  (2) 2 Partial-Refunds derselben Spende mit verschiedenen Stripe-Refund-ids
 *      → 2 Rows.
 *  (3) Webhook-Retry je Refund (gleiche external_event_id) → kein zusätzliches.
 *
 * Direkter PB-REST-Zugriff (analog migrate-v1.mjs). Hash-Formel hier dupliziert
 * — Diskrepanz zur Library-Implementation wäre Bug; der Test ist genau dafür da.
 *
 * Nutzung:
 *   node scripts/test-webhook-idempotency.mjs <mosque_id>
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash, randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dirname, "../.env.local");
  try {
    const raw = readFileSync(envPath, "utf-8");
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
const MOSQUE_ID = process.argv[2] || env.NEXT_PUBLIC_DEMO_MOSQUE_ID;

if (!PB_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Fehler: POCKETBASE_URL/PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD fehlt in .env.local");
  process.exit(1);
}
if (!MOSQUE_ID) {
  console.error("Fehler: mosque_id muss als Argument oder NEXT_PUBLIC_DEMO_MOSQUE_ID gesetzt sein");
  process.exit(1);
}

// --- Auth + REST-Helper (PB <0.23 zuerst, dann _superusers) ---

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
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
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

// --- Schlüssel-Berechnung (Spiegel zu lib/actions/finance-events.ts) ---

function sha256(s) {
  return createHash("sha256").update(s).digest("hex");
}

function sourceEventKey({ mosqueId, sourceCollection, sourceId, eventType, externalEventId, betragCents, occurredAt }) {
  if (eventType === "income_received") {
    return sha256(`${mosqueId}|${sourceCollection}|${sourceId}|income_received`);
  }
  if (externalEventId) {
    return sha256(`${mosqueId}|${sourceCollection}|${sourceId}|${eventType}|${externalEventId}`);
  }
  const day = String(occurredAt).slice(0, 10);
  return sha256(`${mosqueId}|${sourceCollection}|${sourceId}|${eventType}|${betragCents}|${day}`);
}

function toClassification(t) {
  return t === "income_received" ? "income" : "expense";
}

// --- Test-Source pro Run (idempotent re-run: Pre-Cleanup) ---

const RUN_TAG = `sprint1-test-${Date.now()}`;
const TEST_SOURCE_ID = `test-donation-${randomUUID()}`;

function buildRecord(eventType, externalEventId, betragCents, occurredAt) {
  return {
    mosque_id: MOSQUE_ID,
    event_uuid: randomUUID(),
    external_event_id: externalEventId || "",
    source_event_key: sourceEventKey({
      mosqueId: MOSQUE_ID,
      sourceCollection: "donations",
      sourceId: TEST_SOURCE_ID,
      eventType,
      externalEventId,
      betragCents,
      occurredAt,
    }),
    related_event_id: "",
    relation_type: "",
    original_amount_cents: eventType !== "income_received" ? 10000 : null,
    ledger_acceptance_context: "post_lock_system", // Test-Marker
    event_type: eventType,
    classification: toClassification(eventType),
    source_collection: "donations",
    source_type: "donation",
    source_id: TEST_SOURCE_ID,
    betrag_cents: betragCents,
    kategorie: "spenden",
    konto_typ: "bank",
    zahlungskanal: "stripe",
    currency: "EUR",
    occurred_at: occurredAt,
    payload_schema_version: 1,
    payload_json: JSON.stringify({
      source_status: eventType === "income_received" ? "paid" : "refunded",
      amount_cents: betragCents,
      category: "spenden",
      provider: "stripe",
      payment_method: "card",
      currency: "EUR",
    }),
    metadata_json: JSON.stringify({ run_tag: RUN_TAG }),
  };
}

function isUniqueViolation(err) {
  if (err?.status !== 400) return false;
  const msg = String(err.message || "").toLowerCase();
  if (msg.includes("unique") || msg.includes("duplicate")) return true;
  const fe = err.data?.data;
  if (fe) {
    for (const v of Object.values(fe)) {
      if (v?.code === "validation_not_unique") return true;
    }
  }
  return false;
}

async function tryInsert(record) {
  try {
    await pbFetch("/api/collections/finance_source_events/records", {
      method: "POST",
      body: JSON.stringify(record),
    });
    return "inserted";
  } catch (err) {
    if (isUniqueViolation(err)) return "duplicated";
    throw err;
  }
}

async function countByFilter(filter) {
  const enc = encodeURIComponent(filter);
  const r = await pbFetch(`/api/collections/finance_source_events/records?filter=${enc}&perPage=1`);
  return r?.totalItems ?? 0;
}

// --- Tests ---

const results = [];

async function test1_received_dedup() {
  const occ = "2026-05-19 12:00:00.000Z";
  let inserted = 0;
  let duped = 0;
  for (let i = 0; i < 10; i++) {
    const r = await tryInsert(buildRecord("income_received", undefined, 10000, occ));
    if (r === "inserted") inserted++;
    else duped++;
  }
  const total = await countByFilter(
    `mosque_id = "${MOSQUE_ID}" && source_id = "${TEST_SOURCE_ID}" && event_type = "income_received"`
  );
  results.push({
    test: "1. 10x income_received → 1 Row",
    inserted,
    duplicated: duped,
    db_count: total,
    ok: inserted === 1 && duped === 9 && total === 1,
  });
}

async function test2_partial_refund_distinct() {
  const occ = "2026-05-20 09:00:00.000Z";
  const refundA = `re_test_${randomUUID()}`;
  const refundB = `re_test_${randomUUID()}`;
  const a = await tryInsert(buildRecord("income_refunded", refundA, 3000, occ));
  const b = await tryInsert(buildRecord("income_refunded", refundB, 4000, occ));
  const total = await countByFilter(
    `mosque_id = "${MOSQUE_ID}" && source_id = "${TEST_SOURCE_ID}" && event_type = "income_refunded"`
  );
  results.push({
    test: "2. 2 Partial-Refunds (verschiedene Stripe-ids) → 2 Rows",
    a,
    b,
    db_count: total,
    ok: a === "inserted" && b === "inserted" && total === 2,
  });
  return { refundA, refundB, occ };
}

async function test3_refund_retry_dedup({ refundA, refundB, occ }) {
  // Webhook-Retry je Refund: gleiche external_event_id → kein zusätzliches
  const retryA = await tryInsert(buildRecord("income_refunded", refundA, 3000, occ));
  const retryB = await tryInsert(buildRecord("income_refunded", refundB, 4000, occ));
  const total = await countByFilter(
    `mosque_id = "${MOSQUE_ID}" && source_id = "${TEST_SOURCE_ID}" && event_type = "income_refunded"`
  );
  results.push({
    test: "3. Webhook-Retry je Refund → kein zusätzliches",
    retryA,
    retryB,
    db_count: total,
    ok: retryA === "duplicated" && retryB === "duplicated" && total === 2,
  });
}

async function cleanup() {
  // Test-Records entfernen (markiert via source_id / RUN_TAG)
  const enc = encodeURIComponent(
    `mosque_id = "${MOSQUE_ID}" && source_id = "${TEST_SOURCE_ID}"`
  );
  const list = await pbFetch(
    `/api/collections/finance_source_events/records?filter=${enc}&perPage=200`
  );
  for (const rec of list?.items || []) {
    try {
      await pbFetch(`/api/collections/finance_source_events/records/${rec.id}`, {
        method: "DELETE",
      });
    } catch {}
  }
}

async function main() {
  console.log("=== Sprint-1 Idempotenz-Test ===");
  console.log(`PB:        ${PB_URL}`);
  console.log(`Moschee:   ${MOSQUE_ID}`);
  console.log(`Test-ID:   ${TEST_SOURCE_ID}\n`);
  await authenticate();

  try {
    await test1_received_dedup();
    const ctx = await test2_partial_refund_distinct();
    await test3_refund_retry_dedup(ctx);
  } finally {
    await cleanup();
  }

  let allOk = true;
  for (const r of results) {
    const sym = r.ok ? "✅" : "❌";
    console.log(`${sym} ${r.test}`);
    for (const [k, v] of Object.entries(r)) {
      if (k === "test" || k === "ok") continue;
      console.log(`     ${k}: ${v}`);
    }
    if (!r.ok) allOk = false;
  }
  console.log(`\n=== ${allOk ? "✅ alle Tests grün" : "❌ FEHLGESCHLAGEN"} ===`);
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("\n❌ Test fehlgeschlagen:", err.message);
  console.error(err);
  process.exit(2);
});
