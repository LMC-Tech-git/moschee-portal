#!/usr/bin/env node
/**
 * Drift-Sweeper für finance_source_events — Sprint-1-Grundgerüst.
 *
 * Idempotent. Lock-frei (Plan §2/§5: Event-Pfad immer schreibbar). Cron-ready.
 *
 * Zwei Richtungen (Plan-Prinzip 10 — Recovery-Symmetrie):
 *  - **received**: paid-Quellen ohne `income_received`-Event → emit nach.
 *  - **refund/chargeback**: Quellen mit `status∈{refunded,chargeback}` bzw.
 *    `refund_amount_cents>0` ohne zugehöriges Gegen-Event → emit nach;
 *    Schlüssel via `refund_provider_ref` (Fallback ohne ref).
 *
 * Sprint 1 (jetzt):
 *  - received-Zweig: scharf, scannt donations.status="paid" ohne Event.
 *    student_fees/sponsors-Pfade als TODO markiert (Sprint 2 wird Donation-Hook
 *    scharf, andere Quellen Sprint 5).
 *  - refund-Zweig: NUR Grundgerüst (Loop + Log "TODO Sprint 5"). Scharf
 *    geschaltet wird er, sobald `refundIncome()` + Webhook in Sprint 5 stehen.
 *
 * Idempotenz vollständig auf UNIQUE-Index `source_event_key` (Plan §1). Doppel-
 * Läufe sind unschädlich.
 *
 * Nutzung:
 *   node scripts/backfill-finance-events.mjs              # alle Moscheen
 *   node scripts/backfill-finance-events.mjs <mosque_id>  # eine Moschee
 *
 * Exit:
 *   0 = sauber
 *   1 = Drift erkannt + behoben (Cron-Alarm-Signal)
 *   2 = Fehler
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash, randomUUID } from "node:crypto";

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

// CLI: erstes positionales Arg = mosque_id (rückwärtskompatibel Sprint 1)
// Optional `--dry-run` (Sprint 2, F6/R2).
const cliArgs = process.argv.slice(2);
const DRY_RUN = cliArgs.includes("--dry-run");
const SCOPE_MOSQUE = cliArgs.find((a) => !a.startsWith("--")) || "";

if (!PB_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Fehler: POCKETBASE_URL/PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD fehlt in .env.local");
  process.exit(2);
}

// --- REST-Helper ---

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

// --- Schlüssel (Spiegel zu lib/actions/finance-events.ts) ---

function sha256(s) {
  return createHash("sha256").update(s).digest("hex");
}

function receivedKey(mosqueId, sourceCollection, sourceId) {
  return sha256(`${mosqueId}|${sourceCollection}|${sourceId}|income_received`);
}

function refundKey(mosqueId, sourceCollection, sourceId, eventType, externalEventId, betragCents, occurredAt) {
  if (externalEventId) {
    return sha256(`${mosqueId}|${sourceCollection}|${sourceId}|${eventType}|${externalEventId}`);
  }
  const day = String(occurredAt).slice(0, 10);
  return sha256(`${mosqueId}|${sourceCollection}|${sourceId}|${eventType}|${betragCents}|${day}`);
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

// --- Donation → income_received-Backfill ---

// Donation-Quellkategorie → EÜR-Kategorie-ID (Spiegel zu lib/constants.ts
// `mapDonationToEUR`, R4 gepinnt). Alle 5 Spenden-Subtypen → SPENDEN; null →
// SONSTIGE_EINNAHMEN.
function mapDonationCategoryToEUR(cat) {
  if (!cat) return "sonstige_einnahmen";
  const m = {
    zakat: "spenden",
    sadaqa: "spenden",
    schuldenabbau: "spenden",
    moschee_bau: "spenden",
    projekte: "spenden",
  };
  return m[cat] || "sonstige_einnahmen";
}

function buildReceivedRecord(donation, mosqueId) {
  const betrag =
    donation.amount_cents ||
    Math.round(Number(donation.amount || 0) * 100) ||
    0;
  if (betrag < 1) return null;
  return {
    mosque_id: mosqueId,
    event_uuid: randomUUID(),
    external_event_id: donation.provider_ref || "",
    source_event_key: receivedKey(mosqueId, "donations", donation.id),
    related_event_id: "",
    relation_type: "",
    original_amount_cents: null,
    ledger_acceptance_context: "post_lock_system",
    event_type: "income_received",
    classification: "income",
    source_collection: "donations",
    source_type: "donation",
    source_id: donation.id,
    betrag_cents: betrag,
    kategorie: mapDonationCategoryToEUR(donation.category),
    konto_typ:
      donation.provider === "manual" && /bar/i.test(donation.payment_method_detail || "")
        ? "cash"
        : "bank",
    zahlungskanal:
      donation.provider === "stripe"
        ? "stripe"
        : donation.provider === "paypal_link"
        ? "paypal"
        : donation.provider === "sepa"
        ? "ueberweisung"
        : donation.provider === "manual"
        ? "bar"
        : "sonstige",
    currency: donation.currency || "EUR",
    occurred_at:
      donation.paid_at ||
      donation.updated ||
      donation.created ||
      new Date().toISOString(),
    payload_schema_version: 1,
    // R3-konform: KEIN amount_cents/currency/paid_at-Echo. Top-level Felder
    // sind die kanonische Wahrheit.
    payload_json: JSON.stringify({
      source_status: donation.status,
      category: donation.category || null,
      provider: donation.provider || "manual",
      payment_method: donation.payment_method_detail || null,
    }),
    metadata_json: "",
  };
}

async function tryEmit(record) {
  if (DRY_RUN) return "dryrun";
  try {
    await pbFetch("/api/collections/finance_source_events/records", {
      method: "POST",
      body: JSON.stringify(record),
    });
    return "emitted";
  } catch (err) {
    if (isUniqueViolation(err)) return "duplicated";
    throw err;
  }
}

// R2 (Plan §13.1-8): Backfill sperrt historische paid-Records. F6: Fallback
// auf now() bei paid_at=null. Idempotent (mehrfaches Setzen unschädlich).
async function lockSourceIfNeeded(collection, record) {
  if (record.is_financially_locked) return { changed: false, fallback: false };
  const lockAt = record.paid_at || new Date().toISOString();
  const fallback = !record.paid_at;
  if (DRY_RUN) return { changed: true, fallback };
  await pbFetch(`/api/collections/${collection}/records/${record.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      is_financially_locked: true,
      financial_locked_at: lockAt,
    }),
  });
  return { changed: true, fallback };
}

async function listMosques() {
  if (SCOPE_MOSQUE) return [{ id: SCOPE_MOSQUE }];
  const r = await pbFetch("/api/collections/mosques/records?perPage=500&fields=id");
  return r?.items || [];
}

async function sweepReceivedForMosque(mosqueId) {
  // donations.status="paid" ohne zugehöriges income_received
  // Phase-1-Strategie: pro Donation prüfen "existiert Event mit source_event_key?".
  // Bei großen Mengen Phase-2-Optimierung (LEFT-JOIN-ähnlich via PB-Filter).
  // R2 (Sprint 2): Backfill sperrt zusätzlich historische paid-Records.
  // Lock-Drift-Branch: paid + Event existiert + !locked → Lock setzen.
  let page = 1;
  let scanned = 0;
  let emitted = 0;
  let already = 0;
  let locked = 0;
  let lockedFallback = 0;
  const perPage = 200;
  while (true) {
    const enc = encodeURIComponent(`mosque_id = "${mosqueId}" && status = "paid"`);
    const list = await pbFetch(
      `/api/collections/donations/records?filter=${enc}&page=${page}&perPage=${perPage}&sort=paid_at`
    );
    for (const d of list?.items || []) {
      scanned++;
      const record = buildReceivedRecord(d, mosqueId);
      if (!record) continue;
      const result = await tryEmit(record);
      if (result === "emitted") emitted++;
      else if (result === "duplicated") already++;
      // Lock setzen — sowohl bei neu-emittiert (R2) als auch bei bereits
      // existierendem Event mit !locked (Lock-Drift-Branch).
      try {
        const lockRes = await lockSourceIfNeeded("donations", d);
        if (lockRes.changed) {
          locked++;
          if (lockRes.fallback) lockedFallback++;
        }
      } catch (e) {
        console.warn(`   ⚠️  lock-set fehlgeschlagen für donation ${d.id}: ${e?.message || e}`);
      }
    }
    if (!list || page >= (list.totalPages || 1)) break;
    page++;
  }
  return { scanned, emitted, already, locked, lockedFallback };
}

/**
 * Lädt Summe aller existierenden refund/chargeback-Events für eine Donation.
 */
