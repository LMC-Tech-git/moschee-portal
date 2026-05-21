/**
 * Integration-Test getKassenbericht (Sprint 4b) gegen DEMO — 3-Jahr-Fixture
 * inkl. Leerjahr. Deckt:
 *  - Carryover: Anfang N == Ende N−1 (bar+bank) über alle 3 Jahre
 *  - Startjahr nutzt Settings-Anfangsbestände
 *  - Bar/Bank getrennt; konto_typ "other" → bank
 *  - Leerjahr (2031): keine Bewegung, Bestand unverändert
 *  - Settings save/restore + finally-Cleanup
 *
 * Lauf:  npx tsx scripts/test-kassenbericht.mts <DEMO_MOSQUE_ID>
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
const { getKassenbericht } = await import("@/lib/actions/finance");

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

const createdTxIds: string[] = [];
let settingsId = "";
let origSettings: { kassenbuch_start_year?: number; kassenbuch_bar_start_cents?: number; kassenbuch_bank_start_cents?: number } = {};

async function loadSettings() {
  const list = await pb(`/api/collections/settings/records?filter=${encodeURIComponent(`mosque_id="${DEMO}"`)}&perPage=1`);
  if (list.items.length === 0) throw new Error("Kein settings-Record für Demo");
  const r = list.items[0];
  settingsId = r.id;
  origSettings = {
    kassenbuch_start_year: r.kassenbuch_start_year,
    kassenbuch_bar_start_cents: r.kassenbuch_bar_start_cents,
    kassenbuch_bank_start_cents: r.kassenbuch_bank_start_cents,
  };
}
async function patchSettings(data: Record<string, unknown>) {
  await pb(`/api/collections/settings/records/${settingsId}`, { method: "PATCH", body: JSON.stringify(data) });
}
async function cleanup() {
  for (const id of createdTxIds) {
    try { await pb(`/api/collections/transactions/records/${id}`, { method: "DELETE" }); }
    catch (e) { console.warn(`  ⚠️  cleanup ${id}: ${(e as Error).message}`); }
  }
  if (settingsId) {
    try { await patchSettings(origSettings); } catch (e) { console.warn(`  ⚠️  settings restore: ${(e as Error).message}`); }
  }
}

async function mkTx(datum: string, betrag: number, typ: "einnahme" | "ausgabe", konto: "bank" | "cash" | "other", kat: string) {
  const r = await createManualTransaction({
    mosqueId: DEMO, buchungsdatum: datum, betragCents: betrag, typ, kategorie: kat,
    beschreibung: `TEST Kassenbericht ${datum}`, kontoTyp: konto,
  });
  createdTxIds.push(r.id);
}

async function main() {
  await auth();
  await loadSettings();
  console.log("=== Integration: getKassenbericht 3-Jahr-Fixture gegen DEMO ===\n");

  // Settings: Startjahr 2030, Anfangsbestände Bar 100€ / Bank 200€
  await patchSettings({ kassenbuch_start_year: 2030, kassenbuch_bar_start_cents: 10000, kassenbuch_bank_start_cents: 20000 });

  // 2030: bar +5000 (cash), bank -3000 (bank), other +1000 (→bank)
  await mkTx("2030-03-01", 5000, "einnahme", "cash", "spenden");
  await mkTx("2030-05-01", 3000, "ausgabe", "bank", "miete");
  await mkTx("2030-07-01", 1000, "einnahme", "other", "zuschuesse");
  // 2031: leer
  // 2032: bank +7000
  await mkTx("2032-04-01", 7000, "einnahme", "bank", "spenden");

  const kb30 = await getKassenbericht(DEMO, 2030);
  const kb31 = await getKassenbericht(DEMO, 2031);
  const kb32 = await getKassenbericht(DEMO, 2032);

  console.log("1. Startjahr 2030 (Settings-Anfangsbestände):");
  ok(kb30.bar.anfang_cents === 10000, `bar Anfang = 10000 (got ${kb30.bar.anfang_cents})`);
  ok(kb30.bank.anfang_cents === 20000, `bank Anfang = 20000 (got ${kb30.bank.anfang_cents})`);
  ok(kb30.bar.einnahmen_cents === 5000 && kb30.bar.ausgaben_cents === 0, "bar 2030: +5000 / −0");
  ok(kb30.bank.einnahmen_cents === 1000 && kb30.bank.ausgaben_cents === 3000, "bank 2030: +1000 (other→bank) / −3000");
  ok(kb30.bar.ende_cents === 15000, `bar Ende 2030 = 15000 (got ${kb30.bar.ende_cents})`);
  ok(kb30.bank.ende_cents === 18000, `bank Ende 2030 = 18000 (got ${kb30.bank.ende_cents})`);

  console.log("\n2. Leerjahr 2031 (Carryover, keine Bewegung):");
  ok(kb31.bar.anfang_cents === kb30.bar.ende_cents, "bar Anfang 2031 == Ende 2030");
  ok(kb31.bank.anfang_cents === kb30.bank.ende_cents, "bank Anfang 2031 == Ende 2030");
  ok(kb31.bar.einnahmen_cents === 0 && kb31.bar.ausgaben_cents === 0, "bar 2031 keine Bewegung");
  ok(kb31.bank.einnahmen_cents === 0 && kb31.bank.ausgaben_cents === 0, "bank 2031 keine Bewegung");
  ok(kb31.bar.ende_cents === 15000 && kb31.bank.ende_cents === 18000, "Bestand 2031 unverändert");

  console.log("\n3. Jahr 2032 (Carryover über Leerjahr):");
  ok(kb32.bar.anfang_cents === kb31.bar.ende_cents, "bar Anfang 2032 == Ende 2031");
  ok(kb32.bank.anfang_cents === kb31.bank.ende_cents, "bank Anfang 2032 == Ende 2031");
  ok(kb32.bank.einnahmen_cents === 7000, "bank 2032: +7000");
  ok(kb32.bank.ende_cents === 25000, `bank Ende 2032 = 25000 (got ${kb32.bank.ende_cents})`);
  ok(kb32.bar.ende_cents === 15000, "bar Ende 2032 unverändert = 15000");

  console.log("\n4. Gesamt = Bar + Bank:");
  ok(kb32.gesamt.ende_cents === kb32.bar.ende_cents + kb32.bank.ende_cents, "gesamt Ende = bar + bank");
}

main()
  .then(async () => {
    await cleanup();
    console.log("");
    if (failures > 0) { console.error(`❌ ${failures} Test(s) fehlgeschlagen.`); process.exit(1); }
    console.log("✅ Alle Kassenbericht-Tests grün.");
    process.exit(0);
  })
  .catch(async (e) => {
    await cleanup();
    console.error("❌ Test-Fehler:", e?.message || e);
    process.exit(2);
  });
