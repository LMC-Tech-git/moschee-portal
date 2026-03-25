/**
 * lib/demo/seed.ts
 *
 * TypeScript-Port von scripts/seed-demo-full.mjs.
 * Wird vom Super-Admin-Reset-Endpunkt verwendet.
 *
 * Schritt 1: Alle Inhalts-Records der Demo-Moschee löschen
 *            (Mosque, Settings und Users bleiben erhalten)
 * Schritt 2: Demo-Daten neu anlegen (findOrCreate für Users, frisch für den Rest)
 */

import PocketBase from "pocketbase";
import { getAdminPB } from "@/lib/pocketbase-admin";

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface ResetResult {
  deletedCount: number;
  createdCount: number;
  durationMs: number;
}

// ─── Datum-Hilfen ─────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}
function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 86_400_000);
}
function monthsAgo(n: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return d;
}
function isoDate(d: Date): string {
  return d.toISOString().substring(0, 10);
}
function isoDateTime(d: Date): string {
  return d.toISOString().replace("T", " ").substring(0, 19) + ".000Z";
}
function monthKey(d: Date): string {
  return d.toISOString().substring(0, 7);
}

// ─── PB-Hilfsfunktionen ──────────────────────────────────────────────────────

async function deleteAllFor(
  pb: PocketBase,
  collection: string,
  mosqueId: string,
  extraFilter = ""
): Promise<number> {
  const filter =
    `mosque_id = "${mosqueId}"` + (extraFilter ? ` && ${extraFilter}` : "");
  try {
    const items = await pb
      .collection(collection)
      .getFullList({ filter, fields: "id", batch: 500 });
    await Promise.all(
      items.map((r) =>
        pb.collection(collection).delete(r.id).catch(() => null)
      )
    );
    return items.length;
  } catch {
    return 0;
  }
}

async function findOrCreate(
  pb: PocketBase,
  collection: string,
  filter: string,
  data: Record<string, unknown>
): Promise<{ record: Record<string, unknown>; created: boolean }> {
  try {
    const result = await pb
      .collection(collection)
      .getList(1, 1, { filter });
    if (result.items.length > 0) {
      return { record: result.items[0] as Record<string, unknown>, created: false };
    }
  } catch {
    // fall through to create
  }
  const record = await pb.collection(collection).create(data);
  return { record: record as unknown as Record<string, unknown>, created: true };
}

async function batchCreate(
  pb: PocketBase,
  collection: string,
  items: Record<string, unknown>[],
  chunkSize = 10
): Promise<number> {
  let created = 0;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const results = await Promise.allSettled(
      chunk.map((item) => pb.collection(collection).create(item))
    );
    created += results.filter((r) => r.status === "fulfilled").length;
  }
  return created;
}

// ─── Daten-Definitionen ──────────────────────────────────────────────────────

const DEMO_PASSWORD = "Demo1234!";

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

const STUDENT_DATA = [
  { first: "Fatima",   last: "Yilmaz",   dob: (y: number) => `${y - 9}-03-15`,  gender: "female", father: "Mehmet Yilmaz",    fp: "+49 151 11223344", mother: "Ayse Yilmaz",      mp: "+49 151 11223345" },
  { first: "Musa",     last: "Kaya",     dob: (y: number) => `${y - 10}-06-20`, gender: "male",   father: "Hasan Kaya",       fp: "+49 152 22334455", mother: "Ayse Kaya",        mp: "+49 152 22334456" },
  { first: "Elif",     last: "Demir",    dob: (y: number) => `${y - 9}-09-10`,  gender: "female", father: "Mustafa Demir",    fp: "+49 153 33445566", mother: "Hatice Demir",     mp: "+49 153 33445567" },
  { first: "Ibrahim",  last: "Celik",    dob: (y: number) => `${y - 11}-11-05`, gender: "male",   father: "Abdullah Celik",   fp: "+49 155 55667788", mother: "Fatma Celik",      mp: "+49 155 55667789" },
  { first: "Zeynep",   last: "Arslan",   dob: (y: number) => `${y - 8}-02-28`,  gender: "female", father: "Recep Arslan",     fp: "+49 154 44556677", mother: "Fatma Arslan",     mp: "+49 154 44556678" },
  { first: "Ali",      last: "Sahin",    dob: (y: number) => `${y - 10}-07-12`, gender: "male",   father: "Mehmet Sahin",     fp: "+49 156 66778899", mother: "Hatice Sahin",     mp: "+49 156 66778900" },
  { first: "Hatice",   last: "Ozturk",   dob: (y: number) => `${y - 9}-04-22`,  gender: "female", father: "Hasan Ozturk",    fp: "+49 157 77889900", mother: "Nalan Ozturk",     mp: "+49 157 77889901" },
  { first: "Yusuf",    last: "Kurt",     dob: (y: number) => `${y - 11}-08-30`, gender: "male",   father: "Kemal Kurt",       fp: "+49 158 88990011", mother: "Nalan Kurt",       mp: "+49 158 88990012" },
  { first: "Merve",    last: "Polat",    dob: (y: number) => `${y - 8}-01-14`,  gender: "female", father: "Ali Polat",        fp: "+49 159 99001122", mother: "Zeynep Polat",     mp: "+49 159 99001123" },
  { first: "Osman",    last: "Yildiz",   dob: (y: number) => `${y - 10}-10-08`, gender: "male",   father: "Kadir Yildiz",     fp: "+49 160 00112233", mother: "Zeynep Yildiz",    mp: "+49 160 00112234" },
  { first: "Safiye",   last: "Müller",   dob: (y: number) => `${y - 9}-05-17`,  gender: "female", father: "Hans Müller",      fp: "+49 161 11223345", mother: "Sabine Müller",    mp: "+49 161 11223346" },
  { first: "Davut",    last: "Fischer",  dob: (y: number) => `${y - 10}-12-03`, gender: "male",   father: "Klaus Fischer",    fp: "+49 162 22334456", mother: "Sabine Fischer",   mp: "+49 162 22334457" },
  { first: "Rümeysa",  last: "Wagner",   dob: (y: number) => `${y - 8}-07-25`,  gender: "female", father: "Klaus Wagner",     fp: "+49 163 33445567", mother: "Maria Wagner",     mp: "+49 163 33445568" },
  { first: "Burak",    last: "Schmitt",  dob: (y: number) => `${y - 11}-03-11`, gender: "male",   father: "Thomas Schmitt",   fp: "+49 164 44556678", mother: "Maria Schmitt",    mp: "+49 164 44556679" },
  { first: "Nisa",     last: "Al-Hassan",dob: (y: number) => `${y - 9}-09-29`,  gender: "female", father: "Ahmed Al-Hassan",  fp: "+49 166 66778890", mother: "Sara Al-Hassan",   mp: "+49 166 66778891" },
  { first: "Tariq",    last: "Ibrahim",  dob: (y: number) => `${y - 10}-06-07`, gender: "male",   father: "Omar Ibrahim",     fp: "+49 167 77889901", mother: "Sara Ibrahim",     mp: "+49 167 77889902" },
  { first: "Meryem",   last: "Khalil",   dob: (y: number) => `${y - 8}-11-18`,  gender: "female", father: "Omar Khalil",      fp: "+49 168 88990012", mother: "Leila Khalil",     mp: "+49 168 88990013" },
  { first: "Suleiman", last: "Becker",   dob: (y: number) => `${y - 11}-04-02`, gender: "male",   father: "Thomas Becker",    fp: "+49 165 55667789", mother: "Maria Becker",     mp: "+49 165 55667790" },
  { first: "Esra",     last: "Hoffmann", dob: (y: number) => `${y - 9}-08-14`,  gender: "female", father: "Daniel Hoffmann",  fp: "+49 170 00112234", mother: "Leila Hoffmann",   mp: "+49 170 00112235" },
  { first: "Hamza",    last: "Mansouri", dob: (y: number) => `${y - 10}-01-21`, gender: "male",   father: "Omar Mansouri",    fp: "+49 169 99001123", mother: "Leila Mansouri",   mp: "+49 169 99001124" },
];

