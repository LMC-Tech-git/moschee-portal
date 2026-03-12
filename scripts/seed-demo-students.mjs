#!/usr/bin/env node
// Demo-Schüler Seed Script
// Legt 12 muslimische Kinder (4–6 Jahre) + 4 Parent-User in der Demo-Moschee an.
// Verwendung: node scripts/seed-demo-students.mjs <pb-url> <admin-email> <admin-password>
// Beispiel:   node scripts/seed-demo-students.mjs http://91.98.142.128:8090 admin@example.com secret

const PB_URL = process.argv[2] || "http://91.98.142.128:8090";
const ADMIN_EMAIL = process.argv[3];
const ADMIN_PASSWORD = process.argv[4];

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Verwendung: node scripts/seed-demo-students.mjs <pb-url> <admin-email> <admin-password>");
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

async function getDemoMosque() {
  console.log("\n🕌 Demo-Moschee laden...");
  const result = await pbFetch(
    "collections/mosques/records?filter=" + encodeURIComponent("slug = \"demo\"") + "&perPage=1"
  );
  if (!result.items || result.items.length === 0) {
    throw new Error("Demo-Moschee nicht gefunden! Bitte zuerst seed-demo.mjs ausführen.");
  }
  const mosque = result.items[0];
  console.log("  ✅ Gefunden: " + mosque.id + " (" + mosque.name + ")");
  return mosque;
}

async function getDemoCourse(mosqueId) {
  console.log("\n📚 Demo-Kurs laden...");
  const result = await pbFetch(
    "collections/courses/records?filter=" + encodeURIComponent("mosque_id = \"" + mosqueId + "\"") + "&perPage=1&sort=created"
  );
  if (!result.items || result.items.length === 0) {
    console.log("  ⚠️  Kein Kurs gefunden — Schüler werden angelegt, aber nicht eingeschrieben.");
    return null;
  }
  const course = result.items[0];
  console.log("  ✅ Gefunden: " + course.id + " (" + course.title + ")");
  return course;
}

async function seedParentUser(mosqueId, email, firstName, lastName, memberNo) {
  console.log("\n👤 Parent-User: " + email + "...");
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
    role: "member",
    status: "active",
  });
  console.log(created ? "  ✅ Erstellt: " + record.id : "  ⏭️  Existiert: " + record.id);
  return record;
}

async function seedStudent(mosqueId, studentData) {
  const label = studentData.first_name + " " + studentData.last_name;
  console.log("\n🧒 Schüler: " + label + "...");
  const filter =
    "mosque_id = " + JSON.stringify(mosqueId) +
    " && first_name = " + JSON.stringify(studentData.first_name) +
    " && last_name = " + JSON.stringify(studentData.last_name);
  const { record, created } = await findOrCreate("students", filter, {
    mosque_id: mosqueId,
    status: "active",
    ...studentData,
  });
  console.log(created ? "  ✅ Erstellt: " + record.id : "  ⏭️  Existiert: " + record.id);
  return record;
}

async function enrollStudent(courseId, studentId, mosqueId) {
  const filter =
    "course_id = " + JSON.stringify(courseId) +
    " && student_id = " + JSON.stringify(studentId);
  const { created } = await findOrCreate("course_enrollments", filter, {
    course_id: courseId,
    student_id: studentId,
    mosque_id: mosqueId,
    enrolled_at: new Date().toISOString().slice(0, 10),
    status: "active",
  });
  if (created) {
    console.log("    📋 Eingeschrieben");
  } else {
    console.log("    ⏭️  Bereits eingeschrieben");
  }
}

// --- Main ---

