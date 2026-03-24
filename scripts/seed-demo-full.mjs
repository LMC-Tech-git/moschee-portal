#!/usr/bin/env node
/**
 * seed-demo-full.mjs — Vollständiger Demo-Seed für moschee.app
 *
 * Erstellt realistische, vollständige Testdaten für eine bereits vorhandene Demo-Moschee.
 * Idempotent: kann beliebig oft ausgeführt werden (findOrCreate-Muster).
 *
 * Verwendung:
 *   node scripts/seed-demo-full.mjs <pb-url> <admin-email> <admin-password> <mosque-id>
 *
 * Beispiel:
 *   node scripts/seed-demo-full.mjs http://localhost:8090 admin@example.com secret 43xvclzp4v1cija
 */

// ─── Konfiguration ───────────────────────────────────────────────────────────

const PB_URL        = process.argv[2];
const ADMIN_EMAIL   = process.argv[3];
const ADMIN_PASSWORD = process.argv[4];
const MOSQUE_ID     = process.argv[5];

if (!PB_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD || !MOSQUE_ID) {
  console.error("Verwendung: node scripts/seed-demo-full.mjs <pb-url> <admin-email> <admin-password> <mosque-id>");
  process.exit(1);
}

const DEMO_PASSWORD = "Demo1234!";
let authToken = "";

// ─── 1. API-Hilfsfunktionen ───────────────────────────────────────────────────

