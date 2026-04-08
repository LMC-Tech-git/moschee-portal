/**
 * lib/demo/seed.ts
 *
 * Demo-Reset: erst alle Inhalte löschen, dann neu anlegen.
 * Optimiert: nach dem Cleanup gibt es keine Duplikate → direkte Creates ohne
 * vorheriges GET. Parallele Batch-Operationen wo möglich.
 *
 * Mosque, Settings und Users werden NICHT gelöscht (Login bleibt intakt).
 */

import PocketBase from "pocketbase";
import { getAdminPB } from "@/lib/pocketbase-admin";

export interface ResetResult {
  deletedCount: number;
  createdCount: number;
  durationMs: number;
}

// ─── Datum-Hilfen ─────────────────────────────────────────────────────────────

function daysAgo(n: number): Date { return new Date(Date.now() - n * 86_400_000); }
function daysFromNow(n: number): Date { return new Date(Date.now() + n * 86_400_000); }
function monthsAgo(n: number): Date { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n); return d; }
function isoDate(d: Date): string { return d.toISOString().substring(0, 10); }
function isoDateTime(d: Date): string { return d.toISOString().replace("T", " ").substring(0, 19) + ".000Z"; }
function monthKey(d: Date): string { return d.toISOString().substring(0, 7); }

// ─── PB-Hilfen ────────────────────────────────────────────────────────────────

/** Löscht alle Records einer Collection für eine Moschee (parallel). */
async function deleteAllFor(pb: PocketBase, collection: string, mosqueId: string): Promise<number> {
  try {
    const items = await pb.collection(collection).getFullList({ filter: `mosque_id = "${mosqueId}"`, fields: "id", batch: 500 });
    await Promise.all(items.map((r) => pb.collection(collection).delete(r.id).catch(() => null)));
    return items.length;
  } catch { return 0; }
}

/** Erstellt viele Records in parallelen Chunks. */
async function batchCreate(pb: PocketBase, collection: string, items: Record<string, unknown>[], chunkSize = 15): Promise<number> {
  let created = 0;
  for (let i = 0; i < items.length; i += chunkSize) {
    const results = await Promise.allSettled(items.slice(i, i + chunkSize).map((item) => pb.collection(collection).create(item)));
    created += results.filter((r) => r.status === "fulfilled").length;
  }
  return created;
}

/** Findet einen Record oder erstellt ihn (nur für Users, die nicht gelöscht werden). */
async function findOrCreate(pb: PocketBase, collection: string, filter: string, data: Record<string, unknown>): Promise<{ id: string }> {
  try {
    const result = await pb.collection(collection).getList(1, 1, { filter });
    if (result.items.length > 0) return { id: result.items[0].id };
  } catch { /* fall through */ }
  const record = await pb.collection(collection).create(data);
  return { id: record.id };
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
  { first: "Fatima",   last: "Yilmaz",    dob: (y: number) => `${y-9}-03-15`,  g: "female", fa: "Mehmet Yilmaz",    fp: "+49 151 11223344", mo: "Ayse Yilmaz",      mp: "+49 151 11223345" },
  { first: "Musa",     last: "Kaya",      dob: (y: number) => `${y-10}-06-20`, g: "male",   fa: "Hasan Kaya",       fp: "+49 152 22334455", mo: "Ayse Kaya",        mp: "+49 152 22334456" },
  { first: "Elif",     last: "Demir",     dob: (y: number) => `${y-9}-09-10`,  g: "female", fa: "Mustafa Demir",    fp: "+49 153 33445566", mo: "Hatice Demir",     mp: "+49 153 33445567" },
  { first: "Ibrahim",  last: "Celik",     dob: (y: number) => `${y-11}-11-05`, g: "male",   fa: "Abdullah Celik",   fp: "+49 155 55667788", mo: "Fatma Celik",      mp: "+49 155 55667789" },
  { first: "Zeynep",   last: "Arslan",    dob: (y: number) => `${y-8}-02-28`,  g: "female", fa: "Recep Arslan",     fp: "+49 154 44556677", mo: "Fatma Arslan",     mp: "+49 154 44556678" },
  { first: "Ali",      last: "Sahin",     dob: (y: number) => `${y-10}-07-12`, g: "male",   fa: "Mehmet Sahin",     fp: "+49 156 66778899", mo: "Hatice Sahin",     mp: "+49 156 66778900" },
  { first: "Hatice",   last: "Ozturk",    dob: (y: number) => `${y-9}-04-22`,  g: "female", fa: "Hasan Ozturk",    fp: "+49 157 77889900", mo: "Nalan Ozturk",     mp: "+49 157 77889901" },
  { first: "Yusuf",    last: "Kurt",      dob: (y: number) => `${y-11}-08-30`, g: "male",   fa: "Kemal Kurt",       fp: "+49 158 88990011", mo: "Nalan Kurt",       mp: "+49 158 88990012" },
  { first: "Merve",    last: "Polat",     dob: (y: number) => `${y-8}-01-14`,  g: "female", fa: "Ali Polat",        fp: "+49 159 99001122", mo: "Zeynep Polat",     mp: "+49 159 99001123" },
  { first: "Osman",    last: "Yildiz",    dob: (y: number) => `${y-10}-10-08`, g: "male",   fa: "Kadir Yildiz",     fp: "+49 160 00112233", mo: "Zeynep Yildiz",    mp: "+49 160 00112234" },
  { first: "Safiye",   last: "Müller",    dob: (y: number) => `${y-9}-05-17`,  g: "female", fa: "Hans Müller",      fp: "+49 161 11223345", mo: "Sabine Müller",    mp: "+49 161 11223346" },
  { first: "Davut",    last: "Fischer",   dob: (y: number) => `${y-10}-12-03`, g: "male",   fa: "Klaus Fischer",    fp: "+49 162 22334456", mo: "Sabine Fischer",   mp: "+49 162 22334457" },
  { first: "Rümeysa",  last: "Wagner",    dob: (y: number) => `${y-8}-07-25`,  g: "female", fa: "Klaus Wagner",     fp: "+49 163 33445567", mo: "Maria Wagner",     mp: "+49 163 33445568" },
  { first: "Burak",    last: "Schmitt",   dob: (y: number) => `${y-11}-03-11`, g: "male",   fa: "Thomas Schmitt",   fp: "+49 164 44556678", mo: "Maria Schmitt",    mp: "+49 164 44556679" },
  { first: "Nisa",     last: "Al-Hassan", dob: (y: number) => `${y-9}-09-29`,  g: "female", fa: "Ahmed Al-Hassan",  fp: "+49 166 66778890", mo: "Sara Al-Hassan",   mp: "+49 166 66778891" },
  { first: "Tariq",    last: "Ibrahim",   dob: (y: number) => `${y-10}-06-07`, g: "male",   fa: "Omar Ibrahim",     fp: "+49 167 77889901", mo: "Sara Ibrahim",     mp: "+49 167 77889902" },
  { first: "Meryem",   last: "Khalil",    dob: (y: number) => `${y-8}-11-18`,  g: "female", fa: "Omar Khalil",      fp: "+49 168 88990012", mo: "Leila Khalil",     mp: "+49 168 88990013" },
  { first: "Suleiman", last: "Becker",    dob: (y: number) => `${y-11}-04-02`, g: "male",   fa: "Thomas Becker",    fp: "+49 165 55667789", mo: "Maria Becker",     mp: "+49 165 55667790" },
  { first: "Esra",     last: "Hoffmann",  dob: (y: number) => `${y-9}-08-14`,  g: "female", fa: "Daniel Hoffmann",  fp: "+49 170 00112234", mo: "Leila Hoffmann",   mp: "+49 170 00112235" },
  { first: "Hamza",    last: "Mansouri",  dob: (y: number) => `${y-10}-01-21`, g: "male",   fa: "Omar Mansouri",    fp: "+49 169 99001123", mo: "Leila Mansouri",   mp: "+49 169 99001124" },
];