const ATTENDANCE_MATRIX = [
  ["present","present","late",   "present","absent", "present","excused","present","present","absent" ],
  ["present","absent", "present","present","present","present","present","absent", "present","absent" ],
  ["present","present","present","absent", "present","present","present","absent", "late",   "present"],
  ["present","present","absent", "present","present","late",   "present","present","present","present"],
  ["absent", "present","present","present","present","present","absent", "present","present","present"],
  ["present","present","present","present","late",   "present","present","present","absent", "present"],
];

const FEE_PATTERNS = [
  [{ s: "paid", m: "cash" },     { s: "paid", m: "cash" },     { s: "open", m: "" }],
  [{ s: "paid", m: "transfer" }, { s: "open", m: "" },          { s: "open", m: "" }],
  [{ s: "paid", m: "cash" },     { s: "paid", m: "transfer" }, { s: "paid", m: "cash" }],
  [{ s: "waived", m: "waived" }, { s: "waived", m: "waived" }, { s: "open", m: "" }],
  [{ s: "paid", m: "cash" },     { s: "open", m: "" },          { s: "open", m: "" }],
  [{ s: "paid", m: "cash" },     { s: "paid", m: "cash" },     { s: "paid", m: "cash" }],
  [{ s: "waived", m: "waived" }, { s: "open", m: "" },          { s: "open", m: "" }],
  [{ s: "paid", m: "transfer" }, { s: "paid", m: "transfer" }, { s: "open", m: "" }],
  [{ s: "open", m: "" },          { s: "open", m: "" },          { s: "open", m: "" }],
  [{ s: "paid", m: "cash" },     { s: "open", m: "" },          { s: "paid", m: "cash" }],
  [{ s: "paid", m: "transfer" }, { s: "paid", m: "cash" },     { s: "open", m: "" }],
  [{ s: "paid", m: "cash" },     { s: "paid", m: "transfer" }, { s: "paid", m: "transfer" }],
];

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

const GUESTS_REG = [
  { name: "Petra Müller",      email: "petra.mueller@gmail.com" },
  { name: "Lars Hansen",       email: "lars.hansen@web.de" },
  { name: "Amir Souza",        email: "asouza@hotmail.com" },
  { name: "Ingrid Köhler",     email: "ingrid.koehler@t-online.de" },
  { name: "Kareem Nasser",     email: "k.nasser@gmx.de" },
  { name: "Claudia Braun",     email: "c.braun@yahoo.de" },
  { name: "Tobias Richter",    email: "t.richter@outlook.com" },
  { name: "Samira Boulou",     email: "s.boulou@gmail.com" },
  { name: "Michael Seifert",   email: "m.seifert@web.de" },
  { name: "Fatou Diallo",      email: "f.diallo@gmail.com" },
  { name: "Georg Werner",      email: "g.werner@t-online.de" },
  { name: "Nadia Hamdan",      email: "n.hamdan@gmx.de" },
  { name: "Familie Schreiber", email: "schreiber.family@yahoo.de" },
  { name: "Yilmaz Ailesi",     email: "yilmaz.aile@hotmail.com" },
  { name: "René Hoffmann",     email: "r.hoffmann@gmail.com" },
];

// ─── Seed-Funktionen ─────────────────────────────────────────────────────────