async function main() {
  try {
    await authenticate();

    const mosque = await getDemoMosque();
    const mosqueId = mosque.id;

    const course = await getDemoCourse(mosqueId);

    // 4 Parent-User anlegen
    console.log("\n\n=== Parent-User ===");
    const parent1 = await seedParentUser(mosqueId, "demo-parent1@moschee.app", "Mehmet", "Yılmaz", "P-001");
    const parent2 = await seedParentUser(mosqueId, "demo-parent2@moschee.app", "Fatima", "Al-Rashid", "P-002");
    const parent3 = await seedParentUser(mosqueId, "demo-parent3@moschee.app", "Ibrahim", "Öztürk", "P-003");
    // parent4 ist Aisha Demir — wird auch als Vater/Mutter-Name bei Hassan Demir verwendet
    const parent4 = await seedParentUser(mosqueId, "demo-parent4@moschee.app", "Aisha", "Demir", "P-004");

    // 12 Schüler anlegen
    console.log("\n\n=== Schüler (4 mit Parent-Account) ===");

    const studentsWithParent = [
      {
        first_name: "Yusuf",
        last_name: "Yılmaz",
        date_of_birth: "2020-03-15",
        gender: "male",
        parent_id: parent1.id,
        parent_name: "Mehmet Yılmaz",
        parent_phone: "+49 151 11223344",
      },
      {
        first_name: "Zeynep",
        last_name: "Yılmaz",
        date_of_birth: "2019-07-22",
        gender: "female",
        parent_id: parent1.id,
        parent_name: "Mehmet Yılmaz",
        parent_phone: "+49 151 11223344",
      },
      {
        first_name: "Omar",
        last_name: "Al-Rashid",
        date_of_birth: "2020-11-08",
        gender: "male",
        parent_id: parent2.id,
        parent_name: "Fatima Al-Rashid",
        parent_phone: "+49 152 55667788",
      },
      {
        first_name: "Maryam",
        last_name: "Öztürk",
        date_of_birth: "2021-02-14",
        gender: "female",
        parent_id: parent3.id,
        parent_name: "Ibrahim Öztürk",
        parent_phone: "+49 153 99001122",
      },
    ];

    console.log("\n\n=== Schüler (8 ohne Parent-Account, nur Kontaktdaten) ===");

    const studentsWithoutParent = [
      {
        first_name: "Hassan",
        last_name: "Demir",
        date_of_birth: "2019-05-10",
        gender: "male",
        father_name: "Karim Demir",
        mother_name: "Aisha Demir",
        parent_name: "Karim Demir",
        parent_phone: "+49 151 22334455",
      },
      {
        first_name: "Amina",
        last_name: "Kaya",
        date_of_birth: "2020-09-03",
        gender: "female",
        father_name: "Tariq Kaya",
        mother_name: "Nour Kaya",
        parent_name: "Tariq Kaya",
        parent_phone: "+49 152 33445566",
      },
      {
        first_name: "Ali",
        last_name: "Şahin",
        date_of_birth: "2021-01-20",
        gender: "male",
        father_name: "Mustafa Şahin",
        mother_name: "Fatma Şahin",
        parent_name: "Mustafa Şahin",
        parent_phone: "+49 153 44556677",
      },
      {
        first_name: "Hafsa",
        last_name: "Arslan",
        date_of_birth: "2019-12-05",
        gender: "female",
        father_name: "Bilal Arslan",
        mother_name: "Hatice Arslan",
        parent_name: "Bilal Arslan",
        parent_phone: "+49 154 55667788",
      },
      {
        first_name: "Idris",
        last_name: "Çelik",
        date_of_birth: "2020-06-18",
        gender: "male",
        father_name: "Ramazan Çelik",
        mother_name: "Elif Çelik",
        parent_name: "Ramazan Çelik",
        parent_phone: "+49 155 66778899",
      },
      {
        first_name: "Ruqayyah",
        last_name: "Tekin",
        date_of_birth: "2021-04-25",
        gender: "female",
        father_name: "Ömer Tekin",
        mother_name: "Sümeyye Tekin",
        parent_name: "Ömer Tekin",
        parent_phone: "+49 156 77889900",
      },
      {
        first_name: "Musa",
        last_name: "Polat",
        date_of_birth: "2019-08-12",
        gender: "male",
        father_name: "Hüseyin Polat",
        mother_name: "Merve Polat",
        parent_name: "Hüseyin Polat",
        parent_phone: "+49 157 88990011",
      },
      {
        first_name: "Khadija",
        last_name: "Erdoğan",
        date_of_birth: "2020-02-28",
        gender: "female",
        father_name: "Yusuf Erdoğan",
        mother_name: "Büşra Erdoğan",
        parent_name: "Yusuf Erdoğan",
        parent_phone: "+49 158 99001122",
      },
    ];

    const allStudents = [];

    for (const data of studentsWithParent) {
      const s = await seedStudent(mosqueId, data);
      allStudents.push(s);
    }

    for (const data of studentsWithoutParent) {
      const s = await seedStudent(mosqueId, data);
      allStudents.push(s);
    }

    // Alle in Demo-Kurs einschreiben
    if (course) {
      console.log("\n\n=== Kurseinschreibungen ===");
      for (const student of allStudents) {
        process.stdout.write("  " + student.id + " → " + course.id + "  ");
        await enrollStudent(course.id, student.id, mosqueId);
      }
    }

    console.log("\n\n✅ Fertig! " + allStudents.length + " Schüler angelegt.");
    console.log("\nDemo-Parent-Accounts (Passwort: " + DEMO_PASSWORD + "):");
    console.log("  demo-parent1@moschee.app — Mehmet Yılmaz (2 Kinder: Yusuf, Zeynep)");
    console.log("  demo-parent2@moschee.app — Fatima Al-Rashid (1 Kind: Omar)");
    console.log("  demo-parent3@moschee.app — Ibrahim Öztürk (1 Kind: Maryam)");
    console.log("  demo-parent4@moschee.app — Aisha Demir (kein direktes Kind verlinkt)");
  } catch (err) {
    console.error("\n❌ Fehler:", err.message);
    process.exit(1);
  }
}

main();