const ATTENDANCE_MATRIX = [
  ["present","present","late",   "present","absent", "present","excused","present","present","absent" ],
  ["present","absent", "present","present","present","present","present","absent", "present","absent" ],
  ["present","present","present","absent", "present","present","present","absent", "late",   "present"],
  ["present","present","absent", "present","present","late",   "present","present","present","present"],
  ["absent", "present","present","present","present","present","absent", "present","present","present"],
  ["present","present","present","present","late",   "present","present","present","absent", "present"],
];

// 0 = nicht bewertet; nur für Schüler die in ATTENDANCE_MATRIX present/late sind
const PERFORMANCE_MATRIX = [
  [5, 4, 0, 5, 0, 4, 0, 5, 4, 0],
  [4, 0, 5, 4, 4, 5, 3, 0, 4, 0],
  [5, 5, 4, 0, 3, 4, 5, 0, 0, 4],
  [4, 3, 0, 5, 4, 0, 4, 5, 5, 3],
  [0, 4, 5, 4, 3, 5, 0, 4, 4, 5],
  [5, 4, 3, 5, 0, 4, 5, 3, 0, 4],
];

const FEE_PATTERNS = [
  [{ s:"paid",m:"cash"    },{ s:"paid",m:"cash"     },{ s:"open",  m:""       }],
  [{ s:"paid",m:"transfer"},{ s:"open",m:""         },{ s:"open",  m:""       }],
  [{ s:"paid",m:"cash"    },{ s:"paid",m:"transfer" },{ s:"paid",  m:"cash"   }],
  [{ s:"waived",m:"waived"},{ s:"waived",m:"waived" },{ s:"open",  m:""       }],
  [{ s:"paid",m:"cash"    },{ s:"open",m:""         },{ s:"open",  m:""       }],
  [{ s:"paid",m:"cash"    },{ s:"paid",m:"cash"     },{ s:"paid",  m:"cash"   }],
  [{ s:"waived",m:"waived"},{ s:"open",m:""         },{ s:"open",  m:""       }],
  [{ s:"paid",m:"transfer"},{ s:"paid",m:"transfer" },{ s:"open",  m:""       }],
  [{ s:"open",m:""        },{ s:"open",m:""         },{ s:"open",  m:""       }],
  [{ s:"paid",m:"cash"    },{ s:"open",m:""         },{ s:"paid",  m:"cash"   }],
  [{ s:"paid",m:"transfer"},{ s:"paid",m:"cash"     },{ s:"open",  m:""       }],
  [{ s:"paid",m:"cash"    },{ s:"paid",m:"transfer" },{ s:"paid",  m:"transfer"}],
];

const GUEST_DONORS = [
  { name:"Familie Wagner",    email:"wagner@example.de"      },
  { name:"M. Al-Rashid",      email:"alrashid@example.de"    },
  { name:"Karima Bouali",     email:"kbouali@example.de"     },
  { name:"Thomas Richter",    email:"t.richter@example.de"   },
  { name:"Amina Öztürk",      email:"a.ozturk@example.de"    },
  { name:"Stefan Lehmann",    email:"s.lehmann@example.de"   },
  { name:"Nura Hassan",       email:"nhassan@example.de"     },
  { name:"Peter Braun",       email:"p.braun@example.de"     },
  { name:"Yasmin Khalid",     email:"ykhalid@example.de"     },
  { name:"Familie Bergmann",  email:"bergmann@example.de"    },
  { name:"Lukas Schneider",   email:"l.schneider@example.de" },
  { name:"Hira Mahmood",      email:"hmahmood@example.de"    },
  { name:"Cem Erdogan",       email:"c.erdogan@example.de"   },
  { name:"Ingrid Zimmermann", email:"i.zimmer@example.de"    },
  { name:"Jamal Osman",       email:"j.osman@example.de"     },
];