async function seedUsers(
  pb: PocketBase,
  mosqueId: string
): Promise<{ admin: string; imam: string; imam2: string; teacher1: string; teacher2: string; teacher3: string; memberIds: string[] }> {
  const staffDefs = [
    { email: "demo-admin@moschee.app",    first: "Admin",   last: "Demo",    role: "admin",   no: "DEMO-001", phone: "+49 30 100001", address: "Verwaltung, 10115 Berlin" },
    { email: "demo-imam@moschee.app",     first: "Musa",    last: "Al-Amin", role: "imam",    no: "DEMO-002", phone: "+49 30 100002", address: "Moscheestraße 1, 10115 Berlin" },
    { email: "demo-imam2@moschee.app",    first: "Yusuf",   last: "Rahman",  role: "imam",    no: "DEMO-003", phone: "+49 30 100003", address: "Moscheestraße 1, 10115 Berlin" },
    { email: "demo-teacher@moschee.app",  first: "Aisha",   last: "Karimi",  role: "teacher", no: "DEMO-010", phone: "+49 30 100010", address: "Lehrerpfad 5, 10117 Berlin" },
    { email: "demo-teacher2@moschee.app", first: "Yasemin", last: "Demir",   role: "teacher", no: "DEMO-011", phone: "+49 30 100011", address: "Lehrerpfad 6, 10117 Berlin" },
    { email: "demo-teacher3@moschee.app", first: "Bilal",   last: "Hassan",  role: "teacher", no: "DEMO-012", phone: "+49 30 100012", address: "Lehrerpfad 7, 10117 Berlin" },
  ];

  const ids: Record<string, string> = {};

  for (const u of staffDefs) {
    const { record } = await findOrCreate(
      pb, "users",
      `email = "${u.email}"`,
      {
        email: u.email,
        password: DEMO_PASSWORD,
        passwordConfirm: DEMO_PASSWORD,
        emailVisibility: true,
        first_name: u.first,
        last_name: u.last,
        full_name: `${u.first} ${u.last}`,
        mosque_id: mosqueId,
        role: u.role,
        status: "active",
        member_no: u.no,
        membership_number: u.no,
        phone: u.phone,
        address: u.address,
      }
    );
    const key =
      u.role === "admin" ? "admin"
      : u.role === "imam" && !ids["imam"] ? "imam"
      : u.role === "imam" ? "imam2"
      : u.role === "teacher" && !ids["teacher1"] ? "teacher1"
      : u.role === "teacher" && !ids["teacher2"] ? "teacher2"
      : "teacher3";
    ids[key] = record["id"] as string;
  }

  const memberIds: string[] = [];
  for (let i = 0; i < MEMBER_DATA.length; i++) {
    const m = MEMBER_DATA[i];
    const no = i + 1;
    const email = `demo-member-${String(no).padStart(2, "0")}@moschee.app`;
    const { record } = await findOrCreate(
      pb, "users",
      `email = "${email}"`,
      {
        email,
        password: DEMO_PASSWORD,
        passwordConfirm: DEMO_PASSWORD,
        emailVisibility: true,
        first_name: m.first,
        last_name: m.last,
        full_name: `${m.first} ${m.last}`,
        mosque_id: mosqueId,
        role: "member",
        status: "active",
        member_no: `DEMO-${100 + no}`,
        membership_number: `DEMO-${100 + no}`,
        phone: m.phone,
        address: m.address,
      }
    );
    memberIds.push(record["id"] as string);
  }

  return {
    admin: ids["admin"],
    imam: ids["imam"],
    imam2: ids["imam2"],
    teacher1: ids["teacher1"],
    teacher2: ids["teacher2"],
    teacher3: ids["teacher3"],
    memberIds,
  };
}

async function seedTeamMembers(pb: PocketBase, mosqueId: string): Promise<number> {
  const team = [
    { name: "Musa Al-Amin",      role: "Imam",             bio: "Imam der Gemeinde seit über 15 Jahren. Absolvent der Islamischen Universität Medina mit Schwerpunkt Koranwissenschaften.", group: "Vorstand",  sort_order: 1 },
    { name: "Dr. Ahmet Yilmaz",  role: "1. Vorsitzender",  bio: "Promovierter Ingenieur und ehrenamtlicher Vorsitzender. Leitet die Gemeinde seit 2018 mit großem Engagement.",            group: "Vorstand",  sort_order: 2 },
    { name: "Ibrahim Kaya",      role: "Kassenwart",       bio: "Diplom-Kaufmann und verantwortlich für die Finanzen der Gemeinde. Sorgt für transparente und ordentliche Buchführung.",  group: "Vorstand",  sort_order: 3 },
    { name: "Fatima Demir",      role: "Jugendleiterin",   bio: "Sozialarbeiterin und Leiterin der Jugendgruppe. Organisiert regelmäßige Workshops, Ausflüge und Freizeitangebote.",       group: "Jugend",    sort_order: 4 },
    { name: "Zeynep Arslan",     role: "Frauenbeauftragte",bio: "Lehrerin und Koordinatorin der Frauengruppe. Bietet Deutsch-Kurse, Nähkreise und Beratungsangebote an.",                 group: "Soziales",  sort_order: 5 },
    { name: "Mehmet Celik",      role: "IT & Medien",      bio: "Softwareentwickler und zuständig für die digitale Infrastruktur der Gemeinde. Betreut Website und Portal.",              group: "Technik",   sort_order: 6 },
  ];
  let created = 0;
  for (const t of team) {
    const { created: wasCreated } = await findOrCreate(
      pb, "team_members",
      `mosque_id = "${mosqueId}" && name = "${t.name}"`,
      { ...t, mosque_id: mosqueId, is_active: true }
    );
    if (wasCreated) created++;
  }
  return created;
}

