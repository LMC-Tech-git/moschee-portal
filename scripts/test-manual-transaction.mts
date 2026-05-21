/**
 * Integration-Test createManualTransaction (Sprint 3) — ECHTE Server-Action gegen DEMO.
 *
 * Deckt (Plan §4.2/4.3):
 *  - create → 1 Row, classification korrekt, beleg_nummer Format JJJJ-NNNN
 *  - 2 parallele Inserts (Promise.all) → 2 VERSCHIEDENE Belegnummern (UNIQUE-Retry)
 *  - Belegnummern monoton steigend
 *  - updateTransactionNote ändert interne_notiz; betrag-Patch → throw transaction_immutable
 *  - finally-Cleanup: erzeugte tx löschen
 *
 * M6 Demo-Guard. Lauf:  npx tsx scripts/test-manual-transaction.mts <DEMO_MOSQUE_ID>
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
const { updateTransactionNote } = await import("@/lib/actions/finance");

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
const BELEG_RE = /^\d{4}-\d{4,}$/;
function belegNum(b: string): number {
  return Number(b.split("-")[1]);
}

async function getTx(id: string): Promise<any> {
  return pb(`/api/collections/transactions/records/${id}`);
}

async function cleanup() {
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
  console.log("=== Integration: createManualTransaction gegen DEMO ===\n");

  // 1. Einzelne Buchung
  console.log("1. Einzelne Einnahme:");
  const r1 = await createManualTransaction({
    mosqueId: DEMO,
    buchungsdatum: "2026-03-10",
    betragCents: 5000,
    typ: "einnahme",
    kategorie: "spenden",
    beschreibung: "TEST manuelle Spende",
    kontoTyp: "cash",
    zahlungskanal: "bar",
  });
  createdTxIds.push(r1.id);
  ok(BELEG_RE.test(r1.beleg_nummer), `beleg_nummer Format JJJJ-NNNN (${r1.beleg_nummer})`);
  const tx1 = await getTx(r1.id);
  ok(tx1.classification === "income", "classification=income (einnahme)");
  ok(tx1.typ === "einnahme", "typ=einnahme persistiert");
  ok(tx1.quelle === "manuell", "quelle=manuell");
  ok(tx1.is_storno === false, "is_storno=false");
  ok(tx1.betrag_cents === 5000, "betrag_cents=5000");

  // 2. Ausgabe → classification=expense
  console.log("\n2. Ausgabe:");
  const r2 = await createManualTransaction({
    mosqueId: DEMO,
    buchungsdatum: "2026-03-11",
    betragCents: 2000,
    typ: "ausgabe",
    kategorie: "miete",
    beschreibung: "TEST Miete",
    kontoTyp: "bank",
    zahlungskanal: "ueberweisung",
  });
  createdTxIds.push(r2.id);
  const tx2 = await getTx(r2.id);
  ok(tx2.classification === "expense", "classification=expense (ausgabe)");

  // 3. Monotonie
  console.log("\n3. Belegnummer-Monotonie:");
  ok(belegNum(r2.beleg_nummer) > belegNum(r1.beleg_nummer), `${r2.beleg_nummer} > ${r1.beleg_nummer}`);

  // 4. Parallele Inserts → verschiedene Belegnummern (UNIQUE-Retry-Beweis)
  console.log("\n4. 2 parallele Inserts (Promise.all):");
  const [p1, p2] = await Promise.all([
    createManualTransaction({
      mosqueId: DEMO, buchungsdatum: "2026-03-12", betragCents: 1000, typ: "einnahme",
      kategorie: "spenden", beschreibung: "TEST parallel A", kontoTyp: "cash",
    }),
    createManualTransaction({
      mosqueId: DEMO, buchungsdatum: "2026-03-12", betragCents: 1500, typ: "einnahme",
      kategorie: "spenden", beschreibung: "TEST parallel B", kontoTyp: "cash",
    }),
  ]);
  createdTxIds.push(p1.id, p2.id);
  ok(p1.beleg_nummer !== p2.beleg_nummer, `verschiedene Belegnummern (${p1.beleg_nummer} ≠ ${p2.beleg_nummer})`);
  ok(BELEG_RE.test(p1.beleg_nummer) && BELEG_RE.test(p2.beleg_nummer), "beide Format-konform");

  // 5. updateTransactionNote: interne_notiz erlaubt, betrag verboten
  console.log("\n5. updateTransactionNote (Immutability):");
  await updateTransactionNote(DEMO, r1.id, { interne_notiz: "geänderte Notiz" });
  ok((await getTx(r1.id)).interne_notiz === "geänderte Notiz", "interne_notiz aktualisiert");
  await throwsAsync(
    () => updateTransactionNote(DEMO, r1.id, { betrag_cents: 99 }),
    "betrag-Patch → throw transaction_immutable",
    "transaction_immutable"
  );
  ok((await getTx(r1.id)).betrag_cents === 5000, "betrag unverändert nach abgelehntem Patch");
}

main()
  .then(async () => {
    await cleanup();
    console.log("");
    if (failures > 0) {
      console.error(`❌ ${failures} Test(s) fehlgeschlagen.`);
      process.exit(1);
    }
    console.log("✅ Alle createManualTransaction-Tests grün.");
    process.exit(0);
  })
  .catch(async (e) => {
    await cleanup();
    console.error("❌ Test-Fehler:", e?.message || e);
    process.exit(2);
  });