const GUESTS_REG = [
  { name:"Petra Müller",      email:"petra.mueller@gmail.com"    },
  { name:"Lars Hansen",       email:"lars.hansen@web.de"         },
  { name:"Amir Souza",        email:"asouza@hotmail.com"         },
  { name:"Ingrid Köhler",     email:"ingrid.koehler@t-online.de" },
  { name:"Kareem Nasser",     email:"k.nasser@gmx.de"            },
  { name:"Claudia Braun",     email:"c.braun@yahoo.de"           },
  { name:"Tobias Richter",    email:"t.richter@outlook.com"      },
  { name:"Samira Boulou",     email:"s.boulou@gmail.com"         },
  { name:"Michael Seifert",   email:"m.seifert@web.de"           },
  { name:"Fatou Diallo",      email:"f.diallo@gmail.com"         },
  { name:"Georg Werner",      email:"g.werner@t-online.de"       },
  { name:"Nadia Hamdan",      email:"n.hamdan@gmx.de"            },
  { name:"Familie Schreiber", email:"schreiber.family@yahoo.de"  },
  { name:"Yilmaz Ailesi",     email:"yilmaz.aile@hotmail.com"    },
  { name:"René Hoffmann",     email:"r.hoffmann@gmail.com"       },
];

// ─── Seed-Funktionen (nach Cleanup: direkte Creates, kein findOrCreate) ───────

async function seedUsers(pb: PocketBase, mosqueId: string) {
  const staffDefs = [
    { email:"demo-admin@moschee.app",    first:"Admin",   last:"Demo",    role:"admin",   no:"DEMO-001", phone:"+49 30 100001", address:"Verwaltung, 10115 Berlin" },
    { email:"demo-imam@moschee.app",     first:"Musa",    last:"Al-Amin", role:"imam",    no:"DEMO-002", phone:"+49 30 100002", address:"Moscheestraße 1, 10115 Berlin" },
    { email:"demo-imam2@moschee.app",    first:"Yusuf",   last:"Rahman",  role:"imam",    no:"DEMO-003", phone:"+49 30 100003", address:"Moscheestraße 1, 10115 Berlin" },
    { email:"demo-teacher@moschee.app",  first:"Aisha",   last:"Karimi",  role:"teacher", no:"DEMO-010", phone:"+49 30 100010", address:"Lehrerpfad 5, 10117 Berlin" },
    { email:"demo-teacher2@moschee.app", first:"Yasemin", last:"Demir",   role:"teacher", no:"DEMO-011", phone:"+49 30 100011", address:"Lehrerpfad 6, 10117 Berlin" },
    { email:"demo-teacher3@moschee.app", first:"Bilal",   last:"Hassan",  role:"teacher", no:"DEMO-012", phone:"+49 30 100012", address:"Lehrerpfad 7, 10117 Berlin" },
  ];

  const ids: Record<string, string> = {};
  for (const u of staffDefs) {
    const { id } = await findOrCreate(pb, "users", `email = "${u.email}"`, {
      email: u.email, password: DEMO_PASSWORD, passwordConfirm: DEMO_PASSWORD,
      emailVisibility: true, first_name: u.first, last_name: u.last,
      full_name: `${u.first} ${u.last}`, mosque_id: mosqueId, role: u.role,
      status: "active", member_no: u.no, membership_number: u.no,
      phone: u.phone, address: u.address,
    });
    const key = u.role === "admin" ? "admin"
      : u.role === "imam" && !ids["imam"] ? "imam"
      : u.role === "imam" ? "imam2"
      : u.role === "teacher" && !ids["teacher1"] ? "teacher1"
      : u.role === "teacher" && !ids["teacher2"] ? "teacher2" : "teacher3";
    ids[key] = id;
  }

  const cy = new Date().getFullYear();
  const memberIds: string[] = [];
  // Mitglieder parallel erstellen
  const memberResults = await Promise.all(
    MEMBER_DATA.map((m, i) => {
      const no = i + 1;
      const email = `demo-member-${String(no).padStart(2, "0")}@moschee.app`;
      return findOrCreate(pb, "users", `email = "${email}"`, {
        email, password: DEMO_PASSWORD, passwordConfirm: DEMO_PASSWORD,
        emailVisibility: true, first_name: m.first, last_name: m.last,
        full_name: `${m.first} ${m.last}`, mosque_id: mosqueId, role: "member",
        status: "active", member_no: `DEMO-${100 + no}`, membership_number: `DEMO-${100 + no}`,
        phone: m.phone, address: m.address,
      });
    })
  );
  memberResults.forEach(({ id }) => memberIds.push(id));

  return { admin: ids["admin"], imam: ids["imam"], imam2: ids["imam2"],
           teacher1: ids["teacher1"], teacher2: ids["teacher2"], teacher3: ids["teacher3"],
           memberIds };
}

async function seedTeamMembers(pb: PocketBase, mosqueId: string): Promise<number> {
  const items = [
    { name:"Musa Al-Amin",     role:"Imam",             bio:"Imam der Gemeinde seit über 15 Jahren.",                                           group:"Vorstand", sort_order:1 },
    { name:"Dr. Ahmet Yilmaz", role:"1. Vorsitzender",  bio:"Promovierter Ingenieur und ehrenamtlicher Vorsitzender seit 2018.",               group:"Vorstand", sort_order:2 },
    { name:"Ibrahim Kaya",     role:"Kassenwart",        bio:"Diplom-Kaufmann, verantwortlich für die Finanzen der Gemeinde.",                  group:"Vorstand", sort_order:3 },
    { name:"Fatima Demir",     role:"Jugendleiterin",    bio:"Sozialarbeiterin und Leiterin der Jugendgruppe.",                                 group:"Jugend",   sort_order:4 },
    { name:"Zeynep Arslan",    role:"Frauenbeauftragte", bio:"Lehrerin und Koordinatorin der Frauengruppe.",                                    group:"Soziales", sort_order:5 },
    { name:"Mehmet Celik",     role:"IT & Medien",       bio:"Softwareentwickler, zuständig für die digitale Infrastruktur der Gemeinde.",      group:"Technik",  sort_order:6 },
  ].map((t) => ({ ...t, mosque_id: mosqueId, is_active: true }));
  return await batchCreate(pb, "team_members", items);
}

