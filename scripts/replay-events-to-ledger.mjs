#!/usr/bin/env node
/**
 * Replay-Skript: finance_source_events → LedgerAtom (Dry-Run).
 *
 * Sprint-2-Voraussetzung (Plan §13.1): verifiziert dass das Ledger korrekt
 * aus Events entsteht.
 *  - Atom-Count == Event-Count
 *  - assertEventIntegrity durchgängig grün
 *  - keine Validierungs-Fehler
 *
 * Nutzt **gespiegelte** Logik aus lib/finance-to-ledger-atom.ts (kann TS-
 * Module nicht direkt aus .mjs laden). Spiegelung muss bei TS-Änderung
 * mitgepflegt werden (Plan §13.5 grep-Gate).
 *
 * READ-ONLY. Exit:
 *   0 = alle Atoms valide
 *   1 = Integrity-Fehler / Atom-Count mismatch
 *   2 = Skript-Fehler
 *
 * Nutzung:
 *   node scripts/replay-events-to-ledger.mjs              # alle Moscheen
 *   node scripts/replay-events-to-ledger.mjs <mosque_id>  # eine Moschee
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
const SCOPE_MOSQUE = process.argv[2] || "";

if (!PB_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Fehler: POCKETBASE_URL/PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD fehlt in .env.local");
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

// --- Spiegelung lib/finance-to-ledger-atom.ts ---

function toSignedAmount(classification, betrag_cents) {
  return classification === "income" ? betrag_cents : -betrag_cents;
}

function assertEventIntegrity(event) {
  if (!Number.isFinite(event.betrag_cents) || event.betrag_cents <= 0) {
    throw new Error(`betrag_cents must be > 0 (got ${event.betrag_cents})`);
  }
  if (event.event_type === "income_received") {
    if (event.classification !== "income") {
      throw new Error(`event_type=income_received requires classification=income (got ${event.classification})`);
    }
  } else if (event.event_type === "income_refunded" || event.event_type === "chargeback") {
    if (event.classification !== "expense") {
      throw new Error(`event_type=${event.event_type} requires classification=expense (got ${event.classification})`);
    }
  }
  if (
    (event.event_type === "income_refunded" || event.event_type === "chargeback") &&
    event.original_amount_cents != null &&
    event.original_amount_cents > 0 &&
    event.betrag_cents > event.original_amount_cents
  ) {
    throw new Error(
      `refund betrag_cents=${event.betrag_cents} exceeds original_amount_cents=${event.original_amount_cents}`
    );
  }
}

function toLedgerAtom(event) {
  assertEventIntegrity(event);
  const zk = event.zahlungskanal && event.zahlungskanal.length > 0 ? event.zahlungskanal : "sonstige";
  return {
    id: event.event_uuid,
    mosque_id: event.mosque_id,
    datum: event.occurred_at,
    betrag_cents: event.betrag_cents,
    signed_amount_cents: toSignedAmount(event.classification, event.betrag_cents),
    kategorie: event.kategorie,
    konto_typ: event.konto_typ,
    zahlungskanal: zk,
    classification: event.classification,
    source_system: "external_event",
    source_origin: {
      source_collection: event.source_collection,
      source_id: event.source_id,
      event_uuid: event.event_uuid,
    },
    beleg_nummer: "",
    readonly: true,
  };
}

async function listMosques() {
  if (SCOPE_MOSQUE) return [{ id: SCOPE_MOSQUE }];
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

async function main() {
  await authenticate();
  console.log("=== Finance Replay: Events → LedgerAtom (Dry-Run) ===");
  console.log(`PB:    ${PB_URL}`);
  console.log(`Scope: ${SCOPE_MOSQUE || "alle Moscheen"}\n`);

  const mosques = await listMosques();
  let totalEvents = 0;
  let totalAtoms = 0;
  let totalErrors = 0;
  const errors = [];

  for (const m of mosques) {
    const events = await pageAll(
      `/api/collections/finance_source_events/records?filter=${encodeURIComponent(`mosque_id="${m.id}"`)}`
    );
    let atoms = 0;
    let errs = 0;
    let typeReceived = 0;
    let typeRefund = 0;
    let typeChargeback = 0;
    for (const e of events) {
      try {
        const atom = toLedgerAtom(e);
        atoms++;
        if (e.event_type === "income_received") typeReceived++;
        else if (e.event_type === "income_refunded") typeRefund++;
        else if (e.event_type === "chargeback") typeChargeback++;
        // Plausi: signed_amount korrekt
        const expectedSign = atom.classification === "income" ? 1 : -1;
        const expected = expectedSign * atom.betrag_cents;
        if (atom.signed_amount_cents !== expected) {
          errs++;
          errors.push(`${m.id}/${e.id}: signed mismatch ${atom.signed_amount_cents} != ${expected}`);
        }
      } catch (ex) {
        errs++;
        errors.push(`${m.id}/${e.id}: ${ex.message}`);
      }
    }
    console.log(
      `→ ${m.id}: events=${events.length} atoms=${atoms} ` +
      `(received=${typeReceived} refunded=${typeRefund} chargeback=${typeChargeback}) errors=${errs}`
    );
    totalEvents += events.length;
    totalAtoms += atoms;
    totalErrors += errs;
  }

  console.log("");
  if (totalErrors > 0) {
    console.log(`⚠️  ${totalErrors} Integrity-Fehler:`);
    for (const e of errors.slice(0, 10)) console.log(`   - ${e}`);
    if (errors.length > 10) console.log(`   ... +${errors.length - 10} weitere`);
    process.exit(1);
  }
  if (totalAtoms !== totalEvents) {
    console.log(`⚠️  Atom-Count (${totalAtoms}) != Event-Count (${totalEvents})`);
    process.exit(1);
  }
  console.log(`✅ ${totalAtoms} Atoms aus ${totalEvents} Events, alle integrity-grün.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Replay-Fehler:", e?.message || e);
  process.exit(2);
});