async function seedAcademicYears(
  pb: PocketBase,
  mosqueId: string
): Promise<{ active: string; archived: string }> {
  const now = new Date();
  const cy = now.getFullYear();
  const isSecondHalf = now.getMonth() >= 8;
  const activeStart = isSecondHalf ? cy : cy - 1;
  const activeEnd = isSecondHalf ? cy + 1 : cy;
  const archivedStart = activeStart - 1;
  const archivedEnd = activeEnd - 1;

  const years = [
    { name: `${archivedStart}/${String(archivedEnd).slice(-2)}`, start_date: `${archivedStart}-09-01`, end_date: `${archivedEnd}-07-31`, status: "archived" },
    { name: `${activeStart}/${String(activeEnd).slice(-2)}`,     start_date: `${activeStart}-09-01`,   end_date: `${activeEnd}-07-31`,   status: "active" },
  ];

  const ids: Record<string, string> = {};
  for (const y of years) {
    const { record } = await findOrCreate(
      pb, "academic_years",
      `mosque_id = "${mosqueId}" && name = "${y.name}"`,
      { ...y, mosque_id: mosqueId }
    );
    ids[y.status] = record["id"] as string;
  }
  return { active: ids["active"], archived: ids["archived"] };
}

async function seedCourses(
  pb: PocketBase,
  mosqueId: string,
  yearIds: { active: string; archived: string },
  teacherIds: { teacher1: string; teacher2: string; teacher3: string }
): Promise<string[]> {
  const courses = [
    { title: "Quran für Anfänger",    description: "Grundlagen der Quran-Rezitation für Kinder im Alter von 6–10 Jahren. Schwerpunkte: arabische Buchstaben, Harakat und erste kurze Suren.",           category: "quran",   level: "beginner",     year: yearIds.active,   teacher: teacherIds.teacher1, day: "saturday", start: "10:00", end: "11:30", room: "Unterrichtsraum 1", max: 20, status: "active"   },
    { title: "Quran Fortgeschrittene",description: "Vertiefende Quran-Rezitation für Kinder, die die Grundlagen beherrschen. Ziel ist die eigenständige Rezitation längerer Suren.",                   category: "quran",   level: "intermediate", year: yearIds.active,   teacher: teacherIds.teacher1, day: "sunday",   start: "10:00", end: "11:30", room: "Unterrichtsraum 1", max: 15, status: "active"   },
    { title: "Arabisch-Kurs A1",      description: "Arabisch für Anfänger — Aufbau des Grundwortschatzes, einfache Satzstrukturen und schriftliches Arabisch.",                                         category: "arabic",  level: "beginner",     year: yearIds.active,   teacher: teacherIds.teacher2, day: "saturday", start: "14:00", end: "15:30", room: "Seminarraum",       max: 18, status: "active"   },
    { title: "Islamkunde & Sira",     description: "Geschichte des Propheten Muhammad (ﷺ) und Grundlagen des islamischen Glaubens für Kinder und Jugendliche.",                                        category: "sira",    level: "mixed",        year: yearIds.active,   teacher: teacherIds.teacher3, day: "sunday",   start: "14:00", end: "15:30", room: "Seminarraum",       max: 25, status: "active"   },
    { title: "Tajweed-Kurs",          description: "Regeln der korrekten Quran-Rezitation (Tajweed) für Fortgeschrittene — Archivkurs des vergangenen Schuljahres.",                                   category: "tajweed", level: "intermediate", year: yearIds.archived, teacher: teacherIds.teacher2, day: "saturday", start: "10:00", end: "11:30", room: "Unterrichtsraum 2", max: 12, status: "archived" },
  ];

  const ids: string[] = [];
  for (const c of courses) {
    const { record } = await findOrCreate(
      pb, "courses",
      `mosque_id = "${mosqueId}" && title = "${c.title}" && academic_year_id = "${c.year}"`,
      {
        mosque_id: mosqueId,
        title: c.title,
        description: c.description,
        category: c.category,
        level: c.level,
        academic_year_id: c.year,
        teacher_id: c.teacher,
        created_by: c.teacher,
        day_of_week: c.day,
        start_time: c.start,
        end_time: c.end,
        location_name: c.room,
        max_students: c.max,
        status: c.status,
      }
    );
    ids.push(record["id"] as string);
  }
  return ids;
}