async function seedAcademicYears(pb: PocketBase, mosqueId: string) {
  const now = new Date();
  const cy = now.getFullYear();
  const isSecondHalf = now.getMonth() >= 8;
  const aS = isSecondHalf ? cy : cy - 1, aE = isSecondHalf ? cy + 1 : cy;
  const rS = aS - 1, rE = aE - 1;
  const [archived, active] = await Promise.all([
    pb.collection("academic_years").create({ mosque_id: mosqueId, name: `${rS}/${String(rE).slice(-2)}`, start_date: `${rS}-09-01`, end_date: `${rE}-07-31`, status: "archived" }),
    pb.collection("academic_years").create({ mosque_id: mosqueId, name: `${aS}/${String(aE).slice(-2)}`, start_date: `${aS}-09-01`, end_date: `${aE}-07-31`, status: "active"   }),
  ]);
  return { active: active.id, archived: archived.id };
}

async function seedCourses(pb: PocketBase, mosqueId: string, yearIds: { active: string; archived: string }, t: { teacher1: string; teacher2: string; teacher3: string }) {
  const defs = [
    { title:"Quran für Anfänger",     desc:"Grundlagen der Quran-Rezitation für Kinder im Alter von 6–10 Jahren.",    cat:"quran",   lv:"beginner",     yr:yearIds.active,   tea:t.teacher1, day:"saturday", s:"10:00", e:"11:30", room:"Unterrichtsraum 1", max:20, st:"active"   },
    { title:"Quran Fortgeschrittene", desc:"Vertiefende Quran-Rezitation — eigenständige Rezitation längerer Suren.", cat:"quran",   lv:"intermediate", yr:yearIds.active,   tea:t.teacher1, day:"sunday",   s:"10:00", e:"11:30", room:"Unterrichtsraum 1", max:15, st:"active"   },
    { title:"Arabisch-Kurs A1",       desc:"Arabisch für Anfänger — Grundwortschatz und einfache Satzstrukturen.",    cat:"arabic",  lv:"beginner",     yr:yearIds.active,   tea:t.teacher2, day:"saturday", s:"14:00", e:"15:30", room:"Seminarraum",       max:18, st:"active"   },
    { title:"Islamkunde & Sira",      desc:"Geschichte des Propheten (ﷺ) und Grundlagen des islamischen Glaubens.",   cat:"sira",    lv:"mixed",        yr:yearIds.active,   tea:t.teacher3, day:"sunday",   s:"14:00", e:"15:30", room:"Seminarraum",       max:25, st:"active"   },
    { title:"Tajweed-Kurs",           desc:"Regeln der korrekten Quran-Rezitation — Archivkurs des Vorjahres.",       cat:"tajweed", lv:"intermediate", yr:yearIds.archived, tea:t.teacher2, day:"saturday", s:"10:00", e:"11:30", room:"Unterrichtsraum 2", max:12, st:"archived" },
  ];
  const records = await Promise.all(defs.map((c) =>
    pb.collection("courses").create({ mosque_id: mosqueId, title: c.title, description: c.desc, category: c.cat, level: c.lv, academic_year_id: c.yr, teacher_id: c.tea, created_by: c.tea, day_of_week: c.day, start_time: c.s, end_time: c.e, location_name: c.room, max_students: c.max, status: c.st })
  ));
  return records.map((r) => r.id);
}

async function seedStudents(pb: PocketBase, mosqueId: string): Promise<string[]> {
  const cy = new Date().getFullYear();
  const records = await Promise.all(
    STUDENT_DATA.map((s) =>
      pb.collection("students").create({
        mosque_id: mosqueId, first_name: s.first, last_name: s.last,
        date_of_birth: s.dob(cy), gender: s.g,
        father_name: s.fa, father_phone: s.fp, mother_name: s.mo, mother_phone: s.mp,
        parent_name: s.fa, parent_phone: s.fp,
        address: "Berlin", school_name: "Grundschule Berlin-Mitte", school_class: "",
        health_notes: "", status: "active", membership_status: "none",
        whatsapp_contact: "both", notes: "",
      })
    )
  );
  return records.map((r) => r.id);
}

async function seedEnrollments(pb: PocketBase, mosqueId: string, courseIds: string[], studentIds: string[]): Promise<number> {
  const assignments = [
    { cIdx:0, sRange:[0,9],  status:"enrolled"  },
    { cIdx:1, sRange:[5,13], status:"enrolled"  },
    { cIdx:2, sRange:[10,17],status:"enrolled"  },
    { cIdx:3, sRange:[2,11], status:"enrolled"  },
    { cIdx:4, sRange:[0,5],  status:"completed" },
  ];
  const items: Record<string, unknown>[] = [];
  for (const { cIdx, sRange, status } of assignments) {
    for (let i = sRange[0]; i <= sRange[1]; i++) {
      items.push({ mosque_id: mosqueId, course_id: courseIds[cIdx], student_id: studentIds[i], status, enrolled_at: isoDateTime(daysAgo(150)), completed_at: status === "completed" ? isoDateTime(daysAgo(30)) : "", notes: "" });
    }
  }
  return await batchCreate(pb, "course_enrollments", items);
}