async function sumExistingRefundEvents(mosqueId, sourceId) {
  let total = 0;
  const enc = encodeURIComponent(
    `mosque_id = "${mosqueId}" && source_collection = "donations" && source_id = "${sourceId}" && (event_type = "income_refunded" || event_type = "chargeback")`
  );
  const list = await pbFetch(
    `/api/collections/finance_source_events/records?filter=${enc}&perPage=500&fields=betrag_cents,external_event_id,event_uuid`
  );
  const events = list?.items || [];
  events.forEach((e) => { total += e.betrag_cents || 0; });
  return { total, events };
}

/**
 * Sucht das income_received-Event für eine Donation (related_event_id).
 */
async function findReceivedEventUuid(mosqueId, sourceId) {
  try {
    const enc = encodeURIComponent(
      `mosque_id = "${mosqueId}" && source_collection = "donations" && source_id = "${sourceId}" && event_type = "income_received"`
    );
    const list = await pbFetch(
      `/api/collections/finance_source_events/records?filter=${enc}&perPage=1&fields=event_uuid`
    );
    return list?.items?.[0]?.event_uuid || "";
  } catch { return ""; }
}

/**
 * Sprint 5 SCHARF: scannt donations mit refund_amount_cents > 0 und emittiert
 * fehlende Refund/Chargeback-Events (Σ-Differenz). Granularity-Marker bei
 * Fallback-Key (kein externalEventId).
 */