async function seedStudents(pb: PocketBase, mosqueId: string): Promise<string[]> {
  const cy = new Date().getFullYear();
  const ids: string[] = [];
  for (const s of STUDENT_DATA) {
    const { record } = await findOrCreate(
      pb, "students",
      `mosque_id = "${mosqueId}" && first_name = "${s.first}" && last_name = "${s.last}"`,
      {
        mosque_id: mosqueId,
        first_name: s.first,
        last_name: s.last,
        date_of_birth: s.dob(cy),
        gender: s.gender,
        father_name: s.father,
        father_phone: s.fp,
        mother_name: s.mother,
        mother_phone: s.mp,
        parent_name: s.father,
        parent_phone: s.fp,
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
    ids.push(record["id"] as string);
  }
  return ids;
}

async function seedEnrollments(
  pb: PocketBase,
  mosqueId: string,
  courseIds: string[],
  studentIds: string[]
): Promise<number> {
  const assignments = [
    { cIdx: 0, sRange: [0, 9],  status: "enrolled"  },
    { cIdx: 1, sRange: [5, 13], status: "enrolled"  },
    { cIdx: 2, sRange: [10, 17], status: "enrolled" },
    { cIdx: 3, sRange: [2, 11], status: "enrolled"  },
    { cIdx: 4, sRange: [0, 5],  status: "completed" },
  ];
  let total = 0;
  for (const { cIdx, sRange, status } of assignments) {
    for (let i = sRange[0]; i <= sRange[1]; i++) {
      const { created } = await findOrCreate(
        pb, "course_enrollments",
        `course_id = "${courseIds[cIdx]}" && student_id = "${studentIds[i]}"`,
        {
          mosque_id: mosqueId,
          course_id: courseIds[cIdx],
          student_id: studentIds[i],
          status,
          enrolled_at: isoDateTime(daysAgo(150)),
          completed_at: status === "completed" ? isoDateTime(daysAgo(30)) : "",
          notes: "",
        }
      );
      if (created) total++;
    }
  }
  return total;
}

async function seedAttendance(
  pb: PocketBase,
  mosqueId: string,
  courseId: string,
  studentIds: string[],
  teacherId: string
): Promise<number> {
  const sessions = [42, 35, 28, 21, 14, 7].map(daysAgo).map(isoDate);
  const firstTen = studentIds.slice(0, 10);
  const NOTES: Record<string, string> = {
    excused: "Krankheitsbedingt entschuldigt.",
    late: "Ca. 10–15 Minuten zu spät erschienen.",
  };
  let created = 0;
  for (let si = 0; si < sessions.length; si++) {
    for (let ki = 0; ki < firstTen.length; ki++) {
      const status = ATTENDANCE_MATRIX[si][ki];
      const { created: wasCreated } = await findOrCreate(
        pb, "attendance",
        `course_id = "${courseId}" && student_id = "${firstTen[ki]}" && session_date = "${sessions[si]}"`,
        {
          mosque_id: mosqueId,
          course_id: courseId,
          student_id: firstTen[ki],
          session_date: sessions[si],
          status,
          notes: NOTES[status] ?? "",
          marked_by: teacherId,
        }
      );
      if (wasCreated) created++;
    }
  }
  return created;
}

async function seedStudentFees(
  pb: PocketBase,
  mosqueId: string,
  studentIds: string[],
  adminId: string
): Promise<number> {
  const months = [monthKey(monthsAgo(2)), monthKey(monthsAgo(1)), monthKey(new Date())];
  const firstTwelve = studentIds.slice(0, 12);
  let created = 0;
  for (let ki = 0; ki < firstTwelve.length; ki++) {
    for (let mi = 0; mi < months.length; mi++) {
      const { s: status, m: method } = FEE_PATTERNS[ki][mi];
      const { created: wasCreated } = await findOrCreate(
        pb, "student_fees",
        `student_id = "${firstTwelve[ki]}" && month_key = "${months[mi]}"`,
        {
          mosque_id: mosqueId,
          student_id: firstTwelve[ki],
          month_key: months[mi],
          amount_cents: 1500,
          status,
          payment_method: method,
          paid_at: status === "paid" ? `${months[mi]}-15 12:00:00.000Z` : "",
          notes: status === "waived" ? "Soziale Ermäßigung gewährt." : "",
          provider_ref: "",
          created_by: adminId,
        }
      );
      if (wasCreated) created++;
    }
  }
  return created;
}

async function seedPosts(pb: PocketBase, mosqueId: string, adminId: string): Promise<number> {
  const posts = [
    { title: "Willkommen beim Demo-Portal",            content: "Dies ist eine Demonstration von moschee.app — der digitalen Verwaltungslösung für Moscheen. Alle Funktionen können hier ausprobiert werden. Wir freuen uns über Ihr Interesse und stehen für Fragen jederzeit zur Verfügung.", category: "announcement", visibility: "public",  status: "published", pinned: true,  daysBack: 30 },
    { title: "Ramadan Mubarak — Gebetszeiten & Programm", content: "Wir wünschen unserer gesamten Gemeinschaft einen gesegneten Ramadan! Die aktuellen Gebetszeiten sowie das vollständige Ramadan-Programm mit Tarawih und Iftar-Veranstaltungen finden Sie auf unserer Website.",          category: "announcement", visibility: "public",  status: "published", pinned: true,  daysBack: 25 },
    { title: "Neue Arabisch-Kurse ab Herbst",           content: "Wir freuen uns, für das kommende Schuljahr neue Arabisch-Kurse für alle Altersgruppen anbieten zu können. Die Kurse richten sich sowohl an absolute Anfänger als auch an Teilnehmer mit Grundkenntnissen. Anmeldungen sind ab sofort möglich.", category: "general", visibility: "public",  status: "published", pinned: false, daysBack: 20 },
    { title: "Spendenkampagne: Neue Waschräume 2025",   content: "Unsere Gemeinde benötigt dringend renovierte Waschräume. Wir haben eine Spendenkampagne gestartet und sind bereits auf gutem Weg zum Ziel. Jede Spende zählt!",                                                           category: "campaign",     visibility: "public",  status: "published", pinned: false, daysBack: 18 },
    { title: "Freitagspredigt: Geduld und Dankbarkeit", content: "Die heutige Freitagspredigt behandelte das Thema Geduld (Sabr) und Dankbarkeit (Shukr) im alltäglichen Leben. Eine Zusammenfassung wird in Kürze hier veröffentlicht.",                                                   category: "general",      visibility: "public",  status: "published", pinned: false, daysBack: 12 },
    { title: 'Jugend-Workshop "Islam in Deutschland"',  content: "Unser Workshop für Jugendliche zwischen 14 und 25 Jahren war ein voller Erfolg! Über 30 Teilnehmer diskutierten Themen wie Identität, gesellschaftliche Teilhabe und den Umgang mit Vorurteilen.",                          category: "youth",        visibility: "public",  status: "published", pinned: false, daysBack: 7  },
    { title: "Gemeinde-Newsletter",                     content: "Liebe Gemeindemitglieder, in diesem Monat berichten wir über die Fortschritte bei der Waschraum-Renovierung, kommende Veranstaltungen und die Ergebnisse unserer letzten Mitgliederversammlung.",                           category: "general",      visibility: "members", status: "published", pinned: false, daysBack: 3  },
    { title: "Einladung zum Iftar-Abend",               content: "Wir laden herzlich zum gemeinsamen Iftar ein! Nächsten Freitag öffnen wir unsere Türen für Mitglieder und Gäste. Bitte melden Sie sich zur besseren Planung an.",                                                          category: "event",        visibility: "public",  status: "published", pinned: false, daysBack: 1  },
    { title: "Ankündigung: Großes Gemeindefest",        content: "Wir planen unser diesjähriges Gemeindefest mit einem vielfältigen Programm für alle Altersgruppen. Details werden in Kürze bekannt gegeben.",                                                                               category: "announcement", visibility: "public",  status: "draft",     pinned: false, daysBack: 0  },
  ];
  let created = 0;
  for (const p of posts) {
    const { created: wasCreated } = await findOrCreate(
      pb, "posts",
      `mosque_id = "${mosqueId}" && title = "${p.title}"`,
      {
        mosque_id: mosqueId,
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
    if (wasCreated) created++;
  }
  return created;
}

async function seedEvents(
  pb: PocketBase,
  mosqueId: string,
  adminId: string
): Promise<Array<{ id: string; daysOff: number; category: string; title: string }>> {
  const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000);

  const events = [
    { title: "Freitagsgebet — vorletzter Freitag",  description: "Wöchentliches Freitagsgebet mit Khutba. Alle Gemeindemitglieder und Gäste sind herzlich willkommen.",                        category: "other",     visibility: "public",  capacity: 0,   daysOff: -14, durationH: 1.5, location: "Hauptgebetsraum" },
    { title: "Ramadan-Abschlussfeier",               description: "Gemeinsame Feier zum Ende des Ramadan mit Leckereien, Vorträgen und einem besonderen Programm für Kinder.",                    category: "community", visibility: "public",  capacity: 100, daysOff: -21, durationH: 3,   location: "Gemeinschaftssaal" },
    { title: "Arabisch-Intensivkurs",                description: "Eintägiger Intensivkurs Arabisch für Anfänger. Bitte bringen Sie Schreibmaterial mit.",                                       category: "lecture",   visibility: "public",  capacity: 20,  daysOff: -10, durationH: 5,   location: "Seminarraum" },
    { title: "Freitagsgebet — letzter Freitag",      description: "Wöchentliches Freitagsgebet mit Khutba. Alle Gemeindemitglieder und Gäste sind herzlich willkommen.",                        category: "other",     visibility: "public",  capacity: 0,   daysOff: -7,  durationH: 1.5, location: "Hauptgebetsraum" },
    { title: "Jugend-Ausflug Kletterpark",            description: "Gemeinsamer Ausflug der Jugendgruppe in den Kletterpark. Anmeldung erforderlich. Für Mitglieder zwischen 12 und 25 Jahren.", category: "youth",     visibility: "members", capacity: 30,  daysOff: -5,  durationH: 4,   location: "Kletterpark Berlin-Mitte" },
    { title: "Familientag der Gemeinde",              description: "Großer Familientag mit Kinderprogramm, Hüpfburg, Basarständen und gemeinsamem Mittagessen. Für die ganze Familie!",           category: "community", visibility: "public",  capacity: 80,  daysOff: 1,   durationH: 5,   location: "Gemeinschaftssaal und Innenhof" },
    { title: "Freitagsgebet — nächste Woche",         description: "Wöchentliches Freitagsgebet mit Khutba. Alle Gemeindemitglieder und Gäste sind herzlich willkommen.",                        category: "other",     visibility: "public",  capacity: 0,   daysOff: 3,   durationH: 1.5, location: "Hauptgebetsraum" },
    { title: "Vorlesung: Geschichte des Islam",       description: "Wissenschaftlicher Vortrag über die Geschichte des Islam von den Anfängen bis zur Gegenwart. Für alle Altersgruppen geeignet.", category: "lecture", visibility: "public",  capacity: 50,  daysOff: 5,   durationH: 2,   location: "Hauptgebetsraum" },
    { title: "Spendenabend: Neue Waschräume",         description: "Gemeinsamer Abend zur Unterstützung der Waschraum-Renovierung. Mit Vorträgen, Spendenaufruf und gemeinsamem Abendessen.",     category: "community", visibility: "public",  capacity: 60,  daysOff: 8,   durationH: 2.5, location: "Gemeinschaftssaal" },
    { title: "Madrasa Elternsprechtag",               description: "Elternsprechtag der Madrasa. Bitte vereinbaren Sie vorab einen Termin mit dem jeweiligen Lehrer.",                            category: "other",     visibility: "members", capacity: 0,   daysOff: 12,  durationH: 3,   location: "Unterrichtsräume" },
    { title: "Sommerfest der Gemeinde",               description: "Unser großes Sommerfest mit Musik, Essen, Spielen und einem besonderen Abendprogramm. Für Mitglieder und deren Gäste.",       category: "community", visibility: "public",  capacity: 200, daysOff: 21,  durationH: 6,   location: "Gemeinschaftssaal und Garten" },
    { title: "Benefizauktion für die Renovierung",    description: "Benefizauktion mit gespendeten Gegenständen und Erfahrungen. Alle Einnahmen fließen direkt in die Renovierung.",              category: "community", visibility: "public",  capacity: 0,   daysOff: 35,  durationH: 3,   location: "Hauptgebetsraum" },
  ];

  const result: Array<{ id: string; daysOff: number; category: string; title: string }> = [];
  for (const e of events) {
    const startDate = e.daysOff >= 0 ? daysFromNow(e.daysOff) : daysAgo(-e.daysOff);
    startDate.setHours(e.daysOff < 0 ? 19 : 14, 0, 0, 0);
    if (e.category === "other") startDate.setHours(12, 30, 0, 0);
    const endDate = addHours(startDate, e.durationH);
    const { record } = await findOrCreate(
      pb, "events",
      `mosque_id = "${mosqueId}" && title = "${e.title}"`,
      {
        mosque_id: mosqueId,
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
    result.push({ id: record["id"] as string, daysOff: e.daysOff, category: e.category, title: e.title });
  }
  return result;
}

async function seedEventRegistrations(
  pb: PocketBase,
  mosqueId: string,
  events: Array<{ id: string; daysOff: number; category: string; title: string }>,
  memberIds: string[]
): Promise<number> {
  const CONFIGS: Record<string, { count: [number, number]; memberPct: number }> = {
    other:     { count: [8,  12], memberPct: 0.8 },
    lecture:   { count: [15, 22], memberPct: 0.7 },
    community: { count: [25, 35], memberPct: 0.4 },
    youth:     { count: [8,  12], memberPct: 1.0 },
    campaign:  { count: [18, 25], memberPct: 0.5 },
  };
  let total = 0;
  for (const event of events) {
    const isPast  = event.daysOff < 0;
    const isToday = event.daysOff === 0 || event.daysOff === 1;
    const configKey = event.title.includes("Spendenabend") ? "campaign" : (CONFIGS[event.category] ? event.category : "other");
    const cfg = CONFIGS[configKey];
    const targetCount = isPast || isToday
      ? Math.floor(Math.random() * (cfg.count[1] - cfg.count[0] + 1)) + cfg.count[0]
      : Math.min(5, memberIds.length);
    const memberCount = Math.round(targetCount * cfg.memberPct);
    const guestCount  = targetCount - memberCount;
    const shuffled = [...memberIds].sort(() => Math.random() - 0.5).slice(0, memberCount);

    for (const userId of shuffled) {
      const regStatus = isPast
        ? (Math.random() < 0.7 ? "attended" : Math.random() < 0.5 ? "registered" : "no_show")
        : "registered";
      const regDaysAgo = isPast ? Math.abs(event.daysOff) + 2 + Math.floor(Math.random() * 5) : 1;
      const { created } = await findOrCreate(
        pb, "event_registrations",
        `event_id = "${event.id}" && user_id = "${userId}"`,
        { mosque_id: mosqueId, event_id: event.id, registrant_type: "member", user_id: userId, guest_name: "", guest_email: "", status: regStatus, registered_at: isoDateTime(daysAgo(regDaysAgo)) }
      );
      if (created) total++;
    }

    if (cfg.memberPct < 1.0) {
      const guestPool = [...GUESTS_REG].sort(() => Math.random() - 0.5).slice(0, guestCount);
      for (const g of guestPool) {
        const regStatus = isPast
          ? (Math.random() < 0.65 ? "attended" : Math.random() < 0.5 ? "registered" : "no_show")
          : "registered";
        const regDaysAgo = isPast ? Math.abs(event.daysOff) + 1 + Math.floor(Math.random() * 3) : 0;
        const { created } = await findOrCreate(
          pb, "event_registrations",
          `event_id = "${event.id}" && guest_email = "${g.email}"`,
          { mosque_id: mosqueId, event_id: event.id, registrant_type: "guest", user_id: "", guest_name: g.name, guest_email: g.email, status: regStatus, registered_at: isoDateTime(daysAgo(regDaysAgo)) }
        );
        if (created) total++;
      }
    }
  }
  return total;
}

async function seedCampaigns(pb: PocketBase, mosqueId: string, adminId: string): Promise<string[]> {
  const campaigns = [
    { title: "Moschee-Renovierung",    description: "Umfassende Renovierung des Hauptgebetsraums. Dank großzügiger Unterstützung unserer Gemeinde konnten alle Arbeiten erfolgreich abgeschlossen werden.", category: "construction", goal: 1_500_000, start: isoDateTime(daysAgo(180)), end: isoDateTime(daysAgo(30)),       status: "completed" },
    { title: "Neue Waschräume",        description: "Unsere Waschräume sind veraltet und bedürfen dringend einer Renovierung. Helfen Sie uns, dieses wichtige Projekt zu verwirklichen!",                   category: "maintenance",  goal:   800_000, start: isoDateTime(daysAgo(45)),  end: isoDateTime(daysFromNow(60)),  status: "active"    },
    { title: "Kinderspielplatz Projekt",description: "Wir möchten unseren jüngsten Gemeindemitgliedern einen sicheren und ansprechenden Spielplatz im Innenhof der Moschee schenken.",                      category: "general",      goal:   500_000, start: isoDateTime(daysAgo(10)),  end: isoDateTime(daysFromNow(90)),  status: "active"    },
  ];
  const ids: string[] = [];
  for (const c of campaigns) {
    const { record } = await findOrCreate(
      pb, "campaigns",
      `mosque_id = "${mosqueId}" && title = "${c.title}"`,
      { mosque_id: mosqueId, title: c.title, description: c.description, category: c.category, type: "general", visibility: "public", goal_amount_cents: c.goal, start_at: c.start, end_at: c.end, status: c.status, currency: "EUR", created_by: adminId }
    );
    ids.push(record["id"] as string);
  }
  return ids;
}

async function seedDonations(
  pb: PocketBase,
  mosqueId: string,
  campaignIds: string[],
  memberIds: string[]
): Promise<number> {
  const PROVIDERS = ["manual", "stripe", "paypal_link"];
  const sets = [
    { cIdx: 0, count: 15, rangeAgo: [180, 32] as [number, number], amounts: [10000,25000,50000,100000,5000,50000,25000,10000,100000,50000,25000,50000,100000,25000,50000] },
    { cIdx: 1, count: 12, rangeAgo: [40,  2]  as [number, number], amounts: [25000,10000,50000,5000,25000,50000,10000,25000,100000,25000,5000,50000] },
    { cIdx: 2, count: 5,  rangeAgo: [9,   1]  as [number, number], amounts: [10000,5000,25000,5000,10000] },
  ];
  const items: Record<string, unknown>[] = [];
  for (const set of sets) {
    for (let i = 0; i < set.count; i++) {
      const isMember = i % 3 === 0 && memberIds.length > 0;
      const guestIdx = (i * 7) % GUEST_DONORS.length;
      const memberIdx = (i * 3) % memberIds.length;
      const daysBackOff = set.rangeAgo[0] - Math.floor((set.rangeAgo[0] - set.rangeAgo[1]) * i / (set.count - 1));
      items.push({
        mosque_id: mosqueId,
        campaign_id: campaignIds[set.cIdx],
        donor_type: isMember ? "member" : "guest",
        user_id: isMember ? memberIds[memberIdx] : "",
        donor_name: isMember ? `${MEMBER_DATA[memberIdx % MEMBER_DATA.length].first} ${MEMBER_DATA[memberIdx % MEMBER_DATA.length].last}` : GUEST_DONORS[guestIdx].name,
        donor_email: isMember ? `demo-member-${String(memberIdx + 1).padStart(2, "0")}@moschee.app` : GUEST_DONORS[guestIdx].email,
        amount_cents: set.amounts[i],
        amount: set.amounts[i] / 100,
        currency: "EUR",
        is_recurring: false,
        provider: PROVIDERS[i % PROVIDERS.length],
        provider_ref: "",
        status: "paid",
        paid_at: isoDateTime(daysAgo(daysBackOff)),
      });
    }
  }
  return await batchCreate(pb, "donations", items, 10);
}

async function seedSponsors(pb: PocketBase, mosqueId: string): Promise<number> {
  const sponsors = [
    { name: "Halal Supermarkt Berlin", category: "gold",   website: "https://example.de", description: "Ihr lokaler Halal-Supermarkt mit frischen Produkten aus aller Welt.", start_date: isoDate(daysAgo(180)), end_date: isoDate(daysFromNow(185)), status: "active", notification_sent: false },
    { name: "Islamischer Buchhandel",  category: "silver", website: "https://example.de", description: "Bücher, Kalligraphie und islamische Geschenkartikel.",                 start_date: isoDate(daysAgo(90)),  end_date: isoDate(daysFromNow(5)),   status: "active", notification_sent: true  },
    { name: "Arabische Bäckerei Mitte",category: "bronze", website: "",                   description: "Frische orientalische Backwaren täglich.",                             start_date: isoDate(daysAgo(60)),  end_date: isoDate(daysFromNow(30)),  status: "active", notification_sent: false },
  ];
  let created = 0;
  for (const s of sponsors) {
    const { created: wasCreated } = await findOrCreate(
      pb, "sponsors",
      `mosque_id = "${mosqueId}" && name = "${s.name}"`,
      { ...s, mosque_id: mosqueId }
    );
    if (wasCreated) created++;
  }
  return created;
}

// ─── Haupt-Export ─────────────────────────────────────────────────────────────

export async function resetDemoData(mosqueId: string): Promise<ResetResult> {
  const started = Date.now();
  const pb = await getAdminPB();

  // ── Schritt 1: Cleanup (FK-Reihenfolge beachten) ──────────────────────────
  let deletedCount = 0;
  const collectionsToDelete = [
    "contact_messages",
    "student_fees",
    "attendance",
    "course_enrollments",
    "students",
    "courses",
    "academic_years",
    "donations",
    "event_registrations",
    "events",
    "campaigns",
    "posts",
    "sponsors",
    "team_members",
    "email_outbox",
    "audit_logs",
  ] as const;

  for (const col of collectionsToDelete) {
    deletedCount += await deleteAllFor(pb, col, mosqueId);
  }

  // ── Schritt 2: Reseed ─────────────────────────────────────────────────────
  let createdCount = 0;

  const users = await seedUsers(pb, mosqueId);
  createdCount += Object.keys(users).length - 1 + users.memberIds.length; // rough count

  createdCount += await seedTeamMembers(pb, mosqueId);

  const yearIds = await seedAcademicYears(pb, mosqueId);
  createdCount += 2;

  const courseIds = await seedCourses(pb, mosqueId, yearIds, users);
  createdCount += courseIds.length;

  const studentIds = await seedStudents(pb, mosqueId);
  createdCount += studentIds.length;

  createdCount += await seedEnrollments(pb, mosqueId, courseIds, studentIds);
  createdCount += await seedAttendance(pb, mosqueId, courseIds[0], studentIds, users.teacher1);
  createdCount += await seedStudentFees(pb, mosqueId, studentIds, users.admin);
  createdCount += await seedPosts(pb, mosqueId, users.admin);

  const events = await seedEvents(pb, mosqueId, users.admin);
  createdCount += events.length;

  createdCount += await seedEventRegistrations(pb, mosqueId, events, users.memberIds);

  const campaignIds = await seedCampaigns(pb, mosqueId, users.admin);
  createdCount += campaignIds.length;

  createdCount += await seedDonations(pb, mosqueId, campaignIds, users.memberIds);
  createdCount += await seedSponsors(pb, mosqueId);

  return { deletedCount, createdCount, durationMs: Date.now() - started };
}