async function seedAttendance(pb: PocketBase, mosqueId: string, courseId: string, studentIds: string[], teacherId: string): Promise<number> {
  const sessions = [42,35,28,21,14,7].map(daysAgo).map(isoDate);
  const firstTen = studentIds.slice(0, 10);
  const NOTES: Record<string,string> = { excused:"Krankheitsbedingt entschuldigt.", late:"Ca. 10–15 Minuten zu spät erschienen." };
  const items: Record<string,unknown>[] = [];
  for (let si = 0; si < sessions.length; si++)
    for (let ki = 0; ki < firstTen.length; ki++) {
      const status = ATTENDANCE_MATRIX[si][ki];
      const perfRaw = PERFORMANCE_MATRIX[si][ki];
      const canHavePerf = status === "present" || status === "late";
      const performance = canHavePerf && perfRaw > 0 ? perfRaw : undefined;
      items.push({ mosque_id: mosqueId, course_id: courseId, student_id: firstTen[ki], session_date: sessions[si], status, notes: NOTES[status] ?? "", marked_by: teacherId, ...(performance != null ? { performance } : {}) });
    }
  return await batchCreate(pb, "attendance", items);
}

async function seedParentChildRelations(
  pb: PocketBase,
  mosqueId: string,
  users: { admin: string; memberIds: string[] },
  studentIds: string[]
): Promise<number> {
  // Geschwister-Gruppen für Gebühren-Demo:
  // member[0]: 3 Kinder (rank 1, 2, 3) — zeigt alle Rabattstufen
  // member[1]: 1 Kind (rank 1)
  // member[2]: 2 Kinder (rank 1, 2)
  // Alle übrigen: 1 Kind je Elternteil
  const links = [
    // ── Geschwister-Gruppe 1: 3 Kinder (alle Rabattstufen sichtbar) ─────────
    { parent: users.memberIds[0],  student: studentIds[0]  },  // Mehmet Yilmaz → Fatima (rank 1)
    { parent: users.memberIds[0],  student: studentIds[1]  },  // Mehmet Yilmaz → Musa (rank 2, -20%)
    { parent: users.memberIds[0],  student: studentIds[2]  },  // Mehmet Yilmaz → Elif (rank 3, -30%)
    // ── Geschwister-Gruppe 2: 2 Kinder ──────────────────────────────────────
    { parent: users.memberIds[2],  student: studentIds[4]  },  // Mustafa Demir → Zeynep (rank 1)
    { parent: users.memberIds[2],  student: studentIds[5]  },  // Mustafa Demir → Ali (rank 2, -20%)
    // ── Einzelkinder ────────────────────────────────────────────────────────
    { parent: users.memberIds[1],  student: studentIds[3]  },  // Ayse Kaya      → Ibrahim (rank 1)
    { parent: users.memberIds[4],  student: studentIds[6]  },  // Abdullah Celik → Hatice
    { parent: users.memberIds[5],  student: studentIds[7]  },  // Hatice Sahin   → Yusuf
    { parent: users.memberIds[6],  student: studentIds[8]  },  // Hasan Ozturk   → Merve
    { parent: users.memberIds[7],  student: studentIds[9]  },  // Nalan Kurt     → Osman
    { parent: users.memberIds[8],  student: studentIds[10] },  // Ali Polat      → Safiye
    { parent: users.memberIds[9],  student: studentIds[11] },  // Zeynep Yildiz  → Davut
    { parent: users.memberIds[10], student: studentIds[12] },  // Hans Müller    → Rümeysa
    { parent: users.memberIds[14], student: studentIds[17] },  // Thomas Becker  → Suleiman
    { parent: users.memberIds[15], student: studentIds[14] },  // Ahmed Al-Hassan→ Nisa
    { parent: users.memberIds[16], student: studentIds[15] },  // Sara Ibrahim   → Tariq
    { parent: users.memberIds[17], student: studentIds[16] },  // Omar Khalil    → Meryem
    { parent: users.memberIds[18], student: studentIds[19] },  // Leila Mansouri → Hamza
    { parent: users.memberIds[19], student: studentIds[18] },  // Daniel Hoffmann→ Esra
  ].filter((l) => l.parent && l.student);
  const items = links.map((l) => ({ mosque_id: mosqueId, parent_user: l.parent, student: l.student }));
  return await batchCreate(pb, "parent_child_relations", items);
}

async function seedStudentFees(pb: PocketBase, mosqueId: string, studentIds: string[], adminId: string): Promise<number> {
  const months = [monthKey(monthsAgo(2)), monthKey(monthsAgo(1)), monthKey(new Date())];
  const FEE_CENTS = 1500;
  const DISCOUNT_2ND = 20; // %
  const DISCOUNT_3RD = 30; // %
  // Geschwister-Rang passend zu seedParentChildRelations:
  // member[0]: Kinder idx 0(rank1), 1(rank2), 2(rank3) | member[1]: idx 3(rank1)
  // member[2]: Kinder idx 4(rank1), 5(rank2) | Reste: rank 1
  const DEMO_RANKS = [1, 2, 3, 1, 1, 2, 1, 1, 1, 1, 1, 1];
  const items: Record<string,unknown>[] = [];
  studentIds.slice(0, 12).forEach((sid, ki) =>
    months.forEach((mk, mi) => {
      const { s: status, m: method } = FEE_PATTERNS[ki][mi];
      const rank = DEMO_RANKS[ki] ?? 1;
      let finalAmount = FEE_CENTS;
      if (rank === 2) finalAmount = Math.round(FEE_CENTS * (1 - DISCOUNT_2ND / 100));
      else if (rank >= 3) finalAmount = Math.round(FEE_CENTS * (1 - DISCOUNT_3RD / 100));
      const discountApplied = FEE_CENTS - finalAmount;
      items.push({
        mosque_id: mosqueId, student_id: sid, month_key: mk,
        amount_cents: finalAmount,
        discount_applied_cents: discountApplied,
        sibling_rank: rank,
        status, payment_method: method,
        paid_at: status === "paid" ? `${mk}-15 12:00:00.000Z` : "",
        notes: status === "waived" ? "Soziale Ermäßigung gewährt." : "",
        provider_ref: "", created_by: adminId,
      });
    })
  );
  return await batchCreate(pb, "student_fees", items);
}

