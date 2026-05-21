/**
 * Integration-Test Belegnummer-Sequencer + Hard-Lock (Sprint 3) gegen DEMO.
 *
 * Deckt (Plan §4.2/4.3):
 *  - formatBelegNummer Format + Padding (pure)
 *  - Jahr-Wechsel: getrennter Counter pro Jahr
 *  - Monotonie innerhalb eines Jahres
 *  - Hard-Lock: settings.finance_hard_lock_until in Zukunft → create mit
 *    buchungsdatum ≤ Lock → throw finance_period_locked
 *  - finally: Lock zurücksetzen + erzeugte tx löschen
 *
 * M6 Demo-Guard. Lauf:  npx tsx scripts/test-sequence.mts <DEMO_MOSQUE_ID>
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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
const PB_URL = env.POCKETBASE_URL || env.NEXT_PUBLIC_POCKETBASE_URL;
const ADMIN_EMAIL = env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = env.PB_ADMIN_PASSWORD;
const DEMO = env.NEXT_PUBLIC_DEMO_MOSQUE_ID;
const target = process.argv[2];

if (!DEMO || target !== DEMO) {
  console.error(`Refuse: Tests run only against DEMO_MOSQUE_ID. Got: ${target}, expected: ${DEMO}`);
  process.exit(2);
}
process.env.POCKETBASE_URL = process.env.POCKETBASE_URL || PB_URL;
process.env.NEXT_PUBLIC_POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || PB_URL;
process.env.PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || ADMIN_EMAIL;
process.env.PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || ADMIN_PASSWORD;

const { createManualTransaction } = await import("@/lib/actions/finance-domain");
const { formatBelegNummer } = await import("@/lib/finance-sequence");

let token = "";
async function pb(path: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(`${PB_URL}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}), ...(opts.headers || {}) },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`PB ${res.status} ${path}: ${text}`);
  return json;
}
async function auth() {
  for (const ep of ["/api/admins/auth-with-password", "/api/collections/_superusers/auth-with-password"]) {
    try {
      const d = await pb(ep, { method: "POST", body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }) });
      token = d.token;
      return;
    } catch {}
  }
  throw new Error("Auth fehlgeschlagen");
}

let failures = 0;
function ok(cond: boolean, label: string) {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  if (!cond) failures++;
}
async function throwsAsync(fn: () => Promise<unknown>, label: string, msgIncludes?: string) {
  try {
    await fn();
    console.log(`  ❌ ${label} (kein Throw)`);
    failures++;
  } catch (e) {
    const msg = (e as Error).message || "";
    if (msgIncludes && !msg.includes(msgIncludes)) {
      console.log(`  ❌ ${label} (falsche Meldung: ${msg})`);
      failures++;
    } else {
      console.log(`  ✅ ${label}`);
    }
  }
}

const createdTxIds: string[] = [];
function belegNum(b: string): number {
  return Number(b.split("-")[1]);
}
function belegYear(b: string): number {
  return Number(b.split("-")[0]);
}

let settingsId = "";
async function getOrCreateSettings(): Promise<string> {
  const r = await pb(
    `/api/collections/settings/records?filter=${encodeURIComponent(`mosque_id="${DEMO}"`)}&perPage=1`
  );
  if (r.items?.length) return r.items[0].id;
  const created = await pb(`/api/collections/settings/records`, {
    method: "POST",
    body: JSON.stringify({ mosque_id: DEMO }),
  });
  return created.id;
}
async function setHardLock(value: string) {
  await pb(`/api/collections/settings/records/${settingsId}`, {
    method: "PATCH",
    body: JSON.stringify({ finance_hard_lock_until: value }),
  });
}

async function cleanup() {
  try {
    if (settingsId) await setHardLock("");
  } catch (e) {
    console.warn(`  ⚠️  Lock-Reset: ${(e as Error).message}`);
  }
  for (const id of createdTxIds) {
    try {
      await pb(`/api/collections/transactions/records/${id}`, { method: "DELETE" });
    } catch (e) {
      console.warn(`  ⚠️  cleanup ${id}: ${(e as Error).message}`);
    }
  }
}

async function main() {
  await auth();
  settingsId = await getOrCreateSettings();
  console.log("=== Integration: Belegnummer-Sequencer + Hard-Lock gegen DEMO ===\n");

  // 1. formatBelegNummer (pure)
  console.log("1. formatBelegNummer (pure):");
  ok(formatBelegNummer(2026, 1) === "2026-0001", "1 → 2026-0001");
  ok(formatBelegNummer(2026, 42) === "2026-0042", "42 → 2026-0042");
  ok(formatBelegNummer(2025, 9999) === "2025-9999", "9999 → 2025-9999");
  ok(formatBelegNummer(2026, 12345) === "2026-12345", ">9999 wächst (2026-12345)");

  // 2. Monotonie innerhalb 2026
  console.log("\n2. Monotonie (2026):");
  const a = await createManualTransaction({
    mosqueId: DEMO, buchungsdatum: "2026-06-01", betragCents: 100, typ: "einnahme",
    kategorie: "spenden", beschreibung: "TEST seq A", kontoTyp: "cash",
  });
  createdTxIds.push(a.id);
  const b = await createManualTransaction({
    mosqueId: DEMO, buchungsdatum: "2026-06-02", betragCents: 100, typ: "einnahme",
    kategorie: "spenden", beschreibung: "TEST seq B", kontoTyp: "cash",
  });
  createdTxIds.push(b.id);
  ok(belegYear(a.beleg_nummer) === 2026, "Jahr-Präfix 2026");
  ok(belegNum(b.beleg_nummer) > belegNum(a.beleg_nummer), `${b.beleg_nummer} > ${a.beleg_nummer}`);

  // 3. Jahr-Wechsel: eigener Counter
  console.log("\n3. Jahr-Wechsel (getrennter Counter):");
  const c2025 = await createManualTransaction({
    mosqueId: DEMO, buchungsdatum: "2025-12-15", betragCents: 100, typ: "einnahme",
    kategorie: "spenden", beschreibung: "TEST seq 2025", kontoTyp: "cash",
  });
  createdTxIds.push(c2025.id);
  ok(belegYear(c2025.beleg_nummer) === 2025, `2025-Buchung → 2025-Präfix (${c2025.beleg_nummer})`);

  // 4. Hard-Lock
  console.log("\n4. Hard-Lock (MANUAL_WRITE):");
  await setHardLock("2099-12-31");
  await throwsAsync(
    () =>
      createManualTransaction({
        mosqueId: DEMO, buchungsdatum: "2099-06-01", betragCents: 100, typ: "einnahme",
        kategorie: "spenden", beschreibung: "TEST gesperrt", kontoTyp: "cash",
      }),
    "buchungsdatum ≤ Lock → finance_period_locked",
    "finance_period_locked"
  );
  // Nach Reset wieder erlaubt
  await setHardLock("");
  const after = await createManualTransaction({
    mosqueId: DEMO, buchungsdatum: "2099-06-01", betragCents: 100, typ: "einnahme",
    kategorie: "spenden", beschreibung: "TEST nach Reset", kontoTyp: "cash",
  });
  createdTxIds.push(after.id);
  ok(!!after.id, "nach Lock-Reset wieder buchbar");
}

main()
  .then(async () => {
    await cleanup();
    console.log("");
    if (failures > 0) {
      console.error(`❌ ${failures} Test(s) fehlgeschlagen.`);
      process.exit(1);
    }
    console.log("✅ Alle Sequencer/Hard-Lock-Tests grün.");
    process.exit(0);
  })
  .catch(async (e) => {
    await cleanup();
    console.error("❌ Test-Fehler:", e?.message || e);
    process.exit(2);
  });
