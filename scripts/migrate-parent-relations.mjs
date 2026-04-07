#!/usr/bin/env node
// Run: node scripts/migrate-parent-relations.mjs <pb-url> <admin-email> <admin-password>
//
// Migriert Eltern-Kind-Verknüpfungen von den Direkt-Feldern `father_user_id` / `mother_user_id`
// auf der `students`-Collection zur Junction-Tabelle `parent_child_relations`.
//
// Das Script ist idempotent und kann mehrfach ohne Duplikate ausgeführt werden.

const PB_URL = process.argv[2];
const ADMIN_EMAIL = process.argv[3];
const ADMIN_PASSWORD = process.argv[4];

if (!PB_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "Nutzung: node scripts/migrate-parent-relations.mjs <pb-url> <admin-email> <admin-password>"
  );
  process.exit(1);
}

// --- Helpers ---

let authToken = "";

async function pbFetch(path, options = {}) {
  const url = `${PB_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: authToken } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PB API ${res.status} ${path}: ${text}`);
  }

  return res.json();
}

async function authenticate() {
  console.log("🔐 Authentifiziere als Admin...");

  // PB v0.23+ nutzt _superusers, ältere Versionen nutzen /api/admins
  const endpoints = [
    "/api/admins/auth-with-password",
    "/api/collections/_superusers/auth-with-password",
  ];

  for (const endpoint of endpoints) {
    try {
      const data = await pbFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          identity: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
        }),
      });
      authToken = data.token;
      console.log(`   ✅ Erfolgreich authentifiziert (${endpoint})\n`);
      return;
    } catch {
      // Nächsten Endpunkt versuchen
    }
  }

  throw new Error("Admin-Authentifizierung fehlgeschlagen. Prüfe E-Mail und Passwort.");
}

// Lädt alle Seiten einer Collection sequentiell
async function fetchAllRecords(collection, filter) {
  const records = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const params = new URLSearchParams({
      filter,
      perPage: String(perPage),
      page: String(page),
    });
    const data = await pbFetch(`/api/collections/${collection}/records?${params}`);
    const items = data.items || [];
    records.push(...items);

    if (items.length < perPage) break;
    page++;
  }

  return records;
}

// Prüft ob eine Relation bereits existiert (Duplikats-Check)
async function relationExists(studentId, parentUserId, mosqueId) {
  const filter = `student = "${studentId}" && parent_user = "${parentUserId}" && mosque_id = "${mosqueId}"`;
  const params = new URLSearchParams({ filter, perPage: "1" });
  const data = await pbFetch(`/api/collections/parent_child_relations/records?${params}`);
  return (data.items || []).length > 0;
}

// Erstellt eine neue Relation
async function createRelation(studentId, parentUserId, mosqueId, relationType) {
  await pbFetch("/api/collections/parent_child_relations/records", {
    method: "POST",
    body: JSON.stringify({
      student: studentId,
      parent_user: parentUserId,
      mosque_id: mosqueId,
      relation_type: relationType,
    }),
  });
}

// --- Main Migration ---

async function main() {
  console.log("🔄 Eltern-Kind-Migration gestartet");
  console.log(`   PocketBase: ${PB_URL}\n`);

  await authenticate();

  // Alle Schüler mit mindestens einem Elternteil-Feld laden
  console.log("📋 Lade Schüler mit father_user_id oder mother_user_id...");
  const filter = `father_user_id != "" || mother_user_id != ""`;
  let students;
  try {
    students = await fetchAllRecords("students", filter);
  } catch (err) {
    console.error("❌ Konnte Schüler nicht laden:", err.message);
    process.exit(1);
  }

  console.log(`   ${students.length} Schüler gefunden.\n`);

  if (students.length === 0) {
    console.log("ℹ️  Keine Schüler mit direkten Elternfeldern gefunden. Migration abgeschlossen.");
    return;
  }

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const student of students) {
    totalProcessed++;
    const name = `${student.first_name} ${student.last_name}` ;
    const mosqueId = student.mosque_id;

    if (!mosqueId) {
      console.warn(`  ⚠️  [${name}] Kein mosque_id — übersprungen`);
      totalErrors++;
      continue;
    }

    // Elternpaare die zu migrieren sind: [userId, relationType]
    const pairs = [];
    if (student.father_user_id) pairs.push([student.father_user_id, "father"]);
    if (student.mother_user_id) pairs.push([student.mother_user_id, "mother"]);

    console.log(`👦 ${name} (${student.id}) — ${pairs.length} Elternteil(e)`);

    // Sequentiell verarbeiten, um PocketBase-Auto-Cancellation zu vermeiden
    for (const [userId, relationType] of pairs) {
      try {
        const exists = await relationExists(student.id, userId, mosqueId);
        if (exists) {
          console.log(`     ⏭️  ${relationType} (${userId}) — Relation bereits vorhanden`);
          totalSkipped++;
        } else {
          await createRelation(student.id, userId, mosqueId, relationType);
          console.log(`     ✅ ${relationType} (${userId}) — Relation erstellt`);
          totalCreated++;
        }
      } catch (err) {
        console.error(`     ❌ ${relationType} (${userId}) — Fehler: ${err.message}`);
        totalErrors++;
      }
    }
  }

  // Zusammenfassung
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 Migration abgeschlossen:");
  console.log(`   Schüler verarbeitet : ${totalProcessed}`);
  console.log(`   Relationen erstellt : ${totalCreated}`);
  console.log(`   Relationen überspring: ${totalSkipped}`);
  console.log(`   Fehler              : ${totalErrors}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (totalErrors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n❌ Unerwarteter Fehler:", err.message);
  process.exit(1);
});
