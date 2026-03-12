/**
 * cleanup-mosque.mjs
 * Löscht eine Moschee und alle zugehörigen PocketBase-Records vollständig.
 *
 * Aufruf:
 *   node scripts/cleanup-mosque.mjs <pb-url> <admin-email> <password> <mosque-id>
 *
 * Beispiel:
 *   node scripts/cleanup-mosque.mjs http://91.98.142.128:8090 admin@example.com secret 43xvclzp4v1cija
 */

const [pbUrl, adminEmail, adminPassword, mosqueId] = process.argv.slice(2);

if (!pbUrl || !adminEmail || !adminPassword || !mosqueId) {
  console.error("Usage: node scripts/cleanup-mosque.mjs <pb-url> <admin-email> <password> <mosque-id>");
  process.exit(1);
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function pbAdminAuth() {
  const res = await fetch(`${pbUrl}/api/admins/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: adminEmail, password: adminPassword }),
  });
  if (!res.ok) throw new Error(`Auth fehlgeschlagen: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.token;
}

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

async function getAll(token, collection, filter) {
  const ids = [];
  let page = 1;
  while (true) {
    const url = new URL(`${pbUrl}/api/collections/${collection}/records`);
    url.searchParams.set("filter", filter);
    url.searchParams.set("page", String(page));
    url.searchParams.set("perPage", "200");
    url.searchParams.set("fields", "id");
    const res = await fetch(url.toString(), {
      headers: { Authorization: token },
    });
    if (!res.ok) {
      console.warn(`  ⚠ Konnte ${collection} nicht laden: ${res.status}`);
      break;
    }
    const data = await res.json();
    ids.push(...data.items.map((r) => r.id));
    if (data.page >= data.totalPages) break;
    page++;
  }
  return ids;
}

async function deleteRecord(token, collection, id) {
  const res = await fetch(`${pbUrl}/api/collections/${collection}/records/${id}`, {
    method: "DELETE",
    headers: { Authorization: token },
  });
  if (!res.ok && res.status !== 404) {
    console.warn(`  ⚠ Löschen ${collection}/${id} fehlgeschlagen: ${res.status}`);
  }
}

async function deleteAll(token, collection, filter, label) {
  const ids = await getAll(token, collection, filter);
  if (ids.length === 0) {
    console.log(`  ✓ ${label}: keine Einträge`);
    return;
  }
  console.log(`  → Lösche ${ids.length} Einträge aus ${label}...`);
  for (const id of ids) {
    await deleteRecord(token, collection, id);
  }
  console.log(`  ✓ ${label}: ${ids.length} gelöscht`);
}

// ── Hauptprogramm ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🕌 Cleanup Moschee: ${mosqueId}`);
  console.log("   PB-URL:", pbUrl);

  const token = await pbAdminAuth();
  console.log("✅ Admin-Auth erfolgreich\n");

  const mf = `mosque_id='${mosqueId}'`;

  // Reihenfolge: abhängige Collections zuerst
  await deleteAll(token, "student_fees",       mf,                         "student_fees");
  await deleteAll(token, "attendance",          mf,                         "attendance");
  await deleteAll(token, "course_enrollments",  mf,                         "course_enrollments");
  await deleteAll(token, "students",            mf,                         "students");
  await deleteAll(token, "courses",             mf,                         "courses");
  await deleteAll(token, "academic_years",      mf,                         "academic_years");
  await deleteAll(token, "invites",             mf,                         "invites");
  await deleteAll(token, "email_outbox",        mf,                         "email_outbox");
  await deleteAll(token, "prayer_times_cache",  mf,                         "prayer_times_cache");
  await deleteAll(token, "audit_logs",          mf,                         "audit_logs");
  await deleteAll(token, "donations",           mf,                         "donations");
  await deleteAll(token, "campaigns",           mf,                         "campaigns");
  await deleteAll(token, "events",              mf,                         "events");
  await deleteAll(token, "posts",               mf,                         "posts");
  await deleteAll(token, "settings",            mf,                         "settings");

  // Users: nach mosque_id filtern
  await deleteAll(token, "users",               `mosque_id='${mosqueId}'`,  "users");

  // Moschee selbst löschen
  console.log("\n  → Lösche Moschee-Record...");
  const res = await fetch(`${pbUrl}/api/collections/mosques/records/${mosqueId}`, {
    method: "DELETE",
    headers: { Authorization: token },
  });
  if (res.ok || res.status === 404) {
    console.log("  ✓ Moschee gelöscht");
  } else {
    console.error(`  ✗ Moschee konnte nicht gelöscht werden: ${res.status} ${await res.text()}`);
  }

  console.log("\n🎉 Cleanup abgeschlossen!\n");
}

main().catch((err) => {
  console.error("Fehler:", err.message);
  process.exit(1);
});