async function seedPosts(pb: PocketBase, mosqueId: string, adminId: string): Promise<number> {
  const posts = [
    { title:"Willkommen beim Demo-Portal",              content:"Dies ist eine Demonstration von moschee.app — der digitalen Verwaltungslösung für Moscheen. Alle Funktionen können hier ausprobiert werden.",           cat:"announcement", vis:"public",  st:"published", pinned:true,  d:30 },
    { title:"Ramadan Mubarak — Gebetszeiten & Programm", content:"Wir wünschen unserer Gemeinschaft einen gesegneten Ramadan! Gebetszeiten und das Programm mit Tarawih und Iftar-Veranstaltungen finden Sie hier.",     cat:"announcement", vis:"public",  st:"published", pinned:true,  d:25 },
    { title:"Neue Arabisch-Kurse ab Herbst",             content:"Neue Arabisch-Kurse für alle Altersgruppen — Anfänger und Fortgeschrittene. Anmeldungen ab sofort möglich.",                                           cat:"general",      vis:"public",  st:"published", pinned:false, d:20 },
    { title:"Spendenkampagne: Neue Waschräume 2025",     content:"Unsere Gemeinde benötigt renovierte Waschräume. Helfen Sie uns, dieses wichtige Projekt zu verwirklichen!",                                             cat:"campaign",     vis:"public",  st:"published", pinned:false, d:18 },
    { title:"Freitagspredigt: Geduld und Dankbarkeit",   content:"Die Predigt behandelte Geduld (Sabr) und Dankbarkeit (Shukr). Eine Zusammenfassung wird in Kürze veröffentlicht.",                                     cat:"general",      vis:"public",  st:"published", pinned:false, d:12 },
    { title:'Jugend-Workshop "Islam in Deutschland"',    content:"Über 30 Teilnehmer diskutierten Identität, gesellschaftliche Teilhabe und den Umgang mit Vorurteilen. Ein voller Erfolg!",                              cat:"youth",        vis:"public",  st:"published", pinned:false, d:7  },
    { title:"Gemeinde-Newsletter",                       content:"Fortschritte bei der Waschraum-Renovierung, kommende Veranstaltungen und Ergebnisse der letzten Mitgliederversammlung.",                                cat:"general",      vis:"members", st:"published", pinned:false, d:3  },
    { title:"Einladung zum Iftar-Abend",                 content:"Herzliche Einladung zum gemeinsamen Iftar nächsten Freitag — für Mitglieder und Gäste. Bitte anmelden.",                                               cat:"event",        vis:"public",  st:"published", pinned:false, d:1  },
    { title:"Ankündigung: Großes Gemeindefest",          content:"Unser diesjähriges Gemeindefest — Kinderprogramm, Basare, Vorträge. Details folgen.",                                                                   cat:"announcement", vis:"public",  st:"draft",     pinned:false, d:0  },
  ];
  const items = posts.map((p) => ({ mosque_id: mosqueId, title: p.title, content: p.content, category: p.cat, visibility: p.vis, status: p.st, pinned: p.pinned, published_at: p.st === "published" ? isoDateTime(daysAgo(p.d)) : "", created_by: adminId }));
  return await batchCreate(pb, "posts", items);
}

async function seedEvents(pb: PocketBase, mosqueId: string, adminId: string) {
  const addH = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000);
  const defs = [
    { title:"Freitagsgebet — vorletzter Freitag",  desc:"Wöchentliches Freitagsgebet mit Khutba.", cat:"other",     vis:"public",  cap:0,   off:-14, h:1.5, loc:"Hauptgebetsraum" },
    { title:"Ramadan-Abschlussfeier",               desc:"Feier zum Ende des Ramadan mit Leckereien, Vorträgen und Kinderprogramm.", cat:"community", vis:"public",  cap:100, off:-21, h:3,   loc:"Gemeinschaftssaal" },
    { title:"Arabisch-Intensivkurs",                desc:"Eintägiger Intensivkurs Arabisch für Anfänger.",                          cat:"lecture",   vis:"public",  cap:20,  off:-10, h:5,   loc:"Seminarraum" },
    { title:"Freitagsgebet — letzter Freitag",      desc:"Wöchentliches Freitagsgebet mit Khutba.", cat:"other",     vis:"public",  cap:0,   off:-7,  h:1.5, loc:"Hauptgebetsraum" },
    { title:"Jugend-Ausflug Kletterpark",            desc:"Gemeinsamer Ausflug der Jugendgruppe in den Kletterpark. Anmeldung erforderlich.", cat:"youth", vis:"members", cap:30, off:-5, h:4, loc:"Kletterpark Berlin-Mitte" },
    { title:"Familientag der Gemeinde",              desc:"Familientag mit Kinderprogramm, Hüpfburg, Basarständen und Mittagessen.", cat:"community", vis:"public",  cap:80,  off:1,   h:5,   loc:"Gemeinschaftssaal und Innenhof" },
    { title:"Freitagsgebet — nächste Woche",         desc:"Wöchentliches Freitagsgebet mit Khutba.", cat:"other",     vis:"public",  cap:0,   off:3,   h:1.5, loc:"Hauptgebetsraum" },
    { title:"Vorlesung: Geschichte des Islam",       desc:"Wissenschaftlicher Vortrag für alle Altersgruppen.",                     cat:"lecture",   vis:"public",  cap:50,  off:5,   h:2,   loc:"Hauptgebetsraum" },
    { title:"Spendenabend: Neue Waschräume",         desc:"Abend zur Unterstützung der Waschraum-Renovierung.",                    cat:"community", vis:"public",  cap:60,  off:8,   h:2.5, loc:"Gemeinschaftssaal" },
    { title:"Madrasa Elternsprechtag",               desc:"Bitte vorab Termin mit dem jeweiligen Lehrer vereinbaren.",             cat:"other",     vis:"members", cap:0,   off:12,  h:3,   loc:"Unterrichtsräume" },
    { title:"Sommerfest der Gemeinde",               desc:"Großes Sommerfest mit Musik, Essen, Spielen und Abendprogramm.",        cat:"community", vis:"public",  cap:200, off:21,  h:6,   loc:"Gemeinschaftssaal und Garten" },
    { title:"Benefizauktion für die Renovierung",    desc:"Benefizauktion — alle Einnahmen fließen in die Renovierung.",           cat:"community", vis:"public",  cap:0,   off:35,  h:3,   loc:"Hauptgebetsraum" },
  ];
  const records = await Promise.all(defs.map((e) => {
    const start = e.off >= 0 ? daysFromNow(e.off) : daysAgo(-e.off);
    start.setHours(e.off < 0 ? 19 : 14, 0, 0, 0);
    if (e.cat === "other") start.setHours(12, 30, 0, 0);
    return pb.collection("events").create({ mosque_id: mosqueId, title: e.title, description: e.desc, category: e.cat, location_name: e.loc, start_at: isoDateTime(start), end_at: isoDateTime(addH(start, e.h)), duration_minutes: Math.round(e.h * 60), visibility: e.vis, capacity: e.cap, status: e.title.includes("Benefizauktion") ? "draft" : "published", is_recurring: false, created_by: adminId });
  }));
  return records.map((r, i) => ({ id: r.id, daysOff: defs[i].off, category: defs[i].cat, title: defs[i].title }));
}