async function pbFetch(path, options = {}) {
  const url = PB_URL + "/api/" + path;
  const headers = {
    "Content-Type": "application/json",
    ...(authToken ? { Authorization: authToken } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(url, { ...options, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && options.throwOnError !== false) {
    throw new Error("PB " + res.status + " " + path + ": " + JSON.stringify(json));
  }
  return json;
}

async function authenticate() {
  console.log("🔐 Authentifiziere...");
  // PocketBase < 0.23
  const data = await pbFetch("admins/auth-with-password", {
    method: "POST",
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    throwOnError: false,
  });
  if (data.token) {
    authToken = data.token;
  } else {
    // PocketBase >= 0.23
    const data2 = await pbFetch("collections/_superusers/auth-with-password", {
      method: "POST",
      body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    authToken = data2.token;
  }
  console.log("✅ Authentifiziert\n");
}

/** Findet einen Datensatz oder erstellt ihn. Gibt { record, created } zurück. */
async function findOrCreate(collection, filter, createData) {
  try {
    const result = await pbFetch(
      "collections/" + collection + "/records?filter=" + encodeURIComponent(filter) + "&perPage=1",
      { throwOnError: false }
    );
    if (result.items && result.items.length > 0) {
      return { record: result.items[0], created: false };
    }
  } catch {}
  const record = await pbFetch("collections/" + collection + "/records", {
    method: "POST",
    body: JSON.stringify(createData),
  });
  return { record, created: true };
}

/** Erstellt einen Datensatz ohne Duplikat-Prüfung. */
async function pbCreate(collection, data) {
  return pbFetch("collections/" + collection + "/records", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Erstellt viele Datensätze in parallelen Chunks (Performance). */
async function batchCreate(collection, items, chunkSize = 10) {
  let created = 0;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await Promise.all(chunk.map((item) => pbCreate(collection, item).catch((e) => {
      console.warn("    ⚠️  Batch-Fehler:", e.message);
    })));
    created += chunk.length;
  }
  return created;
}

/** Löscht alle Datensätze einer Collection für eine Moschee. */
async function deleteAllForMosque(collection, extraFilter = "") {
  const filter = `mosque_id = "${MOSQUE_ID}"` + (extraFilter ? ` && ${extraFilter}` : "");
  let page = 1;
  let total = 0;
  while (true) {
    const result = await pbFetch(
      `collections/${collection}/records?filter=${encodeURIComponent(filter)}&perPage=200&page=${page}`,
      { throwOnError: false }
    );
    const items = result.items || [];
    if (items.length === 0) break;
    await Promise.all(items.map((r) =>
      pbFetch(`collections/${collection}/records/${r.id}`, { method: "DELETE", throwOnError: false })
    ));
    total += items.length;
    if (items.length < 200) break;
    page++;
  }
  return total;
}

// ─── 2. Datum-Hilfsfunktionen ────────────────────────────────────────────────

const NOW = new Date();
const CY  = NOW.getFullYear(); // aktuelles Kalenderjahr

function daysAgo(n) {
  return new Date(NOW.getTime() - n * 86400000);
}
function daysFromNow(n) {
  return new Date(NOW.getTime() + n * 86400000);
}
function isoDate(d) {
  return d.toISOString().substring(0, 10);
}
function isoDateTime(d) {
  return d.toISOString().replace("T", " ").substring(0, 19) + ".000Z";
}
function monthKey(d) {
  return d.toISOString().substring(0, 7);
}
function monthsAgo(n) {
  const d = new Date(NOW);
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return d;
}

// ─── 3. Daten-Definitionen ───────────────────────────────────────────────────

// Schuljahre dynamisch (nie veraltet)
const ARCHIVED_YEAR_NAME = `${CY - 1}/${String(CY).slice(-2)}`;
const ACTIVE_YEAR_NAME   = `${CY}/${String(CY + 1).slice(-2)}`;

// Mitglieder-Daten (20 Personen, realistisch deutsch/türkisch)
const MEMBER_DATA = [
  { first: "Mehmet",   last: "Yilmaz",    phone: "+49 151 11223344", address: "Hauptstraße 12, 10115 Berlin" },
  { first: "Ayse",     last: "Kaya",       phone: "+49 152 22334455", address: "Berliner Allee 5, 10117 Berlin" },
  { first: "Mustafa",  last: "Demir",      phone: "+49 153 33445566", address: "Friedrichstraße 88, 10117 Berlin" },
  { first: "Fatma",    last: "Arslan",     phone: "+49 154 44556677", address: "Unter den Linden 20, 10117 Berlin" },
  { first: "Abdullah", last: "Celik",      phone: "+49 155 55667788", address: "Alexanderplatz 3, 10178 Berlin" },
  { first: "Hatice",   last: "Sahin",      phone: "+49 156 66778899", address: "Potsdamer Platz 1, 10785 Berlin" },
  { first: "Hasan",    last: "Ozturk",     phone: "+49 157 77889900", address: "Kurfürstendamm 44, 10719 Berlin" },
  { first: "Nalan",    last: "Kurt",       phone: "+49 158 88990011", address: "Tauentzienstraße 7, 10789 Berlin" },
  { first: "Ali",      last: "Polat",      phone: "+49 159 99001122", address: "Schönhauser Allee 30, 10119 Berlin" },
  { first: "Zeynep",   last: "Yildiz",     phone: "+49 160 00112233", address: "Prenzlauer Allee 48, 10405 Berlin" },
  { first: "Hans",     last: "Müller",     phone: "+49 161 11223345", address: "Münzstraße 10, 10178 Berlin" },
  { first: "Sabine",   last: "Fischer",    phone: "+49 162 22334456", address: "Rosenthaler Straße 14, 10119 Berlin" },
  { first: "Klaus",    last: "Wagner",     phone: "+49 163 33445567", address: "Torstraße 65, 10119 Berlin" },
  { first: "Maria",    last: "Schmitt",    phone: "+49 164 44556678", address: "Kastanienallee 22, 10435 Berlin" },
  { first: "Thomas",   last: "Becker",     phone: "+49 165 55667789", address: "Oranienburger Str. 8, 10178 Berlin" },
  { first: "Ahmed",    last: "Al-Hassan",  phone: "+49 166 66778890", address: "Skalitzer Straße 80, 10997 Berlin" },
  { first: "Sara",     last: "Ibrahim",    phone: "+49 167 77889901", address: "Sonnenallee 120, 12045 Berlin" },
  { first: "Omar",     last: "Khalil",     phone: "+49 168 88990012", address: "Karl-Marx-Straße 90, 12043 Berlin" },
  { first: "Leila",    last: "Mansouri",   phone: "+49 169 99001123", address: "Hermannstraße 40, 12049 Berlin" },
  { first: "Daniel",   last: "Hoffmann",   phone: "+49 170 00112234", address: "Urbanstraße 15, 10967 Berlin" },
];

// Schüler-Daten (20 Kinder)
const STUDENT_DATA = [
  { first: "Fatima",  last: "Yilmaz",  dob: `${CY - 9}-03-15`, gender: "female", father: "Mehmet Yilmaz",   father_phone: "+49 151 11223344", mother: "Ayse Yilmaz",     mother_phone: "+49 151 11223345" },
  { first: "Musa",    last: "Kaya",    dob: `${CY - 10}-06-20`, gender: "male",   father: "Hasan Kaya",      father_phone: "+49 152 22334455", mother: "Ayse Kaya",       mother_phone: "+49 152 22334456" },
  { first: "Elif",    last: "Demir",   dob: `${CY - 9}-09-10`, gender: "female", father: "Mustafa Demir",   father_phone: "+49 153 33445566", mother: "Hatice Demir",    mother_phone: "+49 153 33445567" },
  { first: "Ibrahim", last: "Celik",   dob: `${CY - 11}-11-05`, gender: "male",   father: "Abdullah Celik",  father_phone: "+49 155 55667788", mother: "Fatma Celik",     mother_phone: "+49 155 55667789" },
  { first: "Zeynep",  last: "Arslan",  dob: `${CY - 8}-02-28`, gender: "female", father: "Recep Arslan",    father_phone: "+49 154 44556677", mother: "Fatma Arslan",    mother_phone: "+49 154 44556678" },
  { first: "Ali",     last: "Sahin",   dob: `${CY - 10}-07-12`, gender: "male",   father: "Mehmet Sahin",    father_phone: "+49 156 66778899", mother: "Hatice Sahin",    mother_phone: "+49 156 66778900" },
  { first: "Hatice",  last: "Ozturk",  dob: `${CY - 9}-04-22`, gender: "female", father: "Hasan Ozturk",   father_phone: "+49 157 77889900", mother: "Nalan Ozturk",    mother_phone: "+49 157 77889901" },
  { first: "Yusuf",   last: "Kurt",    dob: `${CY - 11}-08-30`, gender: "male",   father: "Kemal Kurt",      father_phone: "+49 158 88990011", mother: "Nalan Kurt",      mother_phone: "+49 158 88990012" },
  { first: "Merve",   last: "Polat",   dob: `${CY - 8}-01-14`, gender: "female", father: "Ali Polat",       father_phone: "+49 159 99001122", mother: "Zeynep Polat",    mother_phone: "+49 159 99001123" },
  { first: "Osman",   last: "Yildiz",  dob: `${CY - 10}-10-08`, gender: "male",   father: "Kadir Yildiz",    father_phone: "+49 160 00112233", mother: "Zeynep Yildiz",   mother_phone: "+49 160 00112234" },
  { first: "Safiye",  last: "Müller",  dob: `${CY - 9}-05-17`, gender: "female", father: "Hans Müller",     father_phone: "+49 161 11223345", mother: "Sabine Müller",   mother_phone: "+49 161 11223346" },
  { first: "Davut",   last: "Fischer", dob: `${CY - 10}-12-03`, gender: "male",   father: "Klaus Fischer",   father_phone: "+49 162 22334456", mother: "Sabine Fischer",  mother_phone: "+49 162 22334457" },
  { first: "Rümeysa", last: "Wagner",  dob: `${CY - 8}-07-25`, gender: "female", father: "Klaus Wagner",    father_phone: "+49 163 33445567", mother: "Maria Wagner",    mother_phone: "+49 163 33445568" },
  { first: "Burak",   last: "Schmitt", dob: `${CY - 11}-03-11`, gender: "male",   father: "Thomas Schmitt",  father_phone: "+49 164 44556678", mother: "Maria Schmitt",   mother_phone: "+49 164 44556679" },
  { first: "Nisa",    last: "Al-Hassan", dob: `${CY - 9}-09-29`, gender: "female", father: "Ahmed Al-Hassan", father_phone: "+49 166 66778890", mother: "Sara Al-Hassan",  mother_phone: "+49 166 66778891" },
  { first: "Tariq",   last: "Ibrahim", dob: `${CY - 10}-06-07`, gender: "male",   father: "Omar Ibrahim",    father_phone: "+49 167 77889901", mother: "Sara Ibrahim",    mother_phone: "+49 167 77889902" },
  { first: "Meryem",  last: "Khalil",  dob: `${CY - 8}-11-18`, gender: "female", father: "Omar Khalil",     father_phone: "+49 168 88990012", mother: "Leila Khalil",    mother_phone: "+49 168 88990013" },
  { first: "Suleiman", last: "Becker", dob: `${CY - 11}-04-02`, gender: "male",   father: "Thomas Becker",   father_phone: "+49 165 55667789", mother: "Maria Becker",    mother_phone: "+49 165 55667790" },
  { first: "Esra",    last: "Hoffmann",dob: `${CY - 9}-08-14`, gender: "female", father: "Daniel Hoffmann", father_phone: "+49 170 00112234", mother: "Leila Hoffmann",  mother_phone: "+49 170 00112235" },
  { first: "Hamza",   last: "Mansouri",dob: `${CY - 10}-01-21`, gender: "male",   father: "Omar Mansouri",   father_phone: "+49 169 99001123", mother: "Leila Mansouri",  mother_phone: "+49 169 99001124" },
];

// Anwesenheits-Matrix: 6 Sitzungen × 10 Schüler
// present=p, absent=a, late=l, excused=e
const ATTENDANCE_MATRIX = [
  //  Fatima   Musa     Elif     Ibrahim  Zeynep   Ali      Hatice   Yusuf    Merve    Osman
  ["present","present","late",   "present","absent", "present","excused","present","present","absent" ],
  ["present","absent", "present","present","present","present","present","absent", "present","absent" ],
  ["present","present","present","absent", "present","present","present","absent", "late",   "present"],
  ["present","present","absent", "present","present","late",   "present","present","present","present"],
  ["absent", "present","present","present","present","present","absent", "present","present","present"],
  ["present","present","present","present","late",   "present","present","present","absent", "present"],
];

// Gebühren-Muster: status + Zahlungsmethode pro Schüler (3 Monate)
// Format: [{ status, method }] für jeden Monat
const FEE_PATTERNS = [
  [{ s: "paid", m: "cash" },     { s: "paid", m: "cash" },     { s: "open",   m: "" }],
  [{ s: "paid", m: "transfer" }, { s: "open", m: "" },          { s: "open",   m: "" }],
  [{ s: "paid", m: "cash" },     { s: "paid", m: "transfer" }, { s: "paid",   m: "cash" }],
  [{ s: "waived", m: "waived" }, { s: "waived", m: "waived" }, { s: "open",   m: "" }],
  [{ s: "paid", m: "cash" },     { s: "open", m: "" },          { s: "open",   m: "" }],
  [{ s: "paid", m: "cash" },     { s: "paid", m: "cash" },     { s: "paid",   m: "cash" }],
  [{ s: "waived", m: "waived" }, { s: "open", m: "" },          { s: "open",   m: "" }],
  [{ s: "paid", m: "transfer" }, { s: "paid", m: "transfer" }, { s: "open",   m: "" }],
  [{ s: "open", m: "" },          { s: "open", m: "" },          { s: "open",   m: "" }],
  [{ s: "paid", m: "cash" },     { s: "open", m: "" },          { s: "paid",   m: "cash" }],
  [{ s: "paid", m: "transfer" }, { s: "paid", m: "cash" },     { s: "open",   m: "" }],
  [{ s: "paid", m: "cash" },     { s: "paid", m: "transfer" }, { s: "paid",   m: "transfer" }],
];

// Gast-Spender für Donations
const GUEST_DONORS = [
  { name: "Familie Wagner",     email: "wagner@example.de" },
  { name: "M. Al-Rashid",       email: "alrashid@example.de" },
  { name: "Karima Bouali",      email: "kbouali@example.de" },
  { name: "Thomas Richter",     email: "t.richter@example.de" },
  { name: "Amina Öztürk",       email: "a.ozturk@example.de" },
  { name: "Stefan Lehmann",     email: "s.lehmann@example.de" },
  { name: "Nura Hassan",        email: "nhassan@example.de" },
  { name: "Peter Braun",        email: "p.braun@example.de" },
  { name: "Yasmin Khalid",      email: "ykhalid@example.de" },
  { name: "Familie Bergmann",   email: "bergmann@example.de" },
  { name: "Lukas Schneider",    email: "l.schneider@example.de" },
  { name: "Hira Mahmood",       email: "hmahmood@example.de" },
  { name: "Cem Erdogan",        email: "c.erdogan@example.de" },
  { name: "Ingrid Zimmermann",  email: "i.zimmer@example.de" },
  { name: "Jamal Osman",        email: "j.osman@example.de" },
];

// ─── 4. Seed-Funktionen ──────────────────────────────────────────────────────

async function verifyMosque() {
  console.log("🕌 Prüfe Demo-Moschee...");
  const result = await pbFetch(
    "collections/mosques/records/" + MOSQUE_ID,
    { throwOnError: false }
  );
  if (!result.id) {
    throw new Error("Moschee nicht gefunden: " + MOSQUE_ID);
  }
  console.log("  ✅ Moschee: " + result.name + " (" + MOSQUE_ID + ")\n");
  return result;
}

async function seedUsers() {
  console.log("👥 Benutzer...");

  const staffDefs = [
    { email: "demo-admin@moschee.app",    first: "Admin",    last: "Demo",  role: "admin",   no: "DEMO-001", phone: "+49 30 100001", address: "Verwaltung, 10115 Berlin" },
    { email: "demo-imam@moschee.app",     first: "Musa",     last: "Al-Amin", role: "imam",  no: "DEMO-002", phone: "+49 30 100002", address: "Moscheestraße 1, 10115 Berlin" },
    { email: "demo-imam2@moschee.app",    first: "Yusuf",    last: "Rahman", role: "imam",   no: "DEMO-003", phone: "+49 30 100003", address: "Moscheestraße 1, 10115 Berlin" },
    { email: "demo-teacher@moschee.app",  first: "Aisha",    last: "Karimi", role: "teacher",no: "DEMO-010", phone: "+49 30 100010", address: "Lehrerpfad 5, 10117 Berlin" },
    { email: "demo-teacher2@moschee.app", first: "Yasemin",  last: "Demir",  role: "teacher",no: "DEMO-011", phone: "+49 30 100011", address: "Lehrerpfad 6, 10117 Berlin" },
    { email: "demo-teacher3@moschee.app", first: "Bilal",    last: "Hassan", role: "teacher",no: "DEMO-012", phone: "+49 30 100012", address: "Lehrerpfad 7, 10117 Berlin" },
  ];

  const ids = {};

  for (const u of staffDefs) {
    const { record, created } = await findOrCreate("users", `email = "${u.email}"`, {
      email: u.email,
      password: DEMO_PASSWORD,
      passwordConfirm: DEMO_PASSWORD,
      emailVisibility: true,
      first_name: u.first,
      last_name: u.last,
      full_name: u.first + " " + u.last,
      mosque_id: MOSQUE_ID,
      role: u.role,
      status: "active",
      member_no: u.no,
      membership_number: u.no,
      phone: u.phone,
      address: u.address,
    });
    console.log(created ? `  ✅ ${u.email} (${u.role})` : `  ⏭️  ${u.email}`);
    const key = u.role === "admin" ? "admin"
      : u.role === "imam" && !ids.imam ? "imam"
      : u.role === "imam" ? "imam2"
      : u.role === "teacher" && !ids.teacher1 ? "teacher1"
      : u.role === "teacher" && !ids.teacher2 ? "teacher2"
      : "teacher3";
    ids[key] = record.id;
  }

  // Mitglieder
  const memberIds = [];
  for (let i = 0; i < MEMBER_DATA.length; i++) {
    const m = MEMBER_DATA[i];
    const no = i + 1;
    const email = `demo-member-${String(no).padStart(2, "0")}@moschee.app`;
    const { record, created } = await findOrCreate("users", `email = "${email}"`, {
      email,
      password: DEMO_PASSWORD,
      passwordConfirm: DEMO_PASSWORD,
      emailVisibility: true,
      first_name: m.first,
      last_name: m.last,
      full_name: m.first + " " + m.last,
      mosque_id: MOSQUE_ID,
      role: "member",
      status: "active",
      member_no: `DEMO-${100 + no}`,
      membership_number: `DEMO-${100 + no}`,
      phone: m.phone,
      address: m.address,
    });
    if (created) process.stdout.write("  ✅");
    else process.stdout.write("  ⏭️ ");
    process.stdout.write(` ${m.first} ${m.last}\n`);
    memberIds.push(record.id);
  }

  console.log(`  → ${staffDefs.length + MEMBER_DATA.length} Benutzer gesamt\n`);
  return { ...ids, memberIds };
}

async function seedTeamMembers() {
  console.log("🏅 Team-Mitglieder...");
  const team = [
    {
      name: "Musa Al-Amin",
      role: "Imam",
      bio: "Imam der Gemeinde seit über 15 Jahren. Absolvent der Islamischen Universität Medina mit Schwerpunkt Koranwissenschaften.",
      group: "Vorstand",
      sort_order: 1,
    },
    {
      name: "Dr. Ahmet Yilmaz",
      role: "1. Vorsitzender",
      bio: "Promovierter Ingenieur und ehrenamtlicher Vorsitzender. Leitet die Gemeinde seit 2018 mit großem Engagement.",
      group: "Vorstand",
      sort_order: 2,
    },
    {
      name: "Ibrahim Kaya",
      role: "Kassenwart",
      bio: "Diplom-Kaufmann und verantwortlich für die Finanzen der Gemeinde. Sorgt für transparente und ordentliche Buchführung.",
      group: "Vorstand",
      sort_order: 3,
    },
    {
      name: "Fatima Demir",
      role: "Jugendleiterin",
      bio: "Sozialarbeiterin und Leiterin der Jugendgruppe. Organisiert regelmäßige Workshops, Ausflüge und Freizeitangebote.",
      group: "Jugend",
      sort_order: 4,
    },
    {
      name: "Zeynep Arslan",
      role: "Frauenbeauftragte",
      bio: "Lehrerin und Koordinatorin der Frauengruppe. Bietet Deutsch-Kurse, Nähkreise und Beratungsangebote an.",
      group: "Soziales",
      sort_order: 5,
    },
    {
      name: "Mehmet Celik",
      role: "IT & Medien",
      bio: "Softwareentwickler und zuständig für die digitale Infrastruktur der Gemeinde. Betreut Website und Portal.",
      group: "Technik",
      sort_order: 6,
    },
  ];

  for (const t of team) {
    const { created } = await findOrCreate(
      "team_members",
      `mosque_id = "${MOSQUE_ID}" && name = "${t.name}"`,
      { ...t, mosque_id: MOSQUE_ID, is_active: true }
    );
    console.log(created ? `  ✅ ${t.name} (${t.role})` : `  ⏭️  ${t.name}`);
  }
  console.log();
}

async function seedAcademicYears() {
  console.log("📅 Schuljahre...");
  const years = [
    {
      name: ARCHIVED_YEAR_NAME,
      start_date: `${CY - 1}-09-01`,
      end_date: `${CY}-07-31`,
      status: "archived",
    },
    {
      name: ACTIVE_YEAR_NAME,
      start_date: `${CY}-09-01`,
      end_date: `${CY + 1}-07-31`,
      status: "active",
    },
  ];
  const ids = {};
  for (const y of years) {
    const { record, created } = await findOrCreate(
      "academic_years",
      `mosque_id = "${MOSQUE_ID}" && name = "${y.name}"`,
      { ...y, mosque_id: MOSQUE_ID }
    );
    console.log(created ? `  ✅ ${y.name} (${y.status})` : `  ⏭️  ${y.name}`);
    if (y.status === "active")   ids.active   = record.id;
    if (y.status === "archived") ids.archived = record.id;
  }
  console.log();
  return ids;
}

async function seedCourses(yearIds, teacherIds) {
  console.log("📚 Kurse...");
  const courses = [
    {
      title: "Quran für Anfänger",
      description: "Grundlagen der Quran-Rezitation für Kinder im Alter von 6–10 Jahren. Schwerpunkte: arabische Buchstaben, Harakat und erste kurze Suren.",
      category: "quran",
      level: "beginner",
      academic_year_id: yearIds.active,
      teacher_id: teacherIds.teacher1,
      created_by: teacherIds.teacher1,
      day_of_week: "saturday",
      start_time: "10:00",
      end_time: "11:30",
      location_name: "Unterrichtsraum 1",
      max_students: 20,
      status: "active",
    },
    {
      title: "Quran Fortgeschrittene",
      description: "Vertiefende Quran-Rezitation für Kinder, die die Grundlagen beherrschen. Ziel ist die eigenständige Rezitation längerer Suren.",
      category: "quran",
      level: "intermediate",
      academic_year_id: yearIds.active,
      teacher_id: teacherIds.teacher1,
      created_by: teacherIds.teacher1,
      day_of_week: "sunday",
      start_time: "10:00",
      end_time: "11:30",
      location_name: "Unterrichtsraum 1",
      max_students: 15,
      status: "active",
    },
    {
      title: "Arabisch-Kurs A1",
      description: "Arabisch für Anfänger — Aufbau des Grundwortschatzes, einfache Satzstrukturen und schriftliches Arabisch.",
      category: "arabic",
      level: "beginner",
      academic_year_id: yearIds.active,
      teacher_id: teacherIds.teacher2,
      created_by: teacherIds.teacher2,
      day_of_week: "saturday",
      start_time: "14:00",
      end_time: "15:30",
      location_name: "Seminarraum",
      max_students: 18,
      status: "active",
    },
    {
      title: "Islamkunde & Sira",
      description: "Geschichte des Propheten Muhammad (ﷺ) und Grundlagen des islamischen Glaubens für Kinder und Jugendliche.",
      category: "sira",
      level: "mixed",
      academic_year_id: yearIds.active,
      teacher_id: teacherIds.teacher3,
      created_by: teacherIds.teacher3,
      day_of_week: "sunday",
      start_time: "14:00",
      end_time: "15:30",
      location_name: "Seminarraum",
      max_students: 25,
      status: "active",
    },
    {
      title: "Tajweed-Kurs",
      description: "Regeln der korrekten Quran-Rezitation (Tajweed) für Fortgeschrittene — Archivkurs des vergangenen Schuljahres.",
      category: "tajweed",
      level: "intermediate",
      academic_year_id: yearIds.archived,
      teacher_id: teacherIds.teacher2,
      created_by: teacherIds.teacher2,
      day_of_week: "saturday",
      start_time: "10:00",
      end_time: "11:30",
      location_name: "Unterrichtsraum 2",
      max_students: 12,
      status: "archived",
    },
  ];

  const courseIds = [];
  for (const c of courses) {
    const { record, created } = await findOrCreate(
      "courses",
      `mosque_id = "${MOSQUE_ID}" && title = "${c.title}" && academic_year_id = "${c.academic_year_id}"`,
      { ...c, mosque_id: MOSQUE_ID }
    );
    console.log(created ? `  ✅ ${c.title}` : `  ⏭️  ${c.title}`);
    courseIds.push(record.id);
  }
  console.log();
  return courseIds; // [quranA, quranB, arabisch, islamkunde, tajweed]
}

async function seedStudents() {
  console.log("🧒 Schüler...");
  const studentIds = [];
  for (const s of STUDENT_DATA) {
    const { record, created } = await findOrCreate(
      "students",
      `mosque_id = "${MOSQUE_ID}" && first_name = "${s.first}" && last_name = "${s.last}"`,
      {
        mosque_id: MOSQUE_ID,
        first_name: s.first,
        last_name: s.last,
        date_of_birth: s.dob,
        gender: s.gender,
        father_name: s.father,
        father_phone: s.father_phone,
        mother_name: s.mother,
        mother_phone: s.mother_phone,
        parent_name: s.father,
        parent_phone: s.father_phone,
        address: "Berlin",
        school_name: "Grundschule Berlin-Mitte",
        school_class: "",
        health_notes: "",
        status: "active",
        membership_status: "none",
        whatsapp_contact: "both",
        notes: "",
      }
    );
    if (created) process.stdout.write(`  ✅ ${s.first} ${s.last}\n`);
    else process.stdout.write(`  ⏭️  ${s.first} ${s.last}\n`);
    studentIds.push(record.id);
  }
  console.log();
  return studentIds;
}

async function seedEnrollments(courseIds, studentIds) {
  console.log("📋 Kurseinschreibungen...");
  // Kurs 0 (Quran A):    Schüler 0–9
  // Kurs 1 (Quran B):    Schüler 5–13
  // Kurs 2 (Arabisch):   Schüler 10–17
  // Kurs 3 (Islamkunde): Schüler 2–11
  // Kurs 4 (Tajweed):    Schüler 0–5 (completed)
  const assignments = [
    { cIdx: 0, sRange: [0, 9],  status: "enrolled" },
    { cIdx: 1, sRange: [5, 13], status: "enrolled" },
    { cIdx: 2, sRange: [10, 17], status: "enrolled" },
    { cIdx: 3, sRange: [2, 11], status: "enrolled" },
    { cIdx: 4, sRange: [0, 5],  status: "completed" },
  ];
  let total = 0;
  for (const { cIdx, sRange, status } of assignments) {
    for (let i = sRange[0]; i <= sRange[1]; i++) {
      const sid = studentIds[i];
      const cid = courseIds[cIdx];
      const { created } = await findOrCreate(
        "course_enrollments",
        `course_id = "${cid}" && student_id = "${sid}"`,
        {
          mosque_id: MOSQUE_ID,
          course_id: cid,
          student_id: sid,
          status,
          enrolled_at: isoDateTime(daysAgo(150)),
          completed_at: status === "completed" ? isoDateTime(daysAgo(30)) : "",
          notes: "",
        }
      );
      if (created) total++;
    }
  }
  console.log(`  ✅ ${total} neue Einschreibungen\n`);
}

async function seedAttendance(courseIds, studentIds, teacherId) {
  console.log("📊 Anwesenheiten (Kurs: Quran Anfänger)...");
  const courseId   = courseIds[0];
  const sessions   = [42, 35, 28, 21, 14, 7].map(daysAgo).map(isoDate);
  const firstTen   = studentIds.slice(0, 10);
  const NOTES = {
    excused: "Krankheitsbedingt entschuldigt.",
    late:    "Ca. 10–15 Minuten zu spät erschienen.",
  };

  const records = [];
  for (let si = 0; si < sessions.length; si++) {
    for (let ki = 0; ki < firstTen.length; ki++) {
      const status = ATTENDANCE_MATRIX[si][ki];
      records.push({
        mosque_id: MOSQUE_ID,
        course_id: courseId,
        student_id: firstTen[ki],
        session_date: sessions[si],
        status,
        notes: NOTES[status] || "",
        marked_by: teacherId,
      });
    }
  }

  // Idempotenz: nur fehlende anlegen
  let created = 0;
  for (const rec of records) {
    const filter = `course_id="${rec.course_id}"&&student_id="${rec.student_id}"&&session_date="${rec.session_date}"`;
    const existing = await pbFetch(
      `collections/attendance/records?filter=${encodeURIComponent(filter)}&perPage=1`,
      { throwOnError: false }
    );
    if (existing?.items?.length > 0) continue;
    await pbCreate("attendance", rec).catch(() => {});
    created++;
  }
  console.log(`  ✅ ${created} neue Anwesenheitseinträge (${records.length} gesamt)\n`);
}

async function seedStudentFees(studentIds, adminId) {
  console.log("💳 Schülergebühren...");
  const months  = [monthKey(monthsAgo(2)), monthKey(monthsAgo(1)), monthKey(new Date())];
  const firstTwelve = studentIds.slice(0, 12);
  const FEE_CENTS = 1500;
  let created = 0;

  for (let ki = 0; ki < firstTwelve.length; ki++) {
    const sid = firstTwelve[ki];
    for (let mi = 0; mi < months.length; mi++) {
      const mk = months[mi];
      const { s: status, m: method } = FEE_PATTERNS[ki][mi];
      const existing = await pbFetch(
        `collections/student_fees/records?filter=${encodeURIComponent(`student_id="${sid}"&&month_key="${mk}"`)}&perPage=1`,
        { throwOnError: false }
      );
      if (existing?.items?.length > 0) continue;

      await pbCreate("student_fees", {
        mosque_id: MOSQUE_ID,
        student_id: sid,
        month_key: mk,
        amount_cents: FEE_CENTS,
        status,
        payment_method: method,
        paid_at: status === "paid" ? `${mk}-15 12:00:00.000Z` : "",
        notes: status === "waived" ? "Soziale Ermäßigung gewährt." : "",
        provider_ref: "",
        created_by: adminId,
      }).catch(() => {});
      created++;
    }
  }
  console.log(`  ✅ ${created} neue Gebühren\n`);
}

async function seedPosts(adminId) {
  console.log("📝 Beiträge...");
  const posts = [
    {
      title: "Willkommen beim Demo-Portal",
      content: "Dies ist eine Demonstration von moschee.app — der digitalen Verwaltungslösung für Moscheen. Alle Funktionen können hier ausprobiert werden. Wir freuen uns über Ihr Interesse und stehen für Fragen jederzeit zur Verfügung.",
      category: "announcement",
      visibility: "public",
      status: "published",
      pinned: true,
      daysBack: 30,
    },
    {
      title: "Ramadan Mubarak — Gebetszeiten & Programm",
      content: "Wir wünschen unserer gesamten Gemeinschaft einen gesegneten Ramadan! Die aktuellen Gebetszeiten sowie das vollständige Ramadan-Programm mit Tarawih und Iftar-Veranstaltungen finden Sie auf unserer Website. Möge Allah unsere Gebete und unser Fasten annehmen.",
      category: "announcement",
      visibility: "public",
      status: "published",
      pinned: true,
      daysBack: 25,
    },
    {
      title: "Neue Arabisch-Kurse ab Herbst",
      content: "Wir freuen uns, für das kommende Schuljahr neue Arabisch-Kurse für alle Altersgruppen anbieten zu können. Die Kurse richten sich sowohl an absolute Anfänger als auch an Teilnehmer mit Grundkenntnissen. Anmeldungen sind ab sofort möglich.",
      category: "general",
      visibility: "public",
      status: "published",
      pinned: false,
      daysBack: 20,
    },
    {
      title: "Spendenkampagne: Neue Waschräume 2025",
      content: "Unsere Gemeinde benötigt dringend renovierte Waschräume. Wir haben eine Spendenkampagne gestartet und sind bereits auf gutem Weg zum Ziel. Jede Spende zählt — helfen Sie uns, dieses wichtige Projekt zu verwirklichen! Mehr Informationen finden Sie auf der Kampagnenseite.",
      category: "campaign",
      visibility: "public",
      status: "published",
      pinned: false,
      daysBack: 18,
    },
    {
      title: "Freitagspredigt: Geduld und Dankbarkeit",
      content: "Die heutige Freitagspredigt behandelte das Thema Geduld (Sabr) und Dankbarkeit (Shukr) im alltäglichen Leben. Wer die Predigt verpasst hat: Eine Zusammenfassung wird in Kürze hier veröffentlicht. Wir danken unserem Imam für die bewegenden Worte.",
      category: "general",
      visibility: "public",
      status: "published",
      pinned: false,
      daysBack: 12,
    },
    {
      title: 'Jugend-Workshop "Islam in Deutschland"',
      content: 'Unser Workshop für Jugendliche zwischen 14 und 25 Jahren war ein voller Erfolg! Über 30 Teilnehmer diskutierten Themen wie Identität, gesellschaftliche Teilhabe und den Umgang mit Vorurteilen. Wir danken allen Referenten und Teilnehmern für einen produktiven Nachmittag.',
      category: "youth",
      visibility: "public",
      status: "published",
      pinned: false,
      daysBack: 7,
    },
    {
      title: "Gemeinde-Newsletter",
      content: "Liebe Gemeindemitglieder, in diesem Monat berichten wir über die Fortschritte bei der Waschraum-Renovierung, kommende Veranstaltungen und die Ergebnisse unserer letzten Mitgliederversammlung. Wir freuen uns über das wachsende Engagement in unserer Gemeinde.",
      category: "general",
      visibility: "members",
      status: "published",
      pinned: false,
      daysBack: 3,
    },
    {
      title: "Einladung zum Iftar-Abend",
      content: "Wir laden herzlich zum gemeinsamen Iftar ein! Nächsten Freitag öffnen wir unsere Türen für Mitglieder und Gäste. Bitte melden Sie sich zur besseren Planung an. Wir freuen uns auf einen gemeinschaftlichen Abend mit Gebet, Essen und Gesprächen.",
      category: "event",
      visibility: "public",
      status: "published",
      pinned: false,
      daysBack: 1,
    },
    {
      title: "Ankündigung: Großes Gemeindefest",
      content: "Wir planen unser diesjähriges Gemeindefest mit einem vielfältigen Programm für alle Altersgruppen. Details werden in Kürze bekannt gegeben. Vormerken: Kinderprogramm, Basare, Vorträge und gemeinsames Essen.",
      category: "announcement",
      visibility: "public",
      status: "draft",
      pinned: false,
      daysBack: 0,
    },
  ];

  for (const p of posts) {
    const { created } = await findOrCreate(
      "posts",
      `mosque_id = "${MOSQUE_ID}" && title = "${p.title}"`,
      {
        mosque_id: MOSQUE_ID,
        title: p.title,
        content: p.content,
        category: p.category,
        visibility: p.visibility,
        status: p.status,
        pinned: p.pinned,
        published_at: p.status === "published" ? isoDateTime(daysAgo(p.daysBack)) : "",
        created_by: adminId,
      }
    );
    console.log(created ? `  ✅ ${p.title}` : `  ⏭️  ${p.title}`);
  }
  console.log();
}

async function seedEvents(adminId) {
  console.log("📅 Veranstaltungen...");
  const addHours = (d, h) => new Date(d.getTime() + h * 3600000);

  const events = [
    {
      title: "Freitagsgebet — vorletzter Freitag",
      description: "Wöchentliches Freitagsgebet mit Khutba. Alle Gemeindemitglieder und Gäste sind herzlich willkommen.",
      category: "other", visibility: "public", capacity: 0, daysOff: -14,
      durationH: 1.5, location: "Hauptgebetsraum",
    },
    {
      title: "Ramadan-Abschlussfeier",
      description: "Gemeinsame Feier zum Ende des Ramadan mit Leckereien, Vorträgen und einem besonderen Programm für Kinder.",
      category: "community", visibility: "public", capacity: 100, daysOff: -21,
      durationH: 3, location: "Gemeinschaftssaal",
    },
    {
      title: "Arabisch-Intensivkurs",
      description: "Eintägiger Intensivkurs Arabisch für Anfänger. Bitte bringen Sie Schreibmaterial mit.",
      category: "lecture", visibility: "public", capacity: 20, daysOff: -10,
      durationH: 5, location: "Seminarraum",
    },
    {
      title: "Freitagsgebet — letzter Freitag",
      description: "Wöchentliches Freitagsgebet mit Khutba. Alle Gemeindemitglieder und Gäste sind herzlich willkommen.",
      category: "other", visibility: "public", capacity: 0, daysOff: -7,
      durationH: 1.5, location: "Hauptgebetsraum",
    },
    {
      title: "Jugend-Ausflug Kletterpark",
      description: "Gemeinsamer Ausflug der Jugendgruppe in den Kletterpark. Anmeldung erforderlich. Für Mitglieder zwischen 12 und 25 Jahren.",
      category: "youth", visibility: "members", capacity: 30, daysOff: -5,
      durationH: 4, location: "Kletterpark Berlin-Mitte",
    },
    {
      title: "Familientag der Gemeinde",
      description: "Großer Familientag mit Kinderprogramm, Hüpfburg, Basarständen und gemeinsamem Mittagessen. Für die ganze Familie!",
      category: "community", visibility: "public", capacity: 80, daysOff: 1,
      durationH: 5, location: "Gemeinschaftssaal und Innenhof",
    },
    {
      title: "Freitagsgebet — nächste Woche",
      description: "Wöchentliches Freitagsgebet mit Khutba. Alle Gemeindemitglieder und Gäste sind herzlich willkommen.",
      category: "other", visibility: "public", capacity: 0, daysOff: 3,
      durationH: 1.5, location: "Hauptgebetsraum",
    },
    {
      title: "Vorlesung: Geschichte des Islam",
      description: "Wissenschaftlicher Vortrag über die Geschichte des Islam von den Anfängen bis zur Gegenwart. Für alle Altersgruppen geeignet.",
      category: "lecture", visibility: "public", capacity: 50, daysOff: 5,
      durationH: 2, location: "Hauptgebetsraum",
    },
    {
      title: "Spendenabend: Neue Waschräume",
      description: "Gemeinsamer Abend zur Unterstützung der Waschraum-Renovierung. Mit Vorträgen, Spendenaufruf und gemeinsamem Abendessen. Jede Hilfe zählt!",
      category: "community", visibility: "public", capacity: 60, daysOff: 8,
      durationH: 2.5, location: "Gemeinschaftssaal",
    },
    {
      title: "Madrasa Elternsprechtag",
      description: "Elternsprechtag der Madrasa. Bitte vereinbaren Sie vorab einen Termin mit dem jeweiligen Lehrer.",
      category: "other", visibility: "members", capacity: 0, daysOff: 12,
      durationH: 3, location: "Unterrichtsräume",
    },
    {
      title: "Sommerfest der Gemeinde",
      description: "Unser großes Sommerfest mit Musik, Essen, Spielen und einem besonderen Abendprogramm. Für Mitglieder und deren Gäste.",
      category: "community", visibility: "public", capacity: 200, daysOff: 21,
      durationH: 6, location: "Gemeinschaftssaal und Garten",
    },
    {
      title: "Benefizauktion für die Renovierung",
      description: "Benefizauktion mit gespendeten Gegenständen und Erfahrungen. Alle Einnahmen fließen direkt in die Renovierung unserer Gemeinderäume.",
      category: "community", visibility: "public", capacity: 0, daysOff: 35,
      durationH: 3, location: "Hauptgebetsraum",
    },
  ];

  const eventIds = [];
  for (const e of events) {
    const startDate = e.daysOff >= 0 ? daysFromNow(e.daysOff) : daysAgo(-e.daysOff);
    startDate.setHours(e.daysOff < 0 ? 19 : 14, 0, 0, 0); // vergangene = 19 Uhr, zukünftige = 14 Uhr
    if (e.category === "other") startDate.setHours(12, 30, 0, 0); // Freitagsgebet = 12:30

    const endDate = addHours(startDate, e.durationH);
    const { record, created } = await findOrCreate(
      "events",
      `mosque_id = "${MOSQUE_ID}" && title = "${e.title}"`,
      {
        mosque_id: MOSQUE_ID,
        title: e.title,
        description: e.description,
        category: e.category,
        location_name: e.location,
        start_at: isoDateTime(startDate),
        end_at: isoDateTime(endDate),
        duration_minutes: Math.round(e.durationH * 60),
        visibility: e.visibility,
        capacity: e.capacity,
        status: e.title.includes("Benefizauktion") ? "draft" : "published",
        is_recurring: false,
        created_by: adminId,
      }
    );
    console.log(created ? `  ✅ ${e.title}` : `  ⏭️  ${e.title}`);
    eventIds.push({ id: record.id, ...e });
  }
  console.log();
  return eventIds;
}

async function seedEventRegistrations(events, memberIds) {
  console.log("👤 Veranstaltungsteilnahmen...");

  // Gäste-Pool
  const GUESTS = [
    { name: "Petra Müller",       email: "petra.mueller@gmail.com" },
    { name: "Lars Hansen",        email: "lars.hansen@web.de" },
    { name: "Amir Souza",         email: "asouza@hotmail.com" },
    { name: "Ingrid Köhler",      email: "ingrid.koehler@t-online.de" },
    { name: "Kareem Nasser",      email: "k.nasser@gmx.de" },
    { name: "Claudia Braun",      email: "c.braun@yahoo.de" },
    { name: "Tobias Richter",     email: "t.richter@outlook.com" },
    { name: "Samira Boulou",      email: "s.boulou@gmail.com" },
    { name: "Michael Seifert",    email: "m.seifert@web.de" },
    { name: "Fatou Diallo",       email: "f.diallo@gmail.com" },
    { name: "Georg Werner",       email: "g.werner@t-online.de" },
    { name: "Nadia Hamdan",       email: "n.hamdan@gmx.de" },
    { name: "Familie Schreiber",  email: "schreiber.family@yahoo.de" },
    { name: "Yilmaz Ailesinden", email: "yilmaz.aile@hotmail.com" },
    { name: "René Hoffmann",      email: "r.hoffmann@gmail.com" },
  ];

  // Konfiguration pro Event-Typ
  const CONFIGS = {
    other:     { count: [8, 12],  memberPct: 0.8 }, // Freitagsgebet
    lecture:   { count: [15, 22], memberPct: 0.7 },
    community: { count: [25, 35], memberPct: 0.4 },
    youth:     { count: [8, 12],  memberPct: 1.0 }, // members only
    campaign:  { count: [18, 25], memberPct: 0.5 }, // Spendenabend
  };

  let totalCreated = 0;

  for (const event of events) {
    // Nur vergangene und heutige Events + einige zukünftige
    const isPast    = event.daysOff < 0;
    const isToday   = event.daysOff === 0 || event.daysOff === 1;
    const isFuture  = event.daysOff > 1;

    const configKey = event.title.includes("Spendenabend") ? "campaign"
      : event.category === "community" ? "community"
      : event.category === "youth" ? "youth"
      : event.category === "lecture" ? "lecture"
      : "other";

    const cfg = CONFIGS[configKey];
    const targetCount = isPast || isToday
      ? Math.floor(Math.random() * (cfg.count[1] - cfg.count[0] + 1)) + cfg.count[0]
      : Math.min(5, memberIds.length);

    const memberCount = Math.round(targetCount * cfg.memberPct);
    const guestCount  = targetCount - memberCount;

    // Shuffle memberIds für Variation
    const shuffled = [...memberIds].sort(() => Math.random() - 0.5).slice(0, memberCount);

    // Member-Registrierungen
    for (const userId of shuffled) {
      const regStatus = isPast
        ? (Math.random() < 0.7 ? "attended" : Math.random() < 0.5 ? "registered" : "no_show")
        : "registered";
      const regDaysAgo = isPast ? Math.abs(event.daysOff) + 2 + Math.floor(Math.random() * 5) : 1;

      const filter = `event_id="${event.id}"&&user_id="${userId}"`;
      const existing = await pbFetch(
        `collections/event_registrations/records?filter=${encodeURIComponent(filter)}&perPage=1`,
        { throwOnError: false }
      );
      if (existing?.items?.length > 0) continue;

      await pbCreate("event_registrations", {
        mosque_id: MOSQUE_ID,
        event_id: event.id,
        registrant_type: "member",
        user_id: userId,
        guest_name: "",
        guest_email: "",
        status: regStatus,
        registered_at: isoDateTime(daysAgo(regDaysAgo)),
      }).catch(() => {});
      totalCreated++;
    }

    // Gast-Registrierungen
    if (cfg.memberPct < 1.0) {
      const guestPool = [...GUESTS].sort(() => Math.random() - 0.5).slice(0, guestCount);
      for (const g of guestPool) {
        const filter = `event_id="${event.id}"&&guest_email="${g.email}"`;
        const existing = await pbFetch(
          `collections/event_registrations/records?filter=${encodeURIComponent(filter)}&perPage=1`,
          { throwOnError: false }
        );
        if (existing?.items?.length > 0) continue;

        const regStatus = isPast
          ? (Math.random() < 0.65 ? "attended" : Math.random() < 0.5 ? "registered" : "no_show")
          : "registered";
        const regDaysAgo = isPast ? Math.abs(event.daysOff) + 1 + Math.floor(Math.random() * 3) : 0;

        await pbCreate("event_registrations", {
          mosque_id: MOSQUE_ID,
          event_id: event.id,
          registrant_type: "guest",
          user_id: "",
          guest_name: g.name,
          guest_email: g.email,
          status: regStatus,
          registered_at: isoDateTime(daysAgo(regDaysAgo)),
        }).catch(() => {});
        totalCreated++;
      }
    }

    console.log(`  ✅ ${event.title} — ${memberCount} Mitglieder, ${guestCount} Gäste`);
  }
  console.log(`  → ${totalCreated} neue Registrierungen gesamt\n`);
}

async function seedCampaigns(adminId) {
  console.log("🎯 Kampagnen...");
  const campaigns = [
    {
      title: "Moschee-Renovierung 2024",
      description: "Umfassende Renovierung des Hauptgebetsraums, der Eingangshalle und der Nebenräume. Dank großzügiger Unterstützung unserer Gemeinde konnten alle Arbeiten erfolgreich abgeschlossen werden.",
      category: "construction",
      goal_amount_cents: 1500000,
      start_at: isoDateTime(daysAgo(180)),
      end_at: isoDateTime(daysAgo(30)),
      status: "completed",
    },
    {
      title: "Neue Waschräume 2025",
      description: "Unsere Waschräume sind veraltet und bedürfen dringend einer Renovierung. Ziel ist die vollständige Sanierung aller Anlagen — für mehr Komfort und Würde beim rituellen Waschen.",
      category: "maintenance",
      goal_amount_cents: 800000,
      start_at: isoDateTime(daysAgo(45)),
      end_at: isoDateTime(daysFromNow(60)),
      status: "active",
    },
    {
      title: "Kinderspielplatz Projekt",
      description: "Wir möchten unseren jüngsten Gemeindemitgliedern einen sicheren und ansprechenden Spielplatz im Innenhof der Moschee schenken. Helfen Sie uns, diesen Traum Wirklichkeit werden zu lassen!",
      category: "general",
      goal_amount_cents: 500000,
      start_at: isoDateTime(daysAgo(10)),
      end_at: isoDateTime(daysFromNow(90)),
      status: "active",
    },
  ];

  const campaignIds = [];
  for (const c of campaigns) {
    const { record, created } = await findOrCreate(
      "campaigns",
      `mosque_id = "${MOSQUE_ID}" && title = "${c.title}"`,
      { ...c, mosque_id: MOSQUE_ID, currency: "EUR", created_by: adminId }
    );
    console.log(created ? `  ✅ ${c.title}` : `  ⏭️  ${c.title}`);
    campaignIds.push(record.id);
  }
  console.log();
  return campaignIds;
}

async function seedDonations(campaignIds, memberIds) {
  console.log("💰 Spenden (löschen + neu erstellen)...");
  const deleted = await deleteAllForMosque("donations");
  if (deleted > 0) console.log(`  🗑️  ${deleted} alte Spenden gelöscht`);

  const AMOUNTS = [500, 1000, 2500, 5000, 10000];
  const PROVIDERS = ["manual", "stripe", "paypal_link"];

  // Kampagne 1: abgeschlossen, ~110 % (~1.650.000 Ct.)
  // Kampagne 2: aktiv, ~60 % (~480.000 Ct.) — Story: Waschräume
  // Kampagne 3: neu, ~10 % (~50.000 Ct.)
  const donationSets = [
    {
      campaignId: campaignIds[0],
      count: 15,
      rangeAgo: [180, 32],
      amounts: [10000, 25000, 50000, 100000, 5000, 50000, 25000, 10000, 100000, 50000, 25000, 50000, 100000, 25000, 50000],
    },
    {
      campaignId: campaignIds[1],
      count: 12,
      rangeAgo: [40, 2],
      amounts: [25000, 10000, 50000, 5000, 25000, 50000, 10000, 25000, 100000, 25000, 5000, 50000],
    },
    {
      campaignId: campaignIds[2],
      count: 5,
      rangeAgo: [9, 1],
      amounts: [10000, 5000, 25000, 5000, 10000],
    },
  ];

  let totalDonations = 0;
  for (const set of donationSets) {
    const items = [];
    for (let i = 0; i < set.count; i++) {
      const isMember = i % 3 === 0 && memberIds.length > 0; // ~33 % members
      const guestIdx = (i * 7) % GUEST_DONORS.length;
      const memberIdx = (i * 3) % memberIds.length;
      const daysBackOff = set.rangeAgo[0] - Math.floor((set.rangeAgo[0] - set.rangeAgo[1]) * i / (set.count - 1));
      const paidAt = isoDateTime(daysAgo(daysBackOff));

      items.push({
        mosque_id: MOSQUE_ID,
        campaign_id: set.campaignId,
        donor_type: isMember ? "member" : "guest",
        user_id: isMember ? memberIds[memberIdx] : "",
        donor_name: isMember
          ? MEMBER_DATA[memberIdx % MEMBER_DATA.length].first + " " + MEMBER_DATA[memberIdx % MEMBER_DATA.length].last
          : GUEST_DONORS[guestIdx].name,
        donor_email: isMember
          ? `demo-member-${String(memberIdx + 1).padStart(2, "0")}@moschee.app`
          : GUEST_DONORS[guestIdx].email,
        amount_cents: set.amounts[i],
        amount: set.amounts[i] / 100,
        currency: "EUR",
        is_recurring: false,
        provider: PROVIDERS[i % PROVIDERS.length],
        provider_ref: "",
        status: "paid",
        paid_at: paidAt,
      });
    }
    await batchCreate("donations", items, 10);
    totalDonations += items.length;
    const total = items.reduce((s, d) => s + d.amount_cents, 0);
    console.log(`  ✅ ${items.length} Spenden, gesamt: ${(total / 100).toFixed(2)} €`);
  }
  console.log(`  → ${totalDonations} Spenden gesamt\n`);
}

// ─── 5. Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 seed-demo-full.mjs gestartet");
  console.log("   PocketBase: " + PB_URL);
  console.log("   Moschee-ID: " + MOSQUE_ID);
  console.log("   Passwort:   " + DEMO_PASSWORD + "\n");

  await authenticate();
  await verifyMosque();

  const users       = await seedUsers();
  await seedTeamMembers();
  const yearIds     = await seedAcademicYears();
  const courseIds   = await seedCourses(yearIds, users);
  const studentIds  = await seedStudents();
  await seedEnrollments(courseIds, studentIds);
  await seedAttendance(courseIds, studentIds, users.teacher1);
  await seedStudentFees(studentIds, users.admin);
  await seedPosts(users.admin);
  const events      = await seedEvents(users.admin);
  await seedEventRegistrations(events, users.memberIds);
  const campaignIds = await seedCampaigns(users.admin);
  await seedDonations(campaignIds, users.memberIds);

  console.log("✅ Demo-Seed abgeschlossen!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 Moschee-ID: " + MOSQUE_ID);
  console.log("🔑 Passwort aller Demo-Accounts: " + DEMO_PASSWORD);
  console.log("");
  console.log("📧 Accounts:");
  console.log("   Admin:     demo-admin@moschee.app");
  console.log("   Imam:      demo-imam@moschee.app  /  demo-imam2@moschee.app");
  console.log("   Lehrer:    demo-teacher@moschee.app  /  demo-teacher2  /  demo-teacher3");
  console.log("   Mitglieder: demo-member-01@moschee.app … demo-member-20@moschee.app");
  console.log("");
  console.log("📊 Erstellt:");
  console.log("   👥  25 Benutzer (1 Admin, 2 Imame, 3 Lehrer, 20 Mitglieder)");
  console.log("   🏅  6 Team-Mitglieder");
  console.log(`   📅  2 Schuljahre (${ARCHIVED_YEAR_NAME} + ${ACTIVE_YEAR_NAME}), 5 Kurse`);
  console.log("   🧒  20 Schüler, Einschreibungen, Anwesenheiten, Gebühren");
  console.log("   📝  9 Beiträge");
  console.log("   📅  12 Veranstaltungen + Teilnahmen");
  console.log("   💰  3 Kampagnen + ~32 Spenden");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((err) => {
  console.error("\n❌ Fehler:", err.message);
  console.error(err.stack);
  process.exit(1);
});
