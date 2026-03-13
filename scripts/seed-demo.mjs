#!/usr/bin/env node
// Demo-Seed Script
// Verwendung: node scripts/seed-demo.mjs <pb-url> <admin-email> <admin-password>
// Beispiel:   node scripts/seed-demo.mjs http://91.98.142.128:8090 admin@example.com secret
//
// Nach dem Ausführen: NEXT_PUBLIC_DEMO_MOSQUE_ID=<id> in .env.local eintragen.

const PB_URL = process.argv[2] || "http://91.98.142.128:8090";
const ADMIN_EMAIL = process.argv[3];
const ADMIN_PASSWORD = process.argv[4];

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Verwendung: node scripts/seed-demo.mjs <pb-url> <admin-email> <admin-password>");
  process.exit(1);
}

const DEMO_SLUG = "demo";
const DEMO_PASSWORD = "Demo1234!";
let authToken = "";

// --- API Helper ---

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
    throw new Error("PB " + res.status + ": " + JSON.stringify(json));
  }
  return json;
}

async function authenticate() {
  console.log("🔐 Authentifiziere...");
  const data = await pbFetch("admins/auth-with-password", {
    method: "POST",
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    throwOnError: false,
  });
  if (!data.token) {
    const data2 = await pbFetch("collections/users/auth-with-password", {
      method: "POST",
      body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    authToken = data2.token;
  } else {
    authToken = data.token;
  }
  console.log("✅ Authentifiziert");
}

async function findOrCreate(collection, filter, createData) {
  try {
    const result = await pbFetch(
      "collections/" + collection + "/records?filter=" + encodeURIComponent(filter) + "&perPage=1"
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

// --- Seed Functions ---

async function seedMosque() {
  console.log("\n🕌 Demo-Moschee...");
  const { record, created } = await findOrCreate("mosques", "slug = " + JSON.stringify(DEMO_SLUG), {
    name: "Demo-Gemeinde",
    slug: DEMO_SLUG,
    description: "Demonstration des Moschee-Portals moschee.app.",
    city: "Berlin",
    address: "Musterstraße 1, 10115 Berlin",
    email: "info@demo.moschee.app",
    phone: "+49 30 123456",
    latitude: 52.5244,
    longitude: 13.4105,
    timezone: "Europe/Berlin",
    brand_primary_color: "#059669",
    public_enabled: true,
  });
  console.log(created ? "  ✅ Erstellt: " + record.id : "  ⏭️  Existiert: " + record.id);
  return record;
}

async function seedSettings(mosqueId) {
  console.log("\n⚙️  Settings...");
  const { created } = await findOrCreate("settings", "mosque_id = " + JSON.stringify(mosqueId), {
    mosque_id: mosqueId,
    prayer_provider: "aladhan",
    prayer_method: 13,
    madrasa_enabled: true,
    madrasa_fees_enabled: true,
    madrasa_default_fee_cents: 1500,
    donation_enabled: true,
    events_enabled: true,
    posts_enabled: true,
  });
  console.log(created ? "  ✅ Erstellt" : "  ⏭️  Existiert");
}

async function seedUser(mosqueId, email, firstName, lastName, role, memberNo) {
  console.log("\n👤 " + email + "...");
  const { record, created } = await findOrCreate("users", "email = " + JSON.stringify(email), {
    email,
    password: DEMO_PASSWORD,
    passwordConfirm: DEMO_PASSWORD,
    emailVisibility: true,
    first_name: firstName,
    last_name: lastName,
    full_name: firstName + " " + lastName,
    membership_number: memberNo,
    member_no: memberNo,
    mosque_id: mosqueId,
    role,
    status: "active",
  });
  console.log(created ? "  ✅ Erstellt: " + record.id : "  ⏭️  Existiert: " + record.id);
  return record;
}

async function seedAcademicYear(mosqueId) {
  console.log("\n📅 Schuljahr...");
  const { record, created } = await findOrCreate(
    "academic_years",
    "mosque_id = " + JSON.stringify(mosqueId) + " && name = " + JSON.stringify("2024/2025"),
    { mosque_id: mosqueId, name: "2024/2025", start_date: "2024-09-01", end_date: "2025-06-30", status: "active" }
  );
  console.log(created ? "  ✅ Erstellt" : "  ⏭️  Existiert");
  return record;
}

async function seedCourse(mosqueId, academicYearId, teacherId) {
  console.log("\n📚 Kurs...");
  const { record, created } = await findOrCreate(
    "courses",
    "mosque_id = " + JSON.stringify(mosqueId) + " && title = " + JSON.stringify("Quran-Grundkurs"),
    {
      mosque_id: mosqueId,
      title: "Quran-Grundkurs",
      description: "Einführung in die Quran-Rezitation für Anfänger.",
      category: "quran",
      level: "beginner",
      academic_year_id: academicYearId,
      teacher_id: teacherId,
      day_of_week: "saturday",
      start_time: "10:00",
      end_time: "12:00",
      location_name: "Klassenraum",
      max_students: 20,
      status: "active",
      created_by: teacherId,
    }
  );
  console.log(created ? "  ✅ Erstellt: " + record.id : "  ⏭️  Existiert: " + record.id);
  return record;
}

async function seedEnrollments(mosqueId, courseId) {
  console.log("\n📋 Kurseinschreibungen...");
  const result = await pbFetch(
    "collections/students/records?filter=" + encodeURIComponent("mosque_id = \"" + mosqueId + "\"") + "&perPage=50"
  );
  const students = result.items || [];
  if (students.length === 0) {
    console.log("  ⚠️  Keine Schüler gefunden");
    return;
  }
  for (const student of students) {
    const { created } = await findOrCreate(
      "course_enrollments",
      "student_id = \"" + student.id + "\" && course_id = \"" + courseId + "\"",
      {
        mosque_id: mosqueId,
        course_id: courseId,
        student_id: student.id,
        status: "enrolled",
        enrolled_at: new Date().toISOString(),
      }
    );
    console.log(created ? "  ✅ " + student.first_name + " " + student.last_name : "  ⏭️  " + student.first_name + " " + student.last_name);
  }
}

async function seedStudents(mosqueId, parentId) {
  console.log("\n🧒 Schüler...");
  const students = [
    { first_name: "Ahmed", last_name: "Yilmaz", gender: "male", date_of_birth: "2015-03-12" },
    { first_name: "Fatima", last_name: "Al-Hassan", gender: "female", date_of_birth: "2014-07-20" },
    { first_name: "Ibrahim", last_name: "Demir", gender: "male", date_of_birth: "2016-01-05" },
    { first_name: "Meryem", last_name: "Arslan", gender: "female", date_of_birth: "2013-11-18" },
    { first_name: "Yusuf", last_name: "Kaya", gender: "male", date_of_birth: "2015-09-30" },
  ];
  for (const s of students) {
    const { created } = await findOrCreate(
      "students",
      "mosque_id = " + JSON.stringify(mosqueId) + " && first_name = " + JSON.stringify(s.first_name) + " && last_name = " + JSON.stringify(s.last_name),
      { ...s, mosque_id: mosqueId, parent_id: parentId, parent_name: "Demo Elternteil", parent_phone: "+49 170 1234567", status: "active" }
    );
    console.log(created ? "  ✅ " + s.first_name + " " + s.last_name : "  ⏭️  " + s.first_name + " " + s.last_name);
  }
}

async function seedEvents(mosqueId, userId) {
  console.log("\n📅 Veranstaltungen...");
  const now = new Date();
  const fmt = (d) => d.toISOString().replace("T", " ").substring(0, 19);
  const days = (n) => new Date(now.getTime() + n * 86400000);
  const events = [
    {
      title: "Freitagsgebet & Khutba",
      description: "Wöchentliches Freitagsgebet mit Khutba.",
      category: "other",
      start_at: fmt(days(7)),
      location_name: "Hauptgebetsraum",
      visibility: "public",
      status: "published",
      is_recurring: true,
      recurrence_type: "weekly",
      recurrence_day_of_week: "friday",
    },
    {
      title: "Arabisch-Kurs für Erwachsene",
      description: "Arabisch-Kurs für Anfänger und Fortgeschrittene.",
      category: "lecture",
      start_at: fmt(days(3)),
      end_at: fmt(new Date(days(3).getTime() + 5400000)),
      location_name: "Seminarraum 1",
      visibility: "public",
      status: "published",
      capacity: 20,
    },
    {
      title: "Iftar-Abend",
      description: "Gemeinsames Fastenbrechen für alle Gemeindemitglieder und Gäste.",
      category: "community",
      start_at: fmt(days(14)),
      end_at: fmt(new Date(days(14).getTime() + 10800000)),
      location_name: "Gemeinschaftsraum",
      visibility: "public",
      status: "published",
      capacity: 80,
    },
    {
      title: "Jugend-Treff",
      description: "Monatliches Treffen der Jugendgruppe.",
      category: "youth",
      start_at: fmt(days(10)),
      location_name: "Jugendraum",
      visibility: "members",
      status: "published",
    },
    {
      title: "Spendenauktion für Renovierung",
      description: "Benefizauktion zur Unterstützung der Renovierungsarbeiten.",
      category: "community",
      start_at: fmt(days(21)),
      location_name: "Hauptsaal",
      visibility: "public",
      status: "draft",
    },
  ];
  for (const e of events) {
    const { created } = await findOrCreate(
      "events",
      "mosque_id = " + JSON.stringify(mosqueId) + " && title = " + JSON.stringify(e.title),
      { ...e, mosque_id: mosqueId, created_by: userId }
    );
    console.log(created ? "  ✅ " + e.title : "  ⏭️  " + e.title);
  }
}

async function seedPosts(mosqueId, userId) {
  console.log("\n📝 Beiträge...");
  const posts = [
    {
      title: "Willkommen bei der Demo-Gemeinde",
      content: "Dies ist eine Demonstration von moschee.app. Alle Funktionen können hier ausprobiert werden.",
      category: "announcement",
      visibility: "public",
      status: "published",
      pinned: true,
    },
    {
      title: "Ramadan 2025 — Gebetszeiten",
      content: "Die Gebetszeiten für den heiligen Monat Ramadan wurden aktualisiert.",
      category: "announcement",
      visibility: "public",
      status: "published",
    },
    {
      title: "Neue Arabisch-Kurse ab September",
      content: "Wir freuen uns, neue Arabisch-Kurse für alle Altersgruppen anzukündigen.",
      category: "general",
      visibility: "public",
      status: "published",
    },
    {
      title: "Gemeinde-Newsletter März 2025",
      content: "Neuigkeiten aus unserer Gemeinde für März 2025.",
      category: "general",
      visibility: "members",
      status: "published",
    },
    {
      title: "Renovierungsarbeiten — Update",
      content: "Die Renovierungsarbeiten schreiten gut voran. Danke für Ihre Unterstützung.",
      category: "announcement",
      visibility: "public",
      status: "draft",
    },
  ];
  for (const p of posts) {
    const { created } = await findOrCreate(
      "posts",
      "mosque_id = " + JSON.stringify(mosqueId) + " && title = " + JSON.stringify(p.title),
      { ...p, mosque_id: mosqueId, created_by: userId, published_at: p.status === "published" ? new Date().toISOString() : "" }
    );
    console.log(created ? "  ✅ " + p.title : "  ⏭️  " + p.title);
  }
}

async function seedCampaign(mosqueId, userId) {
  console.log("\n🎯 Kampagne...");
  const { record, created } = await findOrCreate(
    "campaigns",
    "mosque_id = " + JSON.stringify(mosqueId) + " && title = " + JSON.stringify("Moschee-Renovierung 2025"),
    {
      mosque_id: mosqueId,
      title: "Moschee-Renovierung 2025",
      description: "Spenden für die Renovierung von Gebetsraum, Waschräumen und Eingangshalle.",
      goal_amount_cents: 5000000,
      currency: "EUR",
      status: "active",
      category: "construction",
      type: "general",
      visibility: "public",
      created_by: userId,
    }
  );
  console.log(created ? "  ✅ Erstellt" : "  ⏭️  Existiert");

  // Spenden idempotent anlegen: prüfen ob bereits Spenden für diese Kampagne existieren
  const existingDonations = await pbFetch(
    "collections/donations/records?filter=" +
      encodeURIComponent("campaign_id = \"" + record.id + "\"") +
      "&perPage=1",
    { throwOnError: false }
  );
  const hasDonations = existingDonations?.items?.length > 0;

  if (!hasDonations) {
    for (const amount of [500, 250, 1000]) {
      await pbFetch("collections/donations/records", {
        method: "POST",
        body: JSON.stringify({
          amount,
          amount_cents: amount * 100,
          mosque_id: mosqueId,
          campaign_id: record.id,
          category: "moschee_bau",
          payment_method: "cash",
          status: "paid",
          donor_name: "Demo-Spender",
          created_by: userId,
        }),
      }).catch((e) => console.warn("  ⚠️  Spende übersprungen:", e.message));
    }
    console.log("  ✅ 3 Beispiel-Spenden (1.750 EUR)");
  } else {
    console.log("  ⏭️  Spenden bereits vorhanden");
  }
}

// --- Main ---

async function main() {
  console.log("🌱 Demo-Seed gestartet");
  console.log("   PocketBase: " + PB_URL);
  console.log("   Demo-Passwort: " + DEMO_PASSWORD + "\n");

  await authenticate();
  const mosque = await seedMosque();
  const mosqueId = mosque.id;
  await seedSettings(mosqueId);
  const admin = await seedUser(mosqueId, "demo-admin@moschee.app", "Admin", "Demo", "admin", "DEMO-001");
  const teacher = await seedUser(mosqueId, "demo-teacher@moschee.app", "Lehrer", "Demo", "teacher", "DEMO-002");
  const member = await seedUser(mosqueId, "demo-member@moschee.app", "Mitglied", "Demo", "member", "DEMO-003");
  const year = await seedAcademicYear(mosqueId);
  const course = await seedCourse(mosqueId, year.id, teacher.id);
  await seedStudents(mosqueId, member.id);
  await seedEnrollments(mosqueId, course.id);
  await seedEvents(mosqueId, admin.id);
  await seedPosts(mosqueId, admin.id);
  await seedCampaign(mosqueId, admin.id);

  console.log("\n✅ Seed abgeschlossen!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 In .env.local eintragen:");
  console.log("   NEXT_PUBLIC_DEMO_MOSQUE_ID=" + mosqueId);
  console.log("\n📋 Demo-Accounts (Passwort: Demo1234!):");
  console.log("   Admin:    demo-admin@moschee.app");
  console.log("   Lehrer:   demo-teacher@moschee.app");
  console.log("   Mitglied: demo-member@moschee.app");
  console.log("\n📋 Portal-URL: /" + DEMO_SLUG);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((err) => {
  console.error("\n❌ Fehler:", err.message);
  process.exit(1);
});