async function sweepRefundForMosque(mosqueId) {
  let scanned = 0;
  let emitted = 0;
  let already = 0;
  let page = 1;

  while (true) {
    const enc = encodeURIComponent(
      `mosque_id = "${mosqueId}" && (status = "refunded" || status = "disputed" || refund_amount_cents > 0)`
    );
    const list = await pbFetch(
      `/api/collections/donations/records?filter=${enc}&page=${page}&perPage=200` +
      `&fields=id,status,refund_amount_cents,refund_provider_ref,refunded_at,amount_cents,created,category,provider,payment_method_detail`
    );

    for (const d of list?.items || []) {
      scanned++;
      const donationRefundCents = d.refund_amount_cents || 0;
      if (donationRefundCents < 1) continue;

      const { total: existingSum, events: existingEvents } = await sumExistingRefundEvents(mosqueId, d.id);
      const delta = donationRefundCents - existingSum;
      if (delta <= 0) { already++; continue; }

      // Bestimme event_type
      const eventType = d.status === "disputed" ? "chargeback" : "income_refunded";

      // Key-Auswahl: refund_provider_ref falls nicht schon im Event
      let externalEventId = d.refund_provider_ref || "";
      if (externalEventId) {
        const alreadyUsed = existingEvents.some((e) => {
          // external_event_id feld nicht in response — nutze refundKey-Präfix-Check
          return false; // Fallback: immer nutzen, UNIQUE schützt
        });
        void alreadyUsed;
      }

      // Fallback-Key wenn kein externalEventId
      const useAggregateMarker = !externalEventId;
      const occurredAt = d.refunded_at || d.created || new Date().toISOString();
      const sourceEventKey = refundKey(mosqueId, "donations", d.id, eventType, externalEventId, delta, occurredAt);

      // related_event_id
      const relatedEventId = await findReceivedEventUuid(mosqueId, d.id);

      // Konto/Kanal
      let kontoTyp = "bank";
      let zahlungskanal = "sonstige";
      if (d.provider === "stripe") { zahlungskanal = "stripe"; }
      else if (d.provider === "sepa") { zahlungskanal = "ueberweisung"; }
      else if (d.provider === "paypal_link") { zahlungskanal = "paypal"; }
      else if (d.provider === "manual" && /bar/i.test(d.payment_method_detail || "")) {
        kontoTyp = "cash"; zahlungskanal = "bar";
      }

      const record = {
        mosque_id: mosqueId,
        event_uuid: randomUUID(),
        external_event_id: externalEventId,
        source_event_key: sourceEventKey,
        related_event_id: relatedEventId,
        relation_type: eventType === "chargeback" ? "chargeback_of" : "refund_of",
        original_amount_cents: d.amount_cents || null,
        ledger_acceptance_context: "post_lock_system",
        event_type: eventType,
        classification: "expense",
        source_collection: "donations",
        source_type: "donation",
        source_id: d.id,
        betrag_cents: delta,
        kategorie: mapDonationCategoryToEUR(d.category),
        konto_typ: kontoTyp,
        zahlungskanal: zahlungskanal,
        currency: "EUR",
        occurred_at: occurredAt,
        payload_schema_version: 1,
        payload_json: JSON.stringify({
          source_status: d.status,
          category: d.category || null,
          provider: d.provider || "manual",
          payment_method: d.payment_method_detail || null,
          granularity: useAggregateMarker ? "aggregate" : "exact",
        }),
        metadata_json: useAggregateMarker ? JSON.stringify({ granularity: "aggregate" }) : "",
      };

      const result = await tryEmit(record);
      if (result === "emitted") { emitted++; }
      else if (result === "duplicated") { already++; }
    }

    if (!list || page >= (list.totalPages || 1)) break;
    page++;
  }

  return { scanned, emitted, already };
}

