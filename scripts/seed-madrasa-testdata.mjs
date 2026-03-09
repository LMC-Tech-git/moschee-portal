/**
 * Madrasa Testdaten - Seed Script
 * Legt an: Lehrerin, Schuljahr, Kurs, 10 Schüler, 5 Sitzungen, Anwesenheiten, Gebühren
 *
 * Nutzung: node scripts/seed-madrasa-testdata.mjs <PB_URL> <ADMIN_EMAIL> <ADMIN_PASSWORD>
 */

const [, , PB_URL, ADMIN_EMAIL, ADMIN_PASSWORD] = process.argv;

if (!PB_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Nutzung: node scripts/seed-madrasa-testdata.mjs <PB_URL> <ADMIN_EMAIL> <ADMIN_PASSWORD>");
  process.exit(1);
}

const MOSQUE_ID = "43xvclzp4v1cija";

// ──────────────────────────────────────────────
// Hilfsfunktionen
// ──────────────────────────────────────────────

async function pbRequest(path, method = "GET", body = null, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = token;
  const res = await fetch(`${PB_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`PB ${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}

function buildFilterUrl(collection, filter, extra = "") {
  return `/api/collections/${collection}/records?filter=${encodeURIComponent(filter)}&perPage=1${extra}`;
}

async function findOne(collection, filter, token) {
  try {
    const url = buildFilterUrl(collection, filter);
    const res = await pbRequest(url, "GET", null, token);
    if (res.items && res.items.length > 0) return res.items[0];
  } catch (_) {}
  return null;
}

function log(msg) { console.log(`  ${msg}`); }
function ok(msg)  { console.log(`  ✅ ${msg}`); }
function info(msg){ console.log(`\n--- ${msg} ---`); }

// ──────────────────────────────────────────────
// Authentifizierung
// ──────────────────────────────────────────────

console.log("\n=== Madrasa Testdaten Seed ===\n");
console.log(`PocketBase: ${PB_URL}`);

log("Authentifiziere als Admin...");
const authData = await pbRequest("/api/admins/auth-with-password", "POST", {
  identity: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
});
const TOKEN = `Admin ${authData.token}`;
ok("Authentifiziert");

// ──────────────────────────────────────────────
// 1. Lehrerin anlegen (yasemin@lehrer.de)
// ──────────────────────────────────────────────

info("Lehrerin anlegen");

let teacherId;
{
  // Suche per List-API und filter in JS (sicherer als URL-encoded filter mit Sonderzeichen)
  try {
    const res = await pbRequest("/api/collections/users/records?perPage=200&sort=created", "GET", null, TOKEN);
    const found = (res.items || []).find((u) => u.email === "yasemin@lehrer.de");
    if (found) {
      teacherId = found.id;
      log(`Lehrerin existiert bereits → ID: ${teacherId}`);
    }
  } catch (e) {
    log(`Warnung beim Suchen der Lehrerin: ${e.message}`);
  }
}

if (!teacherId) {
  try {
    const teacher = await pbRequest("/api/collections/users/records", "POST", {
      email: "yasemin@lehrer.de",
      password: "Lehrer1234!",
      passwordConfirm: "Lehrer1234!",
      name: "Yasemin Demir",
      role: "teacher",
      mosque_id: MOSQUE_ID,
      membership_number: "L-001",
      emailVisibility: true,
      verified: true,
    }, TOKEN);
    teacherId = teacher.id;
    ok(`Lehrerin angelegt → ID: ${teacherId}`);
  } catch (e) {
    // Falls "email already in use" → nochmals per ID suchen
    if (e.message.includes("already in use") || e.message.includes("invalid_email")) {
      log("E-Mail bereits vergeben – suche bestehenden Account...");
      const res = await pbRequest("/api/collections/users/records?perPage=500&sort=created", "GET", null, TOKEN);
      const found = (res.items || []).find((u) => u.email === "yasemin@lehrer.de");
      if (found) {
        teacherId = found.id;
        ok(`Lehrerin gefunden → ID: ${teacherId}`);
      } else {
        throw new Error("Lehrerin konnte weder erstellt noch gefunden werden.");
      }
    } else {
      throw e;
    }
  }
}

// ──────────────────────────────────────────────
// 2. Schuljahr anlegen
// ──────────────────────────────────────────────

info("Schuljahr anlegen");

let yearId;
{
  const existing = await findOne("academic_years", `mosque_id='${MOSQUE_ID}'&&name='2024/25'`, TOKEN);
  if (existing) {
    yearId = existing.id;
    log(`Schuljahr 2024/25 existiert bereits → ID: ${yearId}`);
  }
}

if (!yearId) {
  const year = await pbRequest("/api/collections/academic_years/records", "POST", {
    mosque_id: MOSQUE_ID,
    name: "2024/25",
    start_date: "2024-09-01",
    end_date: "2025-07-31",
    status: "active",
  }, TOKEN);
  yearId = year.id;
  ok(`Schuljahr 2024/25 angelegt → ID: ${yearId}`);
}

// ──────────────────────────────────────────────
// 3. Kurs anlegen
// ──────────────────────────────────────────────

info("Kurs anlegen");

let courseId;
{
  const existing = await findOne("courses", `mosque_id='${MOSQUE_ID}'&&academic_year_id='${yearId}'&&title='Quran für Anfänger'`, TOKEN);
  if (existing) {
    courseId = existing.id;
    log(`Kurs existiert bereits → ID: ${courseId}`);
  }
}

if (!courseId) {
  const course = await pbRequest("/api/collections/courses/records", "POST", {
    mosque_id: MOSQUE_ID,
    academic_year_id: yearId,
    title: "Quran für Anfänger",
    description: "Grundlagen des Quranlesens für Kinder im Grundschulalter. Schwerpunkt: Buchstaben, Harakat und erste Suren.",
    category: "quran",
    level: "beginner",
    teacher_id: teacherId,
    day_of_week: "saturday",
    start_time: "10:00",
    end_time: "11:30",
    location_name: "Unterrichtsraum 1",
    max_students: 20,
    status: "active",
    created_by: teacherId,
  }, TOKEN);
  courseId = course.id;
  ok(`Kurs "Quran für Anfänger" angelegt → ID: ${courseId}`);
}

// ──────────────────────────────────────────────
// 4. Schüler anlegen (10 Stück)
// ──────────────────────────────────────────────

info("Schüler anlegen");

const STUDENTS_DATA = [
  { first_name: "Fatima",  last_name: "Yilmaz",  date_of_birth: "2015-03-15", gender: "female", parent_name: "Ayse Yilmaz",   parent_phone: "0151-11223344" },
  { first_name: "Musa",    last_name: "Kaya",     date_of_birth: "2014-06-20", gender: "male",   parent_name: "Ahmet Kaya",     parent_phone: "0152-22334455" },
  { first_name: "Elif",    last_name: "Demir",    date_of_birth: "2015-09-10", gender: "female", parent_name: "Hatice Demir",   parent_phone: "0153-33445566" },
  { first_name: "Ibrahim", last_name: "Celik",    date_of_birth: "2013-11-05", gender: "male",   parent_name: "Mustafa Celik",  parent_phone: "0154-44556677" },
  { first_name: "Zeynep",  last_name: "Arslan",   date_of_birth: "2016-02-28", gender: "female", parent_name: "Fatma Arslan",   parent_phone: "0155-55667788" },
  { first_name: "Ali",     last_name: "Sahin",    date_of_birth: "2014-07-12", gender: "male",   parent_name: "Mehmet Sahin",   parent_phone: "0156-66778899" },
  { first_name: "Hatice",  last_name: "Ozturk",   date_of_birth: "2015-04-22", gender: "female", parent_name: "Nalan Ozturk",   parent_phone: "0157-77889900" },
  { first_name: "Yusuf",   last_name: "Kurt",     date_of_birth: "2013-08-30", gender: "male",   parent_name: "Kemal Kurt",     parent_phone: "0158-88990011" },
  { first_name: "Merve",   last_name: "Aydin",    date_of_birth: "2016-01-14", gender: "female", parent_name: "Selin Aydin",    parent_phone: "0159-99001122" },
  { first_name: "Osman",   last_name: "Polat",    date_of_birth: "2014-10-08", gender: "male",   parent_name: "Ramazan Polat",  parent_phone: "0160-00112233" },
];

const studentIds = [];

for (const s of STUDENTS_DATA) {
  // Prüfen ob bereits vorhanden
  let sid;
  {
    const existing = await findOne("students", `mosque_id='${MOSQUE_ID}'&&first_name='${s.first_name}'&&last_name='${s.last_name}'`, TOKEN);
    if (existing) {
      sid = existing.id;
      log(`Schüler ${s.first_name} ${s.last_name} existiert bereits → ${sid}`);
    }
  }

  if (!sid) {
    const rec = await pbRequest("/api/collections/students/records", "POST", {
      mosque_id: MOSQUE_ID,
      first_name: s.first_name,
      last_name: s.last_name,
      date_of_birth: s.date_of_birth,
      gender: s.gender,
      parent_name: s.parent_name,
      parent_phone: s.parent_phone,
      status: "active",
      notes: "",
      address: "",
      school_name: "Grundschule Ulm-Mitte",
      school_class: "",
      health_notes: "",
      mother_name: s.gender === "female" ? "" : s.parent_name,
      mother_phone: s.gender === "female" ? "" : s.parent_phone,
      father_name: s.gender === "male" ? "" : s.parent_name,
      father_phone: s.gender === "male" ? "" : s.parent_phone,
      membership_status: "none",
    }, TOKEN);
    sid = rec.id;
    ok(`Schüler ${s.first_name} ${s.last_name} angelegt → ${sid}`);
  }
  studentIds.push(sid);
}

// ──────────────────────────────────────────────
// 5. Einschreibungen
// ──────────────────────────────────────────────

info("Einschreibungen anlegen");

for (let i = 0; i < studentIds.length; i++) {
  const sid = studentIds[i];
  const name = `${STUDENTS_DATA[i].first_name} ${STUDENTS_DATA[i].last_name}`;
  {
    const existing = await findOne("course_enrollments", `mosque_id='${MOSQUE_ID}'&&course_id='${courseId}'&&student_id='${sid}'`, TOKEN);
    if (existing) { log(`${name} bereits eingeschrieben`); continue; }
  }

  await pbRequest("/api/collections/course_enrollments/records", "POST", {
    mosque_id: MOSQUE_ID,
    course_id: courseId,
    student_id: sid,
    status: "enrolled",
    enrolled_at: "2024-09-07 09:00:00.000Z",
    completed_at: "",
    notes: "",
  }, TOKEN);
  ok(`${name} eingeschrieben`);
}

// ──────────────────────────────────────────────
// 6. Sitzungen + Anwesenheiten (5 Sitzungen)
// ──────────────────────────────────────────────

info("Anwesenheiten anlegen (5 Sitzungen)");

// Anwesenheitsmuster: present, absent, late, excused
// Zeilen = Sitzungen (5), Spalten = Schüler (10)
const SESSIONS = [
  "2024-10-05",
  "2024-10-12",
  "2024-10-19",
  "2024-10-26",
  "2024-11-02",
];

// [session][student] → status
const ATTENDANCE_MATRIX = [
  //    Fatima    Musa      Elif      Ibrahim   Zeynep    Ali       Hatice    Yusuf     Merve     Osman
  ["present", "present", "late",    "present", "absent",  "present", "excused", "present", "present", "absent"],
  ["present", "absent",  "present", "present", "present", "present", "present", "absent",  "present", "absent"],
  ["present", "present", "present", "absent",  "present", "present", "present", "absent",  "late",    "present"],
  ["present", "present", "absent",  "present", "present", "late",    "present", "present", "present", "present"],
  ["absent",  "present", "present", "present", "present", "present", "absent",  "present", "present", "present"],
];

for (let si = 0; si < SESSIONS.length; si++) {
  const sessionDate = SESSIONS[si];
  log(`Session ${si + 1}: ${sessionDate}`);
  for (let ki = 0; ki < studentIds.length; ki++) {
    const sid = studentIds[ki];
    const status = ATTENDANCE_MATRIX[si][ki];

    {
      const existing = await findOne("attendance", `mosque_id='${MOSQUE_ID}'&&course_id='${courseId}'&&student_id='${sid}'&&session_date='${sessionDate}'`, TOKEN);
      if (existing) continue;
    }

    await pbRequest("/api/collections/attendance/records", "POST", {
      mosque_id: MOSQUE_ID,
      course_id: courseId,
      student_id: sid,
      session_date: sessionDate,
      status: status,
      notes: status === "excused" ? "Krankheitsbedingt entschuldigt" : status === "late" ? "Ca. 10 Min. zu spät" : "",
      marked_by: teacherId,
    }, TOKEN);
  }
  ok(`Session ${si + 1} abgeschlossen`);
}

// ──────────────────────────────────────────────
// 7. Gebühren (3 Monate, unterschiedliche Status)
// ──────────────────────────────────────────────

info("Gebühren anlegen");

// Monatliche Gebühr: 1200 Cent = 12,00 €
// Status-Muster pro Schüler (3 Monate: Okt, Nov, Dez)
// [offen, bezahlt-bar, bezahlt-überweisung, erlassen]
const MONTHS = ["2024-10", "2024-11", "2024-12"];

// Status/Betrag pro Schüler pro Monat
const FEE_PATTERNS = [
  // Fatima:   okt=paid(cash), nov=paid(cash),     dez=open
  [{ status: "paid", method: "cash", cents: 1200 }, { status: "paid", method: "cash", cents: 1200 }, { status: "open", method: "", cents: 1200 }],
  // Musa:     okt=paid(transfer), nov=open,        dez=open
  [{ status: "paid", method: "transfer", cents: 1200 }, { status: "open", method: "", cents: 1200 }, { status: "open", method: "", cents: 1200 }],
  // Elif:     okt=paid(cash), nov=paid(transfer),  dez=paid(cash)
  [{ status: "paid", method: "cash", cents: 1200 }, { status: "paid", method: "transfer", cents: 1200 }, { status: "paid", method: "cash", cents: 1200 }],
  // Ibrahim:  okt=waived,     nov=waived,           dez=open
  [{ status: "waived", method: "waived", cents: 1200 }, { status: "waived", method: "waived", cents: 1200 }, { status: "open", method: "", cents: 1200 }],
  // Zeynep:   okt=paid(cash), nov=open,             dez=open
  [{ status: "paid", method: "cash", cents: 1200 }, { status: "open", method: "", cents: 1200 }, { status: "open", method: "", cents: 1200 }],
  // Ali:      okt=paid(cash), nov=paid(cash),       dez=paid(cash)
  [{ status: "paid", method: "cash", cents: 1200 }, { status: "paid", method: "cash", cents: 1200 }, { status: "paid", method: "cash", cents: 1200 }],
  // Hatice:   okt=waived,     nov=open,             dez=open   (soziale Ermäßigung)
  [{ status: "waived", method: "waived", cents: 1200 }, { status: "open", method: "", cents: 1200 }, { status: "open", method: "", cents: 1200 }],
  // Yusuf:    okt=paid(transfer), nov=paid(transfer), dez=open
  [{ status: "paid", method: "transfer", cents: 1200 }, { status: "paid", method: "transfer", cents: 1200 }, { status: "open", method: "", cents: 1200 }],
  // Merve:    okt=open,        nov=open,             dez=open
  [{ status: "open", method: "", cents: 1200 }, { status: "open", method: "", cents: 1200 }, { status: "open", method: "", cents: 1200 }],
  // Osman:    okt=paid(cash),  nov=open,             dez=paid(cash)
  [{ status: "paid", method: "cash", cents: 1200 }, { status: "open", method: "", cents: 1200 }, { status: "paid", method: "cash", cents: 1200 }],
];

for (let ki = 0; ki < studentIds.length; ki++) {
  const sid = studentIds[ki];
  const name = `${STUDENTS_DATA[ki].first_name} ${STUDENTS_DATA[ki].last_name}`;
  for (let mi = 0; mi < MONTHS.length; mi++) {
    const monthKey = MONTHS[mi];
    const { status, method, cents } = FEE_PATTERNS[ki][mi];

    {
      const existing = await findOne("student_fees", `mosque_id='${MOSQUE_ID}'&&student_id='${sid}'&&month_key='${monthKey}'`, TOKEN);
      if (existing) { log(`${name} ${monthKey} bereits vorhanden`); continue; }
    }

    const body = {
      mosque_id: MOSQUE_ID,
      student_id: sid,
      month_key: monthKey,
      amount_cents: cents,
      status,
      payment_method: method,
      provider_ref: "",
      notes: status === "waived" ? "Soziale Ermäßigung gewährt" : "",
      created_by: teacherId,
      paid_at: status === "paid" ? `${monthKey}-15 12:00:00.000Z` : "",
    };

    await pbRequest("/api/collections/student_fees/records", "POST", body, TOKEN);
  }
  ok(`${name}: Gebühren Okt-Dez 2024 angelegt`);
}

// ──────────────────────────────────────────────
// Zusammenfassung
// ──────────────────────────────────────────────

console.log("\n=== ✅ Seed abgeschlossen ===\n");
console.log("Angelegt:");
console.log(`  🧑‍🏫 Lehrerin:   yasemin@lehrer.de (Passwort: Lehrer1234!)`);
console.log(`  📅 Schuljahr:  2024/25`);
console.log(`  📚 Kurs:       Quran für Anfänger (samstags 10:00–11:30)`);
console.log(`  👦 Schüler:    10 Kinder eingeschrieben`);
console.log(`  📋 Sitzungen:  5 (05.10.–02.11.2024) mit variierenden Anwesenheiten`);
console.log(`  💰 Gebühren:   Okt–Dez 2024 je Kind (offen/bar/überweisung/erlassen)\n`);
