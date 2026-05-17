/**
 * Löscht leere/verwaiste Records: alle Base-Collection-Records mit leerem mosque_id.
 * Jeder Record wird einzeln per GET re-verifiziert (mosque_id wirklich leer) bevor DELETE.
 *
 * Default: DRY-RUN (listet nur). Echtes Löschen nur mit `--apply`.
 * Liest Zugangsdaten aus .env.local.
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes("--apply");

function loadEnv() {
  const raw = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
  const e = {};
  for (const l of raw.split(/\r?\n/)) {
    const t = l.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    e[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return e;
}

const env = loadEnv();
const PB_URL = env.POCKETBASE_URL || env.NEXT_PUBLIC_POCKETBASE_URL;
let tok = "";

async function pb(p, o = {}) {
  const r = await fetch(`${PB_URL}${p}`, {
    ...o,
    headers: { "Content-Type": "application/json", ...(tok ? { Authorization: tok } : {}), ...o.headers },
  });
  if (r.status === 204) return null;
  if (!r.ok) throw new Error(`PB ${r.status} ${p}: ${await r.text()}`);
  return r.json();
}

async function auth() {
  for (const ep of ["/api/admins/auth-with-password", "/api/collections/_superusers/auth-with-password"]) {
    try {
      const d = await pb(ep, { method: "POST", body: JSON.stringify({ identity: env.PB_ADMIN_EMAIL, password: env.PB_ADMIN_PASSWORD }) });
      tok = d.token;
      return;
    } catch {}
  }
  throw new Error("Admin-Auth fehlgeschlagen.");
}

function isBlank(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

async function main() {
  if (!PB_URL || !env.PB_ADMIN_EMAIL || !env.PB_ADMIN_PASSWORD) {
    console.error("Fehler: POCKETBASE_URL / PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD fehlen.");
    process.exit(1);
  }
  await auth();
  console.log(`🔐 Auth OK — ${PB_URL}`);
  console.log(APPLY ? "🔴 APPLY-Modus: Records werden GELÖSCHT\n" : "🟡 DRY-RUN (kein --apply): es wird NICHTS gelöscht\n");

  const cols = (await pb("/api/collections?perPage=200")).items || [];
  const baseCols = cols.filter((c) => c.type === "base" && !c.name.startsWith("_") && c.system !== true);

  let grandDeleted = 0;
  let grandSkipped = 0;

  for (const col of baseCols) {
    const schema = col.schema || col.fields || [];
    const hasMosqueId = schema.some((f) => f.name === "mosque_id");
    if (!hasMosqueId) continue; // Sicherheitsnetz: nur Collections mit mosque_id-Feld

    // Alle IDs mit leerem mosque_id sammeln (Paginierung; immer Seite 1, da wir löschen)
    let deleted = 0;
    let skipped = 0;
    let safety = 0;

    while (true) {
      const res = await pb(`/api/collections/${col.name}/records?page=1&perPage=200`);
      const items = res.items || [];
      const junk = items.filter((r) => isBlank(r.mosque_id));

      if (junk.length === 0) break;

      for (const rec of junk) {
        // Re-Verify direkt vor Delete
        const fresh = await pb(`/api/collections/${col.name}/records/${rec.id}`);
        if (!isBlank(fresh.mosque_id)) {
          skipped++;
          continue;
        }
        if (APPLY) {
          await pb(`/api/collections/${col.name}/records/${rec.id}`, { method: "DELETE" });
        }
        deleted++;
      }

      if (!APPLY) break; // Dry-Run: nicht endlos paginieren
      safety++;
      if (safety > 100) {
        console.warn(`   ⚠️  ${col.name}: Safety-Limit erreicht, Abbruch dieser Collection`);
        break;
      }
    }

    if (deleted || skipped) {
      console.log(`📦 ${col.name}: ${APPLY ? "gelöscht" : "würde löschen"} ${deleted}${skipped ? `, übersprungen ${skipped} (mosque_id doch gesetzt)` : ""}`);
      grandDeleted += deleted;
      grandSkipped += skipped;
    }
  }

  console.log(`\n=== ${APPLY ? "✅ Gelöscht" : "🟡 Dry-Run Summe"}: ${grandDeleted} Records${grandSkipped ? `, ${grandSkipped} übersprungen` : ""} ===`);
  if (!APPLY) console.log("→ Mit `--apply` ausführen zum echten Löschen.");
}

main().catch((e) => {
  console.error("\n❌ Fehlgeschlagen:", e.message);
  process.exit(1);
});