async function main() {
  console.log("=== Finance Drift-Sweeper (Sprint 2) ===");
  console.log(`PB:    ${PB_URL}`);
  console.log(`Scope: ${SCOPE_MOSQUE || "alle Moscheen"}`);
  if (DRY_RUN) console.log("Mode:  --dry-run (kein Schreiben)");
  console.log("");
  await authenticate();
  const mosques = await listMosques();
  let totalEmitted = 0;
  let totalLocked = 0;
  let totalLockedFallback = 0;
  for (const m of mosques) {
    console.log(`→ ${m.id}`);
    const recv = await sweepReceivedForMosque(m.id);
    console.log(
      `   received:  scanned=${recv.scanned} emitted=${recv.emitted} duplicated=${recv.already} ` +
      `locked=${recv.locked}${recv.lockedFallback ? ` (paid_at=null Fallback: ${recv.lockedFallback})` : ""}`
    );
    const ref = await sweepRefundForMosque(m.id);
    console.log(`   refund:    scanned=${ref.scanned} emitted=${ref.emitted} duplicated=${ref.already}`);
    totalEmitted += recv.emitted + ref.emitted;
    totalLocked += recv.locked;
    totalLockedFallback += recv.lockedFallback;
  }
  if (totalLocked > 0) {
    console.log(
      `\nBACKFILL_LOCKS_HISTORICAL: locked ${totalLocked} records ` +
      `(${totalLockedFallback} with paid_at=null → using now()); ` +
      `corrections via compensating transaction (Sprint 3) or refund (Sprint 5). Plan §11.`
    );
  }
  if (totalEmitted > 0) {
    console.log(`\n⚠️  Drift behoben: ${totalEmitted} Event(s) nach-emittiert`);
    process.exit(1);
  }
  console.log("\n✅ kein Drift");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Backfill fehlgeschlagen:", err.message);
  console.error(err);
  process.exit(2);
});