async function seedEventRegistrations(pb: PocketBase, mosqueId: string, events: { id: string; daysOff: number; category: string; title: string }[], memberIds: string[]): Promise<number> {
  const CONFIGS: Record<string, { count: [number, number]; memberPct: number }> = {
    other: { count:[8,12],  memberPct:0.8 }, lecture: { count:[15,22], memberPct:0.7 },
    community: { count:[25,35], memberPct:0.4 }, youth: { count:[8,12], memberPct:1.0 }, campaign: { count:[18,25], memberPct:0.5 },
  };
  const items: Record<string,unknown>[] = [];
  for (const event of events) {
    const isPast = event.daysOff < 0, isToday = event.daysOff === 0 || event.daysOff === 1;
    const key = event.title.includes("Spendenabend") ? "campaign" : (CONFIGS[event.category] ? event.category : "other");
    const cfg = CONFIGS[key];
    const target = isPast || isToday ? Math.floor(Math.random() * (cfg.count[1]-cfg.count[0]+1)) + cfg.count[0] : Math.min(5, memberIds.length);
    const mCount = Math.round(target * cfg.memberPct);
    const gCount = target - mCount;
    const shuffled = [...memberIds].sort(() => Math.random()-0.5).slice(0, mCount);
    for (const userId of shuffled) {
      const st = isPast ? (Math.random()<0.7?"attended":Math.random()<0.5?"registered":"no_show") : "registered";
      items.push({ mosque_id:mosqueId, event_id:event.id, registrant_type:"member", user_id:userId, guest_name:"", guest_email:"", status:st, registered_at:isoDateTime(daysAgo(isPast?Math.abs(event.daysOff)+2+Math.floor(Math.random()*5):1)) });
    }
    if (cfg.memberPct < 1.0) {
      [...GUESTS_REG].sort(() => Math.random()-0.5).slice(0, gCount).forEach((g) => {
        const st = isPast ? (Math.random()<0.65?"attended":Math.random()<0.5?"registered":"no_show") : "registered";
        items.push({ mosque_id:mosqueId, event_id:event.id, registrant_type:"guest", user_id:"", guest_name:g.name, guest_email:g.email, status:st, registered_at:isoDateTime(daysAgo(isPast?Math.abs(event.daysOff)+1+Math.floor(Math.random()*3):0)) });
      });
    }
  }
  return await batchCreate(pb, "event_registrations", items, 20);
}

async function seedCampaigns(pb: PocketBase, mosqueId: string, adminId: string): Promise<string[]> {
  const defs = [
    { title:"Moschee-Renovierung",     desc:"Umfassende Renovierung — dank großzügiger Unterstützung erfolgreich abgeschlossen.",     cat:"construction", goal:1_500_000, start:isoDateTime(daysAgo(180)), end:isoDateTime(daysAgo(30)),      st:"completed" },
    { title:"Neue Waschräume",         desc:"Unsere Waschräume sind veraltet. Helfen Sie uns bei der Renovierung!",                   cat:"maintenance",  goal:  800_000, start:isoDateTime(daysAgo(45)),  end:isoDateTime(daysFromNow(60)),  st:"active"    },
    { title:"Kinderspielplatz Projekt", desc:"Einen sicheren Spielplatz im Innenhof für die Jüngsten unserer Gemeinde schenken.",     cat:"general",      goal:  500_000, start:isoDateTime(daysAgo(10)),  end:isoDateTime(daysFromNow(90)), st:"active"    },
  ];
  const records = await Promise.all(defs.map((c) =>
    pb.collection("campaigns").create({ mosque_id:mosqueId, title:c.title, description:c.desc, category:c.cat, type:"general", visibility:"public", goal_amount_cents:c.goal, start_at:c.start, end_at:c.end, status:c.st, currency:"EUR", created_by:adminId })
  ));
  return records.map((r) => r.id);
}

async function seedDonations(pb: PocketBase, mosqueId: string, campaignIds: string[], memberIds: string[]): Promise<number> {
  const PROVIDERS = ["manual","stripe","paypal_link"];
  const sets = [
    { cIdx:0, count:15, range:[180,32] as [number,number], amounts:[10000,25000,50000,100000,5000,50000,25000,10000,100000,50000,25000,50000,100000,25000,50000] },
    { cIdx:1, count:12, range:[40,2]   as [number,number], amounts:[25000,10000,50000,5000,25000,50000,10000,25000,100000,25000,5000,50000] },
    { cIdx:2, count:5,  range:[9,1]    as [number,number], amounts:[10000,5000,25000,5000,10000] },
  ];
  const items: Record<string,unknown>[] = [];
  for (const set of sets) {
    for (let i = 0; i < set.count; i++) {
      const isMember = i%3===0 && memberIds.length>0;
      const gi = (i*7)%GUEST_DONORS.length, mi = (i*3)%memberIds.length;
      const dbo = set.range[0] - Math.floor((set.range[0]-set.range[1])*i/(set.count-1));
      items.push({ mosque_id:mosqueId, campaign_id:campaignIds[set.cIdx], donor_type:isMember?"member":"guest", user_id:isMember?memberIds[mi]:"", donor_name:isMember?`${MEMBER_DATA[mi%MEMBER_DATA.length].first} ${MEMBER_DATA[mi%MEMBER_DATA.length].last}`:GUEST_DONORS[gi].name, donor_email:isMember?`demo-member-${String(mi+1).padStart(2,"0")}@moschee.app`:GUEST_DONORS[gi].email, amount_cents:set.amounts[i], amount:set.amounts[i]/100, currency:"EUR", is_recurring:false, provider:PROVIDERS[i%PROVIDERS.length], provider_ref:"", status:"paid", paid_at:isoDateTime(daysAgo(dbo)) });
    }
  }
  return await batchCreate(pb, "donations", items, 15);
}

async function seedSponsors(pb: PocketBase, mosqueId: string): Promise<number> {
  const items = [
    { name:"Halal Supermarkt Berlin", category:"gold",   website:"https://example.de", description:"Ihr lokaler Halal-Supermarkt.", start_date:isoDate(daysAgo(180)), end_date:isoDate(daysFromNow(185)), status:"active", notification_sent:false },
    { name:"Islamischer Buchhandel",  category:"silver", website:"https://example.de", description:"Bücher und islamische Geschenkartikel.",  start_date:isoDate(daysAgo(90)),  end_date:isoDate(daysFromNow(5)),   status:"active", notification_sent:true  },
    { name:"Arabische Bäckerei Mitte",category:"bronze", website:"",                   description:"Frische orientalische Backwaren täglich.", start_date:isoDate(daysAgo(60)),  end_date:isoDate(daysFromNow(30)),  status:"active", notification_sent:false },
  ].map((s) => ({ ...s, mosque_id: mosqueId }));
  return await batchCreate(pb, "sponsors", items);
}

async function seedSettings(pb: PocketBase, mosqueId: string): Promise<void> {
  const data = {
    madrasa_fees_enabled: true,
    madrasa_default_fee_cents: 1500,
    fee_reminder_enabled: false,
    fee_reminder_day: 5,
    sibling_discount_enabled: true,
    sibling_discount_2nd_percent: 20,
    sibling_discount_3rd_percent: 30,
    contact_enabled: true,
    contact_auto_reply: true,
    contact_notify_admin: true,
    prayer_provider: "aladhan",
    prayer_method: 13,
    sponsors_enabled: true,
    sponsors_visibility: "public",
    team_enabled: true,
    team_visibility: "public",
  };
  try {
    const existing = await pb.collection("settings").getFirstListItem(`mosque_id = "${mosqueId}"`);
    await pb.collection("settings").update(existing.id, data);
  } catch {
    await pb.collection("settings").create({ mosque_id: mosqueId, ...data });
  }
}

// ─── Haupt-Export ─────────────────────────────────────────────────────────────

export async function resetDemoData(mosqueId: string): Promise<ResetResult> {
  const started = Date.now();
  const pb = await getAdminPB();

  // ── Schritt 1: Cleanup (parallel pro Collection, FK-Reihenfolge) ──────────
  let deletedCount = 0;
  // Abhängige Collections zuerst löschen
  for (const col of ["contact_messages","parent_child_relations","student_fees","attendance","course_enrollments","students","courses","academic_years","donations","event_registrations","events","campaigns","posts","sponsors","team_members","email_outbox","audit_logs"] as const) {
    deletedCount += await deleteAllFor(pb, col, mosqueId);
  }

  // ── Schritt 2: Reseed (parallele Batch-Creates wo möglich) ────────────────
  let createdCount = 0;

  const users = await seedUsers(pb, mosqueId);
  createdCount += 6 + users.memberIds.length;

  // Settings (Madrasa-Gebühren + Geschwister-Rabatt) sicherstellen
  await seedSettings(pb, mosqueId);

  // Unabhängige Sections parallel starten
  const [teamCount, yearIds] = await Promise.all([
    seedTeamMembers(pb, mosqueId),
    seedAcademicYears(pb, mosqueId),
  ]);
  createdCount += teamCount + 2;

  const courseIds = await seedCourses(pb, mosqueId, yearIds, users);
  createdCount += courseIds.length;

  const studentIds = await seedStudents(pb, mosqueId);
  createdCount += studentIds.length;

  // Unabhängige Madrasa-Sections parallel
  const [enrollCount, attendCount, feesCount, parentChildCount] = await Promise.all([
    seedEnrollments(pb, mosqueId, courseIds, studentIds),
    seedAttendance(pb, mosqueId, courseIds[0], studentIds, users.teacher1),
    seedStudentFees(pb, mosqueId, studentIds, users.admin),
    seedParentChildRelations(pb, mosqueId, users, studentIds),
  ]);
  createdCount += enrollCount + attendCount + feesCount + parentChildCount;

  // Posts, Events und Kampagnen parallel starten
  const [postsCount, events, campaignIds] = await Promise.all([
    seedPosts(pb, mosqueId, users.admin),
    seedEvents(pb, mosqueId, users.admin),
    seedCampaigns(pb, mosqueId, users.admin),
  ]);
  createdCount += postsCount + events.length + campaignIds.length;

  // Event-Registrierungen und Spenden + Sponsoren parallel
  const [regCount, donCount, sponsorCount] = await Promise.all([
    seedEventRegistrations(pb, mosqueId, events, users.memberIds),
    seedDonations(pb, mosqueId, campaignIds, users.memberIds),
    seedSponsors(pb, mosqueId),
  ]);
  createdCount += regCount + donCount + sponsorCount;

  return { deletedCount, createdCount, durationMs: Date.now() - started };
}
