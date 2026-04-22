#!/usr/bin/env node
/**
 * Moschee-Portal V1 - PocketBase Migration Script
 *
 * Liest Zugangsdaten aus .env.local (POCKETBASE_URL / PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD).
 *
 * Nutzung:
 *   node scripts/migrate-v1.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dirname, "../.env.local");
  try {
    const raw = readFileSync(envPath, "utf-8");
    const env = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
    return env;
  } catch {
    return {};
  }
}

const env = loadEnv();
const PB_URL = env.POCKETBASE_URL || env.NEXT_PUBLIC_POCKETBASE_URL;
const ADMIN_EMAIL = env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = env.PB_ADMIN_PASSWORD;

if (!PB_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "Fehler: POCKETBASE_URL, PB_ADMIN_EMAIL und PB_ADMIN_PASSWORD müssen in .env.local gesetzt sein."
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

async function getExistingCollections() {
  const data = await pbFetch("/api/collections?perPage=200");
  return data.items || [];
}

async function collectionExists(name) {
  try {
    await pbFetch(`/api/collections/${name}`);
    return true;
  } catch {
    return false;
  }
}

async function createCollection(schema) {
  const name = schema.name;
  console.log(`   📦 Erstelle Collection "${name}"...`);
  try {
    await pbFetch("/api/collections", {
      method: "POST",
      body: JSON.stringify(schema),
    });
    console.log(`   ✅ "${name}" erstellt`);
  } catch (err) {
    console.log(`   ⚠️  "${name}": ${err.message}`);
  }
}

async function updateCollection(name, updates) {
  console.log(`   🔄 Aktualisiere Collection "${name}"...`);
  try {
    await pbFetch(`/api/collections/${name}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    console.log(`   ✅ "${name}" aktualisiert`);
  } catch (err) {
    console.log(`   ⚠️  "${name}": ${err.message}`);
  }
}

// --- Collection Definitions ---

const SETTINGS_COLLECTION = {
  name: "settings",
  type: "base",
  schema: [
    { name: "mosque_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "public_dashboard_enabled", type: "bool", options: { default: true } },
    { name: "members_dashboard_enabled", type: "bool", options: { default: true } },
    { name: "public_finance_enabled", type: "bool", options: { default: false } },
    { name: "newsletter_enabled", type: "bool", options: { default: false } },
    { name: "allow_guest_event_registration", type: "bool", options: { default: true } },
    { name: "allow_guest_donations", type: "bool", options: { default: true } },
    { name: "guest_registration_rate_limit_per_ip_per_hour", type: "number", options: { min: 1, max: 100, default: 10 } },
    { name: "guest_registration_email_verify", type: "bool", options: { default: false } },
    { name: "prayer_provider", type: "text", options: { default: "aladhan" } },
    { name: "prayer_method", type: "number", options: { min: 1, default: 13 } },
    { name: "tune", type: "text" },
    { name: "locale", type: "text", options: { default: "de" } },
    { name: "default_post_visibility", type: "text", options: { default: "public" } },
    { name: "default_event_visibility", type: "text", options: { default: "public" } },
    { name: "donation_quick_amounts", type: "text", options: { default: "10,25,50,100" } },
  ],
  indexes: ['CREATE UNIQUE INDEX idx_settings_mosque ON settings (mosque_id)'],
};

const SETTINGS_NEW_FIELDS = [
  { name: "prayer_provider", type: "text", options: { default: "aladhan" } },
  { name: "prayer_method", type: "number", options: { min: 1, default: 13 } },
  { name: "tune", type: "text" },
  { name: "locale", type: "text", options: { default: "de" } },
  { name: "default_post_visibility", type: "text", options: { default: "public" } },
  { name: "default_event_visibility", type: "text", options: { default: "public" } },
  { name: "donation_quick_amounts", type: "text", options: { default: "10,25,50,100" } },
];

const SETTINGS_RECURRING_FIELDS = [
  { name: "recurring_donations_enabled", type: "bool", options: { default: false } },
  { name: "recurring_min_cents", type: "number", options: { min: 100, default: 1000 } },
  { name: "recurring_quick_amounts", type: "text", options: { default: "1000,2000,5000,10000" } },
];

const RECURRING_SUBSCRIPTIONS_NEW_FIELDS = [
  { name: "provider_ref", type: "text" },
  { name: "cancel_at_period_end", type: "bool", options: { default: false } },
  { name: "current_period_end", type: "date" },
  {
    name: "last_payment_status",
    type: "select",
    options: { values: ["paid", "failed", "pending"], maxSelect: 1 },
  },
  { name: "last_payment_at", type: "date" },
  { name: "disabled_by_setting", type: "bool", options: { default: false } },
  { name: "donor_name", type: "text" },
];

// Cache für monatliche Gebetszeiten-Kalender (AlAdhan)
const PRAYER_TIMES_CACHE_COLLECTION = {
  name: "prayer_times_cache",
  type: "base",
  schema: [
    { name: "mosque_id", type: "text", required: true },
    { name: "month_key", type: "text", required: true },   // "YYYY-MM"
    { name: "calendar_json", type: "text", required: true }, // JSON-Array
    { name: "fetched_at", type: "text", required: true },   // ISO-Datum
  ],
  indexes: [
    "CREATE UNIQUE INDEX idx_ptcache_key ON prayer_times_cache (mosque_id, month_key)",
  ],
};

const POSTS_COLLECTION = {
  name: "posts",
  type: "base",
  schema: [
    { name: "mosque_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "title", type: "text", required: true, options: { min: 3, max: 200 } },
    { name: "content", type: "editor", required: true },
    {
      name: "category",
      type: "select",
      required: true,
      options: { values: ["announcement", "youth", "campaign", "event", "general"], maxSelect: 1 },
    },
    {
      name: "visibility",
      type: "select",
      required: true,
      options: { values: ["public", "members"], maxSelect: 1 },
    },
    { name: "pinned", type: "bool", options: { default: false } },
    {
      name: "status",
      type: "select",
      required: true,
      options: { values: ["published", "draft"], maxSelect: 1 },
    },
    { name: "published_at", type: "date" },
    { name: "attachments", type: "file", options: { maxSelect: 10, maxSize: 10485760 } },
    { name: "created_by", type: "relation", options: { collectionId: "", maxSelect: 1 } },
  ],
  indexes: [
    'CREATE INDEX idx_posts_mosque ON posts (mosque_id)',
    'CREATE INDEX idx_posts_status ON posts (mosque_id, status)',
  ],
};

const EVENTS_COLLECTION = {
  name: "events",
  type: "base",
  schema: [
    { name: "mosque_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "title", type: "text", required: true, options: { min: 3, max: 200 } },
    { name: "description", type: "editor" },
    {
      name: "category",
      type: "select",
      required: true,
      options: { values: ["youth", "lecture", "quran", "community", "ramadan", "other"], maxSelect: 1 },
    },
    { name: "location_name", type: "text" },
    { name: "start_at", type: "date", required: true },
    { name: "start_prayer", type: "text" },
    { name: "end_at", type: "date" },
    { name: "duration_minutes", type: "number", options: { min: 0, default: 0 } },
    {
      name: "visibility",
      type: "select",
      required: true,
      options: { values: ["public", "members"], maxSelect: 1 },
    },
    { name: "capacity", type: "number", options: { min: 0, default: 0 } },
    {
      name: "status",
      type: "select",
      required: true,
      options: { values: ["published", "cancelled", "draft"], maxSelect: 1 },
    },
    { name: "cover_image", type: "file", options: { maxSelect: 1, maxSize: 5242880 } },
    { name: "created_by", type: "relation", options: { collectionId: "", maxSelect: 1 } },
  ],
  indexes: [
    'CREATE INDEX idx_events_mosque ON events (mosque_id)',
    'CREATE INDEX idx_events_upcoming ON events (mosque_id, status, start_at)',
  ],
};

const EVENT_REGISTRATIONS_COLLECTION = {
  name: "event_registrations",
  type: "base",
  schema: [
    { name: "mosque_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "event_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    {
      name: "registrant_type",
      type: "select",
      required: true,
      options: { values: ["member", "guest"], maxSelect: 1 },
    },
    { name: "user_id", type: "relation", options: { collectionId: "", maxSelect: 1 } },
    { name: "guest_name", type: "text" },
    { name: "guest_email", type: "email" },
    {
      name: "status",
      type: "select",
      required: true,
      options: { values: ["registered", "cancelled", "attended", "no_show"], maxSelect: 1 },
    },
    { name: "registered_at", type: "date" },
    { name: "cancelled_at", type: "date" },
    { name: "verify_token", type: "text" },
    { name: "verified_at", type: "date" },
    { name: "source_ip_hash", type: "text" },
    { name: "user_agent", type: "text" },
  ],
  indexes: [
    'CREATE INDEX idx_eventreg_event ON event_registrations (event_id)',
    'CREATE INDEX idx_eventreg_guest ON event_registrations (event_id, guest_email)',
  ],
};

const RECURRING_SUBSCRIPTIONS_COLLECTION = {
  name: "recurring_subscriptions",
  type: "base",
  schema: [
    { name: "mosque_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    {
      name: "donor_type",
      type: "select",
      required: true,
      options: { values: ["member", "guest"], maxSelect: 1 },
    },
    { name: "user_id", type: "relation", options: { collectionId: "", maxSelect: 1 } },
    { name: "donor_email", type: "email" },
    { name: "campaign_id", type: "relation", options: { collectionId: "", maxSelect: 1 } },
    { name: "amount_cents", type: "number", required: true, options: { min: 100 } },
    { name: "currency", type: "text", options: { default: "EUR" } },
    {
      name: "interval",
      type: "select",
      required: true,
      options: { values: ["monthly"], maxSelect: 1 },
    },
    {
      name: "provider",
      type: "select",
      required: true,
      options: { values: ["stripe"], maxSelect: 1 },
    },
    { name: "provider_subscription_id", type: "text" },
    {
      name: "status",
      type: "select",
      required: true,
      options: { values: ["pending", "active", "cancelled"], maxSelect: 1 },
    },
    { name: "started_at", type: "date" },
    { name: "cancelled_at", type: "date" },
    ...RECURRING_SUBSCRIPTIONS_NEW_FIELDS,
  ],
  indexes: [
    'CREATE INDEX idx_recsub_mosque ON recurring_subscriptions (mosque_id)',
    'CREATE INDEX idx_recsub_provider_sub ON recurring_subscriptions (provider_subscription_id)',
  ],
};

const EMAIL_OUTBOX_COLLECTION = {
  name: "email_outbox",
  type: "base",
  schema: [
    { name: "mosque_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    {
      name: "type",
      type: "select",
      required: true,
      options: {
        values: ["newsletter", "event_confirmation", "event_reminder", "donation_receipt", "guest_event_verify", "fee_reminder", "admin_notification"],
        maxSelect: 1,
      },
    },
    { name: "to_email", type: "email", required: true },
    { name: "subject", type: "text", required: true },
    { name: "body_html", type: "editor", required: true },
    {
      name: "status",
      type: "select",
      required: true,
      options: { values: ["queued", "sent", "failed"], maxSelect: 1 },
    },
    { name: "sent_at", type: "date" },
    { name: "created_by", type: "relation", options: { collectionId: "", maxSelect: 1 } },
    { name: "meta_json", type: "json", options: { maxSize: 2000000 } },
  ],
  indexes: [
    'CREATE INDEX idx_email_status ON email_outbox (status)',
    'CREATE INDEX idx_email_mosque ON email_outbox (mosque_id)',
  ],
};

const AUDIT_LOGS_COLLECTION = {
  name: "audit_logs",
  type: "base",
  schema: [
    { name: "mosque_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "actor_user_id", type: "relation", options: { collectionId: "", maxSelect: 1 } },
    { name: "action", type: "text", required: true },
    { name: "entity_type", type: "text", required: true },
    { name: "entity_id", type: "text" },
    // before/after: vollständige Snapshots vor und nach der Änderung
    { name: "before_json", type: "json", options: { maxSize: 2000000 } },
    { name: "after_json", type: "json", options: { maxSize: 2000000 } },
    // diff_json: Legacy/ergänzende Details (z.B. für .created ohne before/after)
    { name: "diff_json", type: "json", options: { maxSize: 2000000 } },
  ],
  indexes: [
    'CREATE INDEX idx_audit_mosque ON audit_logs (mosque_id)',
    'CREATE INDEX idx_audit_entity ON audit_logs (mosque_id, entity_type, entity_id)',
    'CREATE INDEX idx_audit_created ON audit_logs (mosque_id, created)',
  ],
};

// --- Madrasa Collections ---

const ACADEMIC_YEARS_COLLECTION = {
  name: "academic_years",
  type: "base",
  schema: [
    { name: "mosque_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "name", type: "text", required: true, options: { min: 3, max: 20 } },
    { name: "start_date", type: "date", required: true },
    { name: "end_date", type: "date", required: true },
    {
      name: "status",
      type: "select",
      required: true,
      options: { values: ["active", "archived"], maxSelect: 1 },
    },
  ],
  indexes: [
    'CREATE INDEX idx_acyear_mosque ON academic_years (mosque_id)',
  ],
};

const STUDENTS_COLLECTION = {
  name: "students",
  type: "base",
  schema: [
    { name: "mosque_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "first_name", type: "text", required: true, options: { min: 1, max: 100 } },
    { name: "last_name", type: "text", required: true, options: { min: 1, max: 100 } },
    { name: "date_of_birth", type: "date", required: true },
    {
      name: "gender",
      type: "select",
      options: { values: ["male", "female"], maxSelect: 1 },
    },
    { name: "parent_id", type: "relation", options: { collectionId: "", maxSelect: 1 } },
    { name: "parent_name", type: "text" },
    { name: "parent_phone", type: "text" },
    // Erweiterte Felder (v2)
    { name: "address", type: "text" },
    { name: "school_name", type: "text" },
    { name: "school_class", type: "text" },
    { name: "health_notes", type: "text" },
    { name: "mother_name", type: "text" },
    { name: "mother_phone", type: "text" },
    { name: "father_name", type: "text" },
    { name: "father_phone", type: "text" },
    {
      name: "membership_status",
      type: "select",
      options: { values: ["active", "none", "planned"], maxSelect: 1 },
    },
    { name: "notes", type: "text" },
    {
      name: "status",
      type: "select",
      required: true,
      options: { values: ["active", "inactive"], maxSelect: 1 },
    },
  ],
  indexes: [
    'CREATE INDEX idx_students_mosque ON students (mosque_id)',
    'CREATE INDEX idx_students_status ON students (mosque_id, status)',
  ],
};

const COURSES_COLLECTION = {
  name: "courses",
  type: "base",
  schema: [
    { name: "mosque_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "academic_year_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "title", type: "text", required: true, options: { min: 3, max: 200 } },
    { name: "description", type: "editor" },
    {
      name: "category",
      type: "select",
      required: true,
      options: { values: ["quran", "tajweed", "fiqh", "arabic", "sira", "islamic_studies", "other"], maxSelect: 1 },
    },
    {
      name: "level",
      type: "select",
      required: true,
      options: { values: ["beginner", "intermediate", "advanced", "mixed"], maxSelect: 1 },
    },
    { name: "teacher_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    {
      name: "day_of_week",
      type: "select",
      required: true,
      options: { values: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"], maxSelect: 1 },
    },
    { name: "start_time", type: "text", required: true },
    { name: "end_time", type: "text" },
    { name: "location_name", type: "text" },
    { name: "max_students", type: "number", options: { min: 0, default: 0 } },
    {
      name: "status",
      type: "select",
      required: true,
      options: { values: ["active", "paused", "archived"], maxSelect: 1 },
    },
    { name: "created_by", type: "relation", options: { collectionId: "", maxSelect: 1 } },
  ],
  indexes: [
    'CREATE INDEX idx_courses_mosque ON courses (mosque_id)',
    'CREATE INDEX idx_courses_status ON courses (mosque_id, status)',
    'CREATE INDEX idx_courses_teacher ON courses (teacher_id)',
    'CREATE INDEX idx_courses_year ON courses (academic_year_id)',
  ],
};

const COURSE_ENROLLMENTS_COLLECTION = {
  name: "course_enrollments",
  type: "base",
  schema: [
    { name: "mosque_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "course_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "student_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    {
      name: "status",
      type: "select",
      required: true,
      options: { values: ["enrolled", "completed", "dropped", "on_hold"], maxSelect: 1 },
    },
    { name: "enrolled_at", type: "date" },
    { name: "completed_at", type: "date" },
    { name: "notes", type: "text" },
  ],
  indexes: [
    'CREATE INDEX idx_enrollment_course ON course_enrollments (course_id)',
    'CREATE INDEX idx_enrollment_student ON course_enrollments (student_id)',
    'CREATE UNIQUE INDEX idx_enrollment_unique ON course_enrollments (course_id, student_id, status)',
  ],
};

const MADRASA_ATTENDANCE_COLLECTION = {
  name: "attendance",
  type: "base",
  schema: [
    { name: "mosque_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "course_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "student_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "session_date", type: "date", required: true },
    {
      name: "status",
      type: "select",
      required: true,
      options: { values: ["present", "absent", "late", "excused"], maxSelect: 1 },
    },
    { name: "notes", type: "text" },
    { name: "marked_by", type: "relation", options: { collectionId: "", maxSelect: 1 } },
    { name: "performance", type: "number", required: false, options: { min: 1, max: 5 } },
  ],
  indexes: [
    'CREATE INDEX idx_attendance_course ON attendance (course_id, session_date)',
    'CREATE INDEX idx_attendance_student ON attendance (student_id)',
    'CREATE UNIQUE INDEX idx_attendance_unique ON attendance (course_id, student_id, session_date)',
  ],
};

const INVITES_COLLECTION = {
  name: "invites",
  type: "base",
  schema: [
    { name: "mosque_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "created_by", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "token", type: "text", required: true, options: { max: 64 } },
    {
      name: "type",
      type: "select",
      required: true,
      options: { values: ["personal", "group"], maxSelect: 1 },
    },
    { name: "label", type: "text", options: { max: 100 } },
    { name: "email", type: "email" },
    {
      name: "role",
      type: "select",
      options: { values: ["member", "teacher", "imam", "editor", "admin"], maxSelect: 1 },
    },
    {
      name: "initial_status",
      type: "select",
      options: { values: ["pending", "active"], maxSelect: 1 },
    },
    { name: "max_uses", type: "number", options: { min: 0 } },
    { name: "uses_count", type: "number", options: { min: 0, default: 0 } },
    { name: "expires_at", type: "date" },
    { name: "is_active", type: "bool", options: { default: true } },
  ],
  indexes: [
    "CREATE UNIQUE INDEX idx_invites_token ON invites (token)",
    "CREATE INDEX idx_invites_mosque ON invites (mosque_id)",
  ],
};

// --- Felder für bestehende Collections ---

const MOSQUES_NEW_FIELDS = [
  { name: "timezone", type: "text", options: { default: "Europe/Berlin" } },
  { name: "public_enabled", type: "bool", options: { default: true } },
  {
    name: "donation_provider",
    type: "select",
    options: { values: ["stripe", "paypal", "external", "none"], maxSelect: 1 },
  },
  { name: "paypal_donate_url", type: "url" },
  { name: "paypal_enabled", type: "bool", options: { default: false } },
  { name: "brand_logo", type: "file", options: { maxSelect: 1, maxSize: 2097152 } },
  { name: "brand_primary_color", type: "text" },
  { name: "brand_accent_color", type: "text" },
  { name: "brand_theme", type: "text", options: { default: "emerald" } },
  { name: "zip_code", type: "text" },
  { name: "website", type: "url" },
  { name: "brand_hero_type", type: "text", options: { default: "color" } },
  { name: "brand_hero_image", type: "file", options: { maxSelect: 1, maxSize: 5242880 } },
];

const USERS_NEW_FIELDS = [
  { name: "first_name", type: "text" },
  { name: "last_name", type: "text" },
  { name: "member_no", type: "text" },
  { name: "pending_email", type: "text" },
  { name: "email_change_token", type: "text" },
  { name: "email_change_expires_at", type: "text" },
  { name: "address", type: "text", options: { max: 300 } },
];

const CAMPAIGNS_NEW_FIELDS = [
  { name: "goal_amount_cents", type: "number", options: { min: 0 } },
  { name: "currency", type: "text", options: { default: "EUR" } },
  {
    name: "category",
    type: "select",
    options: { values: ["ramadan", "construction", "aid", "maintenance", "general"], maxSelect: 1 },
  },
  { name: "start_at", type: "date" },
  { name: "end_at", type: "date" },
  { name: "cover_image", type: "file", options: { maxSelect: 1, maxSize: 5242880 } },
  { name: "created_by", type: "relation", options: { collectionId: "", maxSelect: 1 } },
];

const STUDENT_FEES_COLLECTION = {
  name: "student_fees",
  type: "base",
  schema: [
    { name: "mosque_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "student_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "month_key", type: "text", required: true },
    { name: "amount_cents", type: "number", required: true, options: { min: 0 } },
    {
      name: "status",
      type: "select",
      required: true,
      options: { values: ["open", "paid", "waived"], maxSelect: 1 },
    },
    { name: "paid_at", type: "date" },
    {
      name: "payment_method",
      type: "select",
      options: { values: ["cash", "transfer", "stripe", "waived"], maxSelect: 1 },
    },
    { name: "provider_ref", type: "text" },
    { name: "notes", type: "text" },
    { name: "reminder_sent_at", type: "text" },
    { name: "created_by", type: "relation", options: { collectionId: "", maxSelect: 1 } },
  ],
  indexes: [
    "CREATE UNIQUE INDEX idx_student_fees_unique ON student_fees (mosque_id, student_id, month_key)",
    "CREATE INDEX idx_student_fees_mosque ON student_fees (mosque_id, month_key)",
  ],
};

const SETTINGS_MADRASA_FIELDS = [
  { name: "madrasa_fees_enabled", type: "bool", options: { default: false } },
  { name: "madrasa_default_fee_cents", type: "number", options: { min: 0, default: 5000 } },
  { name: "fee_reminder_enabled", type: "bool", options: { default: false } },
  { name: "fee_reminder_day", type: "number", options: { min: 1, max: 28, default: 15 } },
  // Geschwister-Rabatt (Session 24)
  { name: "sibling_discount_enabled", type: "bool", options: { default: false } },
  { name: "sibling_discount_2nd_percent", type: "number", options: { min: 0, max: 100, default: 0 } },
  { name: "sibling_discount_3rd_percent", type: "number", options: { min: 0, max: 100, default: 0 } },
];

const SETTINGS_SPONSORS_FIELDS = [
  { name: "sponsors_enabled", type: "bool", options: { default: false } },
  {
    name: "sponsors_visibility",
    type: "select",
    options: { values: ["public", "members"], maxSelect: 1 },
  },
];

const SETTINGS_TEAM_FIELDS = [
  { name: "team_enabled", type: "bool", options: { default: false } },
  {
    name: "team_visibility",
    type: "select",
    options: { values: ["public", "members"], maxSelect: 1 },
  },
];

const SETTINGS_CONTACT_FIELDS = [
  { name: "contact_enabled",      type: "bool", options: { default: false } },
  { name: "contact_email",        type: "email", required: false },
  { name: "contact_notify_admin", type: "bool", options: { default: true } },
  { name: "contact_auto_reply",   type: "bool", options: { default: true } },
];

const SPONSORS_NEW_FIELDS = [
  { name: "contact_user_id", type: "relation", options: { collectionId: "", maxSelect: 1 } },
  { name: "contact_email", type: "email", options: {} },
  { name: "provider_ref", type: "text", options: { max: 255 } },
  { name: "paid_at", type: "text", options: { max: 50 } },
  { name: "months_paid", type: "number", options: { min: 1 } },
];

const TEAM_MEMBERS_COLLECTION = {
  name: "team_members",
  type: "base",
  schema: [
    { name: "mosque_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "name", type: "text", required: true, options: { min: 1, max: 100 } },
    { name: "role", type: "text", required: true, options: { min: 1, max: 100 } },
    { name: "bio", type: "text", options: { max: 500 } },
    { name: "photo", type: "file", options: { maxSelect: 1, maxSize: 3145728 } },
    { name: "email", type: "email" },
    { name: "group", type: "text", options: { max: 80 } },
    { name: "sort_order", type: "number", options: { min: 0, default: 0 } },
    { name: "is_active", type: "bool", options: { default: true } },
    { name: "created_by", type: "relation", options: { collectionId: "", maxSelect: 1 } },
  ],
  indexes: [
    "CREATE INDEX idx_team_mosque ON team_members (mosque_id)",
    "CREATE INDEX idx_team_active ON team_members (mosque_id, is_active, sort_order)",
  ],
};

const SPONSORS_COLLECTION = {
  name: "sponsors",
  type: "base",
  schema: [
    { name: "mosque_id", type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "name", type: "text", required: true, options: { min: 1, max: 100 } },
    { name: "logo", type: "file", options: { maxSelect: 1, maxSize: 5242880 } },
    { name: "description", type: "text", options: { max: 300 } },
    { name: "website_url", type: "url" },
    {
      name: "category",
      type: "select",
      options: {
        values: [
          "gastronomie", "lebensmittel", "automobil", "handwerk",
          "gesundheit", "bildung", "reise", "mode",
          "immobilien", "it_technik", "dienstleistungen", "sonstiges",
        ],
        maxSelect: 1,
      },
    },
    { name: "start_date", type: "date" },
    { name: "end_date", type: "date" },
    { name: "is_active", type: "bool", options: { default: false } },
    { name: "is_approved", type: "bool", options: { default: false } },
    { name: "notification_sent", type: "bool", options: { default: false } },
    { name: "sort_order", type: "number", options: { min: 0, default: 0 } },
    {
      name: "payment_status",
      type: "select",
      required: true,
      options: { values: ["open", "paid"], maxSelect: 1 },
    },
    {
      name: "payment_method",
      type: "select",
      options: { values: ["cash", "transfer"], maxSelect: 1 },
    },
    { name: "amount_cents", type: "number", options: { min: 0 } },
    { name: "created_by", type: "relation", options: { collectionId: "", maxSelect: 1 } },
  ],
  indexes: [
    "CREATE INDEX idx_sponsors_mosque ON sponsors (mosque_id)",
    "CREATE INDEX idx_sponsors_active ON sponsors (is_active, is_approved, end_date)",
  ],
};

const EVENTS_RECURRING_FIELDS = [
  { name: "is_recurring", type: "bool", options: { default: false } },
  {
    name: "recurrence_type",
    type: "select",
    options: { values: ["daily", "weekly", "monthly"], maxSelect: 1 },
  },
  {
    name: "recurrence_day_of_week",
    type: "select",
    options: {
      values: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
      maxSelect: 1,
    },
  },
  { name: "recurrence_day_of_month", type: "number", options: { min: 1, max: 31 } },
  { name: "recurrence_month_mode", type: "text", options: { max: 20 } },
  { name: "recurrence_month_week", type: "number", options: { min: -1, max: 4 } },
  { name: "recurrence_month_weekday", type: "text", options: { max: 20 } },
  { name: "recurrence_end_date", type: "date" },
];

const DONATIONS_NEW_FIELDS = [
  { name: "amount_cents", type: "number", options: { min: 0 } },
  { name: "currency", type: "text", options: { default: "EUR" } },
  {
    name: "donor_type",
    type: "select",
    options: { values: ["member", "guest"], maxSelect: 1 },
  },
  { name: "donor_name", type: "text" },
  { name: "donor_email", type: "email" },
  { name: "is_recurring", type: "bool", options: { default: false } },
  { name: "subscription_id", type: "relation", options: { collectionId: "", maxSelect: 1 } },
  {
    name: "provider",
    type: "select",
    options: { values: ["stripe", "sepa", "paypal_link", "external", "manual"], maxSelect: 1 },
  },
  { name: "provider_ref", type: "text" },
  { name: "paid_at", type: "date" },
];

// --- Main ---

async function resolveRelationIds(collections) {
  // Erstelle eine Map von Collection-Name zu ID
  const map = {};
  for (const col of collections) {
    map[col.name] = col.id;
  }
  return map;
}

function patchRelations(schema, collectionMap) {
  return schema.map((field) => {
    if (field.type === "relation" && field.options?.collectionId === "") {
      // Versuche anhand des Feldnamens die Relation aufzulösen
      const name = field.name;
      let targetCollection = "";

      if (name === "mosque_id") targetCollection = "mosques";
      else if (name === "event_id") targetCollection = "events";
      else if (name === "user_id" || name === "created_by" || name === "actor_user_id" || name === "teacher_id" || name === "marked_by" || name === "parent_id" || name === "contact_user_id")
        targetCollection = "users";
      else if (name === "student_id") targetCollection = "students";
      else if (name === "campaign_id") targetCollection = "campaigns";
      else if (name === "subscription_id")
        targetCollection = "recurring_subscriptions";
      else if (name === "course_id") targetCollection = "courses";
      else if (name === "academic_year_id") targetCollection = "academic_years";
      else if (name === "parent_user") targetCollection = "users";
      else if (name === "student") targetCollection = "students";

      if (targetCollection && collectionMap[targetCollection]) {
        return {
          ...field,
          options: { ...field.options, collectionId: collectionMap[targetCollection] },
        };
      }
    }
    return field;
  });
}

// Verknüpfung Eltern ↔ Kinder (junction table, many-to-many)
const PARENT_CHILD_RELATIONS_COLLECTION = {
  name: "parent_child_relations",
  type: "base",
  schema: [
    { name: "mosque_id",   type: "relation", required: true, options: { collectionId: "", maxSelect: 1 } },
    { name: "parent_user", type: "relation", required: true, options: { collectionId: "", maxSelect: 1, cascadeDelete: true } },
    { name: "student",     type: "relation", required: true, options: { collectionId: "", maxSelect: 1, cascadeDelete: true } },
    {
      name: "relation_type",
      type: "select",
      required: false,
      options: { values: ["father", "mother", "guardian", "other"], maxSelect: 1 },
    },
  ],
  indexes: [
    "CREATE UNIQUE INDEX idx_parent_child_unique    ON parent_child_relations (mosque_id, parent_user, student)",
    "CREATE INDEX        idx_parent_child_by_parent ON parent_child_relations (mosque_id, parent_user)",
    "CREATE INDEX        idx_parent_child_by_student ON parent_child_relations (mosque_id, student)",
  ],
};

async function main() {
  console.log("=== Moschee-Portal V1 Migration ===\n");
  console.log(`PocketBase: ${PB_URL}\n`);

  // 1. Authentifizieren
  await authenticate();

  // 2. Bestehende Collections laden
  let collections = await getExistingCollections();
  let collectionMap = await resolveRelationIds(collections);

  console.log(
    `📋 ${collections.length} bestehende Collections gefunden: ${collections.map((c) => c.name).join(", ")}\n`
  );

  // 3. Neue Collections erstellen
  console.log("--- Neue Collections erstellen ---\n");

  const newCollections = [
    SETTINGS_COLLECTION,
    POSTS_COLLECTION,
    EVENTS_COLLECTION,
    EVENT_REGISTRATIONS_COLLECTION,
    RECURRING_SUBSCRIPTIONS_COLLECTION,
    EMAIL_OUTBOX_COLLECTION,
    AUDIT_LOGS_COLLECTION,
    ACADEMIC_YEARS_COLLECTION,
    STUDENTS_COLLECTION,
    COURSES_COLLECTION,
    COURSE_ENROLLMENTS_COLLECTION,
    MADRASA_ATTENDANCE_COLLECTION,
    INVITES_COLLECTION,
    PRAYER_TIMES_CACHE_COLLECTION,
    STUDENT_FEES_COLLECTION,
    SPONSORS_COLLECTION,
    TEAM_MEMBERS_COLLECTION,
    PARENT_CHILD_RELATIONS_COLLECTION,
  ];

  for (const colDef of newCollections) {
    const exists = await collectionExists(colDef.name);
    if (exists) {
      console.log(`   ⏭️  "${colDef.name}" existiert bereits`);
      continue;
    }

    // Patch relation IDs — aktualisiere Map vor jeder Collection,
    // damit Relations auf gerade erstellte Collections funktionieren
    collections = await getExistingCollections();
    collectionMap = await resolveRelationIds(collections);

    const patchedSchema = patchRelations(colDef.schema, collectionMap);
    await createCollection({ ...colDef, schema: patchedSchema });
  }

  // Aktualisiere Collection-Map nach dem Erstellen
  collections = await getExistingCollections();
  collectionMap = await resolveRelationIds(collections);

  // 4. Jetzt Relations in bestehenden Collections patchen
  // (weil recurring_subscriptions jetzt existiert)
  console.log("\n--- Relationen aktualisieren ---\n");

  for (const colDef of newCollections) {
    const exists = collectionMap[colDef.name];
    if (!exists) continue;

    const patchedSchema = patchRelations(colDef.schema, collectionMap);
    const needsPatch = patchedSchema.some(
      (f, i) =>
        f.type === "relation" &&
        f.options?.collectionId &&
        f.options.collectionId !== colDef.schema[i]?.options?.collectionId
    );

    if (needsPatch) {
      await updateCollection(colDef.name, { schema: patchedSchema });
    }
  }

  // 5. Bestehende Collections erweitern
  console.log("\n--- Bestehende Collections erweitern ---\n");

  // mosques: neue Felder hinzufügen
  if (collectionMap.mosques) {
    const mosqueCol = collections.find((c) => c.name === "mosques");
    const existingFieldNames = (mosqueCol?.schema || []).map((f) => f.name);
    const fieldsToAdd = MOSQUES_NEW_FIELDS.filter(
      (f) => !existingFieldNames.includes(f.name)
    );

    if (fieldsToAdd.length > 0) {
      const newSchema = [...(mosqueCol?.schema || []), ...fieldsToAdd];
      await updateCollection("mosques", { schema: newSchema });
      console.log(
        `   ✅ mosques: ${fieldsToAdd.map((f) => f.name).join(", ")} hinzugefügt`
      );
    } else {
      console.log("   ⏭️  mosques: alle V1-Felder vorhanden");
    }
  }

  // users: neue Felder hinzufügen
  if (collectionMap.users) {
    const userCol = collections.find((c) => c.name === "users");
    const existingFieldNames = (userCol?.schema || []).map((f) => f.name);
    const fieldsToAdd = USERS_NEW_FIELDS.filter(
      (f) => !existingFieldNames.includes(f.name)
    );

    if (fieldsToAdd.length > 0) {
      const newSchema = [...(userCol?.schema || []), ...fieldsToAdd];
      await updateCollection("users", { schema: newSchema });
      console.log(
        `   ✅ users: ${fieldsToAdd.map((f) => f.name).join(", ")} hinzugefügt`
      );
    } else {
      console.log("   ⏭️  users: alle V1-Felder vorhanden");
    }

    // users: role-Feld um "imam", "editor", "super_admin" erweitern
    const userColCurrent = (await getExistingCollections()).find((c) => c.name === "users");
    const roleField = (userColCurrent?.schema || []).find((f) => f.name === "role");
    if (roleField && roleField.options?.values) {
      const currentValues = roleField.options.values;
      const requiredRoles = ["member", "teacher", "imam", "editor", "admin", "super_admin", "madrasa_admin", "treasurer", "secretary"];
      const missingRoles = requiredRoles.filter((r) => !currentValues.includes(r));
      if (missingRoles.length > 0) {
        const updatedSchema = (userColCurrent.schema || []).map((f) =>
          f.name === "role" ? { ...f, options: { ...f.options, values: requiredRoles } } : f
        );
        await updateCollection("users", { schema: updatedSchema });
        console.log(`   ✅ users: role-Feld erweitert um: ${missingRoles.join(", ")}`);
      } else {
        console.log("   ⏭️  users: role-Feld enthält bereits alle Rollen");
      }
    }
  }

  // campaigns: neue Felder hinzufügen
  if (collectionMap.campaigns) {
    const campaignCol = collections.find((c) => c.name === "campaigns");
    const existingFieldNames = (campaignCol?.schema || []).map((f) => f.name);
    const fieldsToAdd = CAMPAIGNS_NEW_FIELDS.filter(
      (f) => !existingFieldNames.includes(f.name)
    ).map((f) => {
      if (f.type === "relation" && f.options?.collectionId === "") {
        const target =
          f.name === "created_by" ? "users" : f.name === "campaign_id" ? "campaigns" : "";
        return {
          ...f,
          options: { ...f.options, collectionId: collectionMap[target] || "" },
        };
      }
      return f;
    });

    if (fieldsToAdd.length > 0) {
      const newSchema = [...(campaignCol?.schema || []), ...fieldsToAdd];
      await updateCollection("campaigns", { schema: newSchema });
      console.log(
        `   ✅ campaigns: ${fieldsToAdd.map((f) => f.name).join(", ")} hinzugefügt`
      );
    } else {
      console.log("   ⏭️  campaigns: alle V1-Felder vorhanden");
    }
  }

  // donations: neue Felder hinzufügen
  if (collectionMap.donations) {
    const donationCol = collections.find((c) => c.name === "donations");
    const existingFieldNames = (donationCol?.schema || []).map((f) => f.name);
    const fieldsToAdd = DONATIONS_NEW_FIELDS.filter(
      (f) => !existingFieldNames.includes(f.name)
    ).map((f) => {
      if (f.type === "relation" && f.options?.collectionId === "") {
        const target = f.name === "subscription_id" ? "recurring_subscriptions" : "";
        return {
          ...f,
          options: { ...f.options, collectionId: collectionMap[target] || "" },
        };
      }
      return f;
    });

    if (fieldsToAdd.length > 0) {
      const newSchema = [...(donationCol?.schema || []), ...fieldsToAdd];
      await updateCollection("donations", { schema: newSchema });
      console.log(
        `   ✅ donations: ${fieldsToAdd.map((f) => f.name).join(", ")} hinzugefügt`
      );
    } else {
      console.log("   ⏭️  donations: alle V1-Felder vorhanden");
    }
  }

  // 6. events: neue Felder hinzufügen
  if (collectionMap.events) {
    const eventsCol = collections.find((c) => c.name === "events");
    const existingFieldNames = (eventsCol?.schema || []).map((f) => f.name);
    const eventsNewFields = [
      { name: "start_prayer", type: "text" },
      { name: "duration_minutes", type: "number", options: { min: 0, default: 0 } },
    ];
    const fieldsToAdd = eventsNewFields.filter((f) => !existingFieldNames.includes(f.name));
    if (fieldsToAdd.length > 0) {
      const newSchema = [...(eventsCol?.schema || []), ...fieldsToAdd];
      await updateCollection("events", { schema: newSchema });
      console.log(`   ✅ events: ${fieldsToAdd.map((f) => f.name).join(", ")} hinzugefügt`);
    } else {
      console.log("   ⏭️  events: alle V1-Felder vorhanden");
    }
  }

  // 6b. events: Wiederholungs-Felder hinzufügen
  if (collectionMap.events) {
    const eventsCol = (await getExistingCollections()).find((c) => c.name === "events");
    const existingFieldNames = (eventsCol?.schema || []).map((f) => f.name);
    const fieldsToAdd = EVENTS_RECURRING_FIELDS.filter((f) => !existingFieldNames.includes(f.name));
    if (fieldsToAdd.length > 0) {
      const newSchema = [...(eventsCol?.schema || []), ...fieldsToAdd];
      await updateCollection("events", { schema: newSchema });
      console.log(`   ✅ events (recurring): ${fieldsToAdd.map((f) => f.name).join(", ")} hinzugefügt`);
    } else {
      console.log("   ⏭️  events: alle Wiederholungs-Felder vorhanden");
    }
  }

  // 7. settings: neue Felder hinzufügen
  if (collectionMap.settings) {
    const settingsCol = (await getExistingCollections()).find((c) => c.name === "settings");
    const existingFieldNames = (settingsCol?.schema || []).map((f) => f.name);
    const fieldsToAdd = SETTINGS_NEW_FIELDS.filter((f) => !existingFieldNames.includes(f.name));
    if (fieldsToAdd.length > 0) {
      const newSchema = [...(settingsCol?.schema || []), ...fieldsToAdd];
      await updateCollection("settings", { schema: newSchema });
      console.log(`   ✅ settings: ${fieldsToAdd.map((f) => f.name).join(", ")} hinzugefügt`);
    } else {
      console.log("   ⏭️  settings: alle V1-Felder vorhanden");
    }
  }

  // 8. Aktualisiere donations status-Feld
  if (collectionMap.donations) {
    const donationCol = collections.find((c) => c.name === "donations");
    const statusField = (donationCol?.schema || []).find((f) => f.name === "status");
    if (statusField) {
      const neededValues = ["created", "pending", "paid", "failed", "refunded", "cancelled", "external"];
      const existingValues = statusField.options?.values || [];
      const missing = neededValues.filter((v) => !existingValues.includes(v));

      if (missing.length > 0) {
        const updatedSchema = (donationCol?.schema || []).map((f) => {
          if (f.name === "status") {
            return {
              ...f,
              options: { ...f.options, values: neededValues },
            };
          }
          return f;
        });
        await updateCollection("donations", { schema: updatedSchema });
        console.log(`   ✅ donations.status: Werte aktualisiert (${neededValues.join(", ")})`);
      }
    }
  }

  // 9. settings: Madrasa-Gebühren-Felder hinzufügen
  if (collectionMap.settings) {
    const settingsCol = (await getExistingCollections()).find((c) => c.name === "settings");
    const existingFieldNames = (settingsCol?.schema || []).map((f) => f.name);
    const fieldsToAdd = SETTINGS_MADRASA_FIELDS.filter((f) => !existingFieldNames.includes(f.name));
    if (fieldsToAdd.length > 0) {
      const newSchema = [...(settingsCol?.schema || []), ...fieldsToAdd];
      await updateCollection("settings", { schema: newSchema });
      console.log(`   ✅ settings (madrasa): ${fieldsToAdd.map((f) => f.name).join(", ")} hinzugefügt`);
    } else {
      console.log("   ⏭️  settings: alle Madrasa-Felder vorhanden");
    }
  }

  // 9b. settings: Förderpartner-Felder hinzufügen
  if (collectionMap.settings) {
    const settingsCol = (await getExistingCollections()).find((c) => c.name === "settings");
    const existingFieldNames = (settingsCol?.schema || []).map((f) => f.name);
    const fieldsToAdd = SETTINGS_SPONSORS_FIELDS.filter((f) => !existingFieldNames.includes(f.name));
    if (fieldsToAdd.length > 0) {
      const newSchema = [...(settingsCol?.schema || []), ...fieldsToAdd];
      await updateCollection("settings", { schema: newSchema });
      console.log(`   ✅ settings (sponsors): ${fieldsToAdd.map((f) => f.name).join(", ")} hinzugefügt`);
    } else {
      console.log("   ⏭️  settings: alle Förderpartner-Felder vorhanden");
    }
  }

  // 9d. settings: Team-Felder hinzufügen
  if (collectionMap.settings) {
    const settingsCol = (await getExistingCollections()).find((c) => c.name === "settings");
    const existingFieldNames = (settingsCol?.schema || []).map((f) => f.name);
    const fieldsToAdd = SETTINGS_TEAM_FIELDS.filter((f) => !existingFieldNames.includes(f.name));
    if (fieldsToAdd.length > 0) {
      const newSchema = [...(settingsCol?.schema || []), ...fieldsToAdd];
      await updateCollection("settings", { schema: newSchema });
      console.log(`   ✅ settings (team): ${fieldsToAdd.map((f) => f.name).join(", ")} hinzugefügt`);
    } else {
      console.log("   ⏭️  settings: alle Team-Felder vorhanden");
    }
  }

  // 9e. settings: Kontakt-Felder hinzufügen
  if (collectionMap.settings) {
    const settingsCol = (await getExistingCollections()).find((c) => c.name === "settings");
    const existingFieldNames = (settingsCol?.schema || []).map((f) => f.name);
    const fieldsToAdd = SETTINGS_CONTACT_FIELDS.filter((f) => !existingFieldNames.includes(f.name));
    if (fieldsToAdd.length > 0) {
      const newSchema = [...(settingsCol?.schema || []), ...fieldsToAdd];
      await updateCollection("settings", { schema: newSchema });
      console.log(`   ✅ settings (contact): ${fieldsToAdd.map((f) => f.name).join(", ")} hinzugefügt`);
    } else {
      console.log("   ⏭️  settings: alle Kontakt-Felder vorhanden");
    }
  }

  // 9c. student_fees: reminder_sent_at hinzufügen
  if (collectionMap.student_fees) {
    const feesCol = (await getExistingCollections()).find((c) => c.name === "student_fees");
    const existingFieldNames = (feesCol?.schema || []).map((f) => f.name);
    if (!existingFieldNames.includes("reminder_sent_at")) {
      const newSchema = [...(feesCol?.schema || []), { name: "reminder_sent_at", type: "text" }];
      await updateCollection("student_fees", { schema: newSchema });
      console.log("   ✅ student_fees: reminder_sent_at hinzugefügt");
    } else {
      console.log("   ⏭️  student_fees: reminder_sent_at bereits vorhanden");
    }
  }

  // 9d. student_fees: Geschwister-Rabatt-Felder + individueller Rabatt
  if (collectionMap.student_fees) {
    const feesCol = (await getExistingCollections()).find((c) => c.name === "student_fees");
    const existingFieldNames = (feesCol?.schema || []).map((f) => f.name);
    const newFeeFields = [
      { name: "discount_applied_cents", type: "number", options: { min: 0, default: 0 } },
      { name: "sibling_rank", type: "number", options: { min: 1, default: 1 } },
      { name: "discount_type", type: "select", options: { values: ["none", "sibling", "custom"], maxSelect: 1 } },
      { name: "discount_percent_applied", type: "number", options: { min: 0, max: 100, default: 0 } },
    ].filter((f) => !existingFieldNames.includes(f.name));
    if (newFeeFields.length > 0) {
      const newSchema = [...(feesCol?.schema || []), ...newFeeFields];
      await updateCollection("student_fees", { schema: newSchema });
      console.log(`   ✅ student_fees: ${newFeeFields.map((f) => f.name).join(", ")} hinzugefügt`);
    } else {
      console.log("   ⏭️  student_fees: alle Rabatt-Felder vorhanden");
    }
  }

  // 9e. students: individueller Rabatt (v5)
  if (collectionMap.students) {
    const studentsCol = (await getExistingCollections()).find((c) => c.name === "students");
    const existingFieldNames = (studentsCol?.schema || []).map((f) => f.name);
    const studentsV5Fields = [
      { name: "custom_discount_percent", type: "number", options: { min: 0, max: 100, default: 0 } },
    ].filter((f) => !existingFieldNames.includes(f.name));
    if (studentsV5Fields.length > 0) {
      const newSchema = [...(studentsCol?.schema || []), ...studentsV5Fields];
      await updateCollection("students", { schema: newSchema });
      console.log(`   ✅ students: ${studentsV5Fields.map((f) => f.name).join(", ")} hinzugefügt`);
    } else {
      console.log("   ⏭️  students: custom_discount_percent bereits vorhanden");
    }
  }

  // 10a. invites: role-Feld um "editor" erweitern
  if (collectionMap.invites) {
    const invitesCol = (await getExistingCollections()).find((c) => c.name === "invites");
    const roleField = (invitesCol?.schema || []).find((f) => f.name === "role");
    if (roleField && roleField.options?.values) {
      const currentValues = roleField.options.values;
      const requiredRoles = ["member", "teacher", "imam", "editor", "admin", "madrasa_admin", "treasurer", "secretary"];
      const missingRoles = requiredRoles.filter((r) => !currentValues.includes(r));
      if (missingRoles.length > 0) {
        const updatedSchema = (invitesCol.schema || []).map((f) =>
          f.name === "role" ? { ...f, options: { ...f.options, values: requiredRoles } } : f
        );
        await updateCollection("invites", { schema: updatedSchema });
        console.log(`   ✅ invites: role-Feld erweitert um: ${missingRoles.join(", ")}`);
      } else {
        console.log("   ⏭️  invites: role-Feld enthält bereits alle Rollen");
      }
    }
  }

  // 11. students: neue Felder (v3)
  if (collectionMap.students) {
    const studentsCol = (await getExistingCollections()).find((c) => c.name === "students");
    const existingFieldNames = (studentsCol?.schema || []).map((f) => f.name);
    const studentsNewFields = [
      { name: "last_year_attended", type: "bool", options: { default: false } },
      { name: "last_year_teacher", type: "text", options: { max: 200 } },
      {
        name: "whatsapp_contact",
        type: "select",
        options: { values: ["mother", "father", "both"], maxSelect: 1 },
      },
      { name: "parent_is_member", type: "bool", options: { default: false } },
      { name: "privacy_accepted_at", type: "date" },
    ];
    const fieldsToAdd = studentsNewFields.filter((f) => !existingFieldNames.includes(f.name));
    if (fieldsToAdd.length > 0) {
      const newSchema = [...(studentsCol?.schema || []), ...fieldsToAdd];
      await updateCollection("students", { schema: newSchema });
      console.log(`   ✅ students: ${fieldsToAdd.map((f) => f.name).join(", ")} hinzugefügt`);
    } else {
      console.log("   ⏭️  students: alle v3-Felder vorhanden");
    }
  }

  // 12. students: neue Felder (v4) — Vater/Mutter Portal-User-IDs
  if (collectionMap.students) {
    const studentsCol = (await getExistingCollections()).find((c) => c.name === "students");
    const existingFieldNames = (studentsCol?.schema || []).map((f) => f.name);
    const studentsV4Fields = [
      { name: "father_user_id", type: "text", options: { max: 100 } },
      { name: "mother_user_id", type: "text", options: { max: 100 } },
    ];
    const fieldsToAdd = studentsV4Fields.filter((f) => !existingFieldNames.includes(f.name));
    if (fieldsToAdd.length > 0) {
      const newSchema = [...(studentsCol?.schema || []), ...fieldsToAdd];
      await updateCollection("students", { schema: newSchema });
      console.log(`   ✅ students: ${fieldsToAdd.map((f) => f.name).join(", ")} hinzugefügt`);
    } else {
      console.log("   ⏭️  students: alle v4-Felder vorhanden");
    }
  }

  // 10. audit_logs: before_json + after_json + neue Indexes
  if (collectionMap.audit_logs) {
    const auditCol = (await getExistingCollections()).find((c) => c.name === "audit_logs");
    const existingFieldNames = (auditCol?.schema || []).map((f) => f.name);
    const auditNewFields = [
      { name: "before_json", type: "json", options: { maxSize: 2000000 } },
      { name: "after_json", type: "json", options: { maxSize: 2000000 } },
    ];
    const fieldsToAdd = auditNewFields.filter((f) => !existingFieldNames.includes(f.name));
    if (fieldsToAdd.length > 0) {
      const newSchema = [...(auditCol?.schema || []), ...fieldsToAdd];
      await updateCollection("audit_logs", { schema: newSchema });
      console.log(`   ✅ audit_logs: ${fieldsToAdd.map((f) => f.name).join(", ")} hinzugefügt`);
    } else {
      console.log("   ⏭️  audit_logs: before_json/after_json bereits vorhanden");
    }
  }

  // 12. sponsors: neue Felder hinzufügen (contact_user_id, contact_email, provider_ref, paid_at)
  if (collectionMap.sponsors) {
    const sponsorsCol = (await getExistingCollections()).find((c) => c.name === "sponsors");
    const existingFieldNames = (sponsorsCol?.schema || []).map((f) => f.name);
    const fieldsToAdd = SPONSORS_NEW_FIELDS.filter((f) => !existingFieldNames.includes(f.name)).map((f) => {
      if (f.type === "relation" && f.options?.collectionId === "") {
        return { ...f, options: { ...f.options, collectionId: collectionMap["users"] || "" } };
      }
      return f;
    });
    if (fieldsToAdd.length > 0) {
      const newSchema = [...(sponsorsCol?.schema || []), ...fieldsToAdd];
      await updateCollection("sponsors", { schema: newSchema });
      console.log(`   ✅ sponsors: ${fieldsToAdd.map((f) => f.name).join(", ")} hinzugefügt`);
    } else {
      console.log("   ⏭️  sponsors: alle neuen Felder vorhanden");
    }

    // payment_method um "stripe" erweitern
    const sponsorsColCurrent = (await getExistingCollections()).find((c) => c.name === "sponsors");
    const pmField = (sponsorsColCurrent?.schema || []).find((f) => f.name === "payment_method");
    if (pmField && pmField.options?.values) {
      const currentValues = pmField.options.values;
      if (!currentValues.includes("stripe")) {
        const newValues = [...currentValues, "stripe"];
        const updatedSchema = (sponsorsColCurrent.schema || []).map((f) =>
          f.name === "payment_method" ? { ...f, options: { ...f.options, values: newValues } } : f
        );
        await updateCollection("sponsors", { schema: updatedSchema });
        console.log("   ✅ sponsors.payment_method: 'stripe' hinzugefügt");
      } else {
        console.log("   ⏭️  sponsors.payment_method: 'stripe' bereits vorhanden");
      }
    }
  }

  // 13. inquiries: Kontaktanfragen (plattformweit, kein mosque_id)
  // Lösch-Strategie: Records älter als 180 Tage per Cron löschen.
  const inquiriesExists = await collectionExists("inquiries");
  if (!inquiriesExists) {
    await createCollection({
      name: "inquiries",
      type: "base",
      schema: [
        { name: "name",                type: "text",   required: true,  options: { max: 100 } },
        { name: "email",               type: "email",  required: true },
        { name: "organization",        type: "text",   required: false, options: { max: 100 } },
        {
          name: "inquiry_type",
          type: "select",
          required: true,
          options: { values: ["demo", "support", "partnership", "bug", "feedback", "other"], maxSelect: 1 },
        },
        { name: "message",             type: "text",   required: true,  options: { max: 5000 } },
        { name: "privacy_accepted",    type: "bool",   required: true },
        { name: "privacy_accepted_at", type: "date",   required: true },
        { name: "ip_address",          type: "text",   required: false, options: { max: 64 } }, // SHA-256 Hash
        {
          name: "status",
          type: "select",
          options: { values: ["new", "in_progress", "done", "spam"], maxSelect: 1 },
        },
      ],
    });
  } else {
    console.log(`   ⏭️  "inquiries" existiert bereits`);
  }

  // 14. contact_messages: Per-Moschee Kontaktanfragen (DSGVO-konform)
  // Lösch-Strategie: Records älter als 180 Tage per Cron löschen.
  const contactMessagesExists = await collectionExists("contact_messages");
  if (!contactMessagesExists) {
    const mosquesCol = (await getExistingCollections()).find((c) => c.name === "mosques");
    await createCollection({
      name: "contact_messages",
      type: "base",
      schema: [
        {
          name: "mosque_id",
          type: "relation",
          required: true,
          options: { collectionId: mosquesCol?.id || "", maxSelect: 1, cascadeDelete: false },
        },
        { name: "name",                type: "text",   required: true,  options: { max: 100 } },
        { name: "email",               type: "email",  required: true },
        { name: "organization",        type: "text",   required: false, options: { max: 100 } },
        {
          name: "inquiry_type",
          type: "select",
          required: true,
          options: { values: ["demo", "support", "partnership", "bug", "feedback", "other"], maxSelect: 1 },
        },
        { name: "message",             type: "text",   required: true,  options: { max: 5000 } },
        { name: "privacy_accepted",    type: "bool",   required: true },
        { name: "privacy_accepted_at", type: "date",   required: true },
        { name: "ip_address",          type: "text",   required: false, options: { max: 64 } }, // SHA-256+Salt Hash, kein Klartext
        {
          name: "status",
          type: "select",
          options: { values: ["new", "in_progress", "done", "spam"], maxSelect: 1 },
        },
      ],
    });
  } else {
    console.log(`   ⏭️  "contact_messages" existiert bereits`);
  }

  // 15. attendance: performance-Feld hinzufügen
  if (collectionMap.attendance) {
    const attCol = (await getExistingCollections()).find((c) => c.name === "attendance");
    const existingFieldNames = (attCol?.schema || []).map((f) => f.name);
    if (!existingFieldNames.includes("performance")) {
      const newSchema = [
        ...(attCol?.schema || []),
        { name: "performance", type: "number", required: false, options: { min: 1, max: 5 } },
      ];
      await updateCollection("attendance", { schema: newSchema });
      console.log("   ✅ attendance: performance-Feld hinzugefügt");
    } else {
      console.log("   ⏭️  attendance: performance-Feld bereits vorhanden");
    }
  }

  // Daten-Migration: sibling_discount_enabled für bestehende Settings-Records setzen
  // Hintergrund: PB setzt bei neuen Feldern null für bestehende Records — kein Default.
  // Wenn Prozentsätze konfiguriert sind aber sibling_discount_enabled null ist, auf true setzen.
  console.log("\n=== Daten-Migration: sibling_discount_enabled ===");
  {
    let settingsRecords = [];
    try {
      const res = await pbFetch(
        `/api/collections/settings/records?perPage=500`
      );
      settingsRecords = res?.items ?? [];
    } catch (e) {
      console.log("   ⚠️  Settings-Collection konnte nicht geladen werden:", e.message);
    }
    let updated = 0;
    for (const rec of settingsRecords) {
      const d2 = rec.sibling_discount_2nd_percent || 0;
      const d3 = rec.sibling_discount_3rd_percent || 0;
      if (rec.sibling_discount_enabled != null) continue; // bereits explizit gesetzt
      if (d2 === 0 && d3 === 0) continue; // keine Prozentsätze konfiguriert
      await pbFetch(`/api/collections/settings/records/${rec.id}`, {
        method: "PATCH",
        body: JSON.stringify({ sibling_discount_enabled: true }),
      });
      console.log(`   ✅ ${rec.mosque_id} → sibling_discount_enabled: true`);
      updated++;
    }
    if (updated === 0) console.log("   ⏭️  Alle Records bereits konfiguriert");
  }

  // 16. events: Bezahlte Events (is_paid, price_cents)
  if (collectionMap.events) {
    const eventsCol = (await getExistingCollections()).find((c) => c.name === "events");
    const existingFieldNames = (eventsCol?.schema || []).map((f) => f.name);
    const eventsPaidFields = [
      { name: "is_paid", type: "bool", options: { default: false } },
      { name: "price_cents", type: "number", options: { min: 0, default: 0 } },
    ].filter((f) => !existingFieldNames.includes(f.name));
    if (eventsPaidFields.length > 0) {
      const newSchema = [...(eventsCol?.schema || []), ...eventsPaidFields];
      await updateCollection("events", { schema: newSchema });
      console.log(`   ✅ events: ${eventsPaidFields.map((f) => f.name).join(", ")} hinzugefügt`);
    } else {
      console.log("   ⏭️  events: is_paid/price_cents bereits vorhanden");
    }
  }

  // 17. event_registrations: Zahlungsfelder (payment_status, payment_method, usw.)
  if (collectionMap.event_registrations) {
    const regCol = (await getExistingCollections()).find((c) => c.name === "event_registrations");
    const existingFieldNames = (regCol?.schema || []).map((f) => f.name);
    const regPaymentFields = [
      {
        name: "payment_status",
        type: "select",
        options: { values: ["free", "pending", "pending_sepa", "paid", "expired", "failed"], maxSelect: 1 },
      },
      {
        name: "payment_method",
        type: "select",
        options: { values: ["card", "sepa", "cash"], maxSelect: 1 },
      },
      { name: "original_payment_method", type: "text" },
      { name: "payment_ref", type: "text" },
      { name: "checkout_url", type: "text" },
      { name: "expires_at", type: "date" },
      { name: "paid_at", type: "date" },
      { name: "cancel_reason", type: "text" },
    ].filter((f) => !existingFieldNames.includes(f.name));
    if (regPaymentFields.length > 0) {
      const newSchema = [...(regCol?.schema || []), ...regPaymentFields];
      await updateCollection("event_registrations", { schema: newSchema });
      console.log(`   ✅ event_registrations: ${regPaymentFields.map((f) => f.name).join(", ")} hinzugefügt`);
    } else {
      console.log("   ⏭️  event_registrations: alle Zahlungsfelder vorhanden");
    }

    // event_registrations.status: "pending" + "expired" ergänzen
    const regColCurrent = (await getExistingCollections()).find((c) => c.name === "event_registrations");
    const statusField = (regColCurrent?.schema || []).find((f) => f.name === "status");
    if (statusField && statusField.options?.values) {
      const requiredStatuses = ["registered", "cancelled", "attended", "no_show", "pending", "expired"];
      const missingStatuses = requiredStatuses.filter((s) => !statusField.options.values.includes(s));
      if (missingStatuses.length > 0) {
        const updatedSchema = (regColCurrent.schema || []).map((f) =>
          f.name === "status" ? { ...f, options: { ...f.options, values: requiredStatuses } } : f
        );
        await updateCollection("event_registrations", { schema: updatedSchema });
        console.log(`   ✅ event_registrations.status: ${missingStatuses.join(", ")} hinzugefügt`);
      } else {
        console.log("   ⏭️  event_registrations.status: alle Werte vorhanden");
      }
    }
  }

  // 18. settings: Wiederkehrende-Spenden-Felder
  if (collectionMap.settings) {
    const settingsCol = (await getExistingCollections()).find((c) => c.name === "settings");
    const existingFieldNames = (settingsCol?.schema || []).map((f) => f.name);
    const fieldsToAdd = SETTINGS_RECURRING_FIELDS.filter((f) => !existingFieldNames.includes(f.name));
    if (fieldsToAdd.length > 0) {
      const newSchema = [...(settingsCol?.schema || []), ...fieldsToAdd];
      await updateCollection("settings", { schema: newSchema });
      console.log(`   ✅ settings (recurring): ${fieldsToAdd.map((f) => f.name).join(", ")} hinzugefügt`);
    } else {
      console.log("   ⏭️  settings: alle Recurring-Felder vorhanden");
    }
  }

  // 19. recurring_subscriptions: neue Felder + Status-Enum erweitern
  if (collectionMap.recurring_subscriptions) {
    const subCol = (await getExistingCollections()).find((c) => c.name === "recurring_subscriptions");
    const existingFieldNames = (subCol?.schema || []).map((f) => f.name);
    const fieldsToAdd = RECURRING_SUBSCRIPTIONS_NEW_FIELDS.filter((f) => !existingFieldNames.includes(f.name));
    let currentSchema = subCol?.schema || [];
    if (fieldsToAdd.length > 0) {
      currentSchema = [...currentSchema, ...fieldsToAdd];
      await updateCollection("recurring_subscriptions", { schema: currentSchema });
      console.log(`   ✅ recurring_subscriptions: ${fieldsToAdd.map((f) => f.name).join(", ")} hinzugefügt`);
    } else {
      console.log("   ⏭️  recurring_subscriptions: alle neuen Felder vorhanden");
    }

    // Status-Enum: "pending" ergänzen, "paused" bleibt erhalten (alte Records)
    const subColCurrent = (await getExistingCollections()).find((c) => c.name === "recurring_subscriptions");
    const statusField = (subColCurrent?.schema || []).find((f) => f.name === "status");
    if (statusField && statusField.options?.values) {
      const currentValues = statusField.options.values;
      const required = ["pending", "active", "cancelled"];
      const missing = required.filter((v) => !currentValues.includes(v));
      if (missing.length > 0) {
        const merged = Array.from(new Set([...currentValues, ...required]));
        const updatedSchema = (subColCurrent.schema || []).map((f) =>
          f.name === "status" ? { ...f, options: { ...f.options, values: merged } } : f
        );
        await updateCollection("recurring_subscriptions", { schema: updatedSchema });
        console.log(`   ✅ recurring_subscriptions.status: ${missing.join(", ")} hinzugefügt`);
      } else {
        console.log("   ⏭️  recurring_subscriptions.status: alle Werte vorhanden");
      }
    }

    // Index auf provider_subscription_id
    const idxName = "idx_recsub_provider_sub";
    const idxSql = `CREATE INDEX ${idxName} ON recurring_subscriptions (provider_subscription_id)`;
    const subColWithIdx = (await getExistingCollections()).find((c) => c.name === "recurring_subscriptions");
    const existingIndexes = subColWithIdx?.indexes || [];
    if (!existingIndexes.some((i) => i.includes(idxName))) {
      await updateCollection("recurring_subscriptions", {
        schema: subColWithIdx.schema,
        indexes: [...existingIndexes, idxSql],
      });
      console.log(`   ✅ recurring_subscriptions: Index ${idxName} hinzugefügt`);
    } else {
      console.log(`   ⏭️  recurring_subscriptions: Index ${idxName} bereits vorhanden`);
    }
  }

  // 20. donations: Status-Enum um "disputed" erweitern + Unique-Index auf provider_ref
  if (collectionMap.donations) {
    const donCol = (await getExistingCollections()).find((c) => c.name === "donations");
    const statusField = (donCol?.schema || []).find((f) => f.name === "status");
    if (statusField && statusField.options?.values) {
      const currentValues = statusField.options.values;
      if (!currentValues.includes("disputed")) {
        const newValues = [...currentValues, "disputed"];
        const updatedSchema = (donCol.schema || []).map((f) =>
          f.name === "status" ? { ...f, options: { ...f.options, values: newValues } } : f
        );
        await updateCollection("donations", { schema: updatedSchema });
        console.log("   ✅ donations.status: 'disputed' hinzugefügt");
      } else {
        console.log("   ⏭️  donations.status: 'disputed' bereits vorhanden");
      }
    }

    // provider-Enum: "sepa" hinzufügen
    const providerField = (donCol?.schema || []).find((f) => f.name === "provider");
    if (providerField && providerField.options?.values && !providerField.options.values.includes("sepa")) {
      const newProviderValues = [...providerField.options.values, "sepa"];
      const updatedProviderSchema = (donCol.schema || []).map((f) =>
        f.name === "provider" ? { ...f, options: { ...f.options, values: newProviderValues } } : f
      );
      await updateCollection("donations", { schema: updatedProviderSchema });
      console.log("   ✅ donations.provider: 'sepa' hinzugefügt");
    } else if (providerField?.options?.values?.includes("sepa")) {
      console.log("   ⏭️  donations.provider: 'sepa' bereits vorhanden");
    }

    // Unique-Index (mosque_id, provider, provider_ref) WHERE provider_ref != ""
    const idxName = "idx_donations_provider_ref";
    const idxSql = `CREATE UNIQUE INDEX ${idxName} ON donations (mosque_id, provider, provider_ref) WHERE provider_ref != ""`;
    const donColWithIdx = (await getExistingCollections()).find((c) => c.name === "donations");
    const existingIndexes = donColWithIdx?.indexes || [];
    if (!existingIndexes.some((i) => i.includes(idxName))) {
      await updateCollection("donations", {
        schema: donColWithIdx.schema,
        indexes: [...existingIndexes, idxSql],
      });
      console.log(`   ✅ donations: Unique-Index ${idxName} hinzugefügt`);
    } else {
      console.log(`   ⏭️  donations: Index ${idxName} bereits vorhanden`);
    }
  }

  console.log("\n=== ✅ Migration abgeschlossen ===\n");

  // 7. .env.local Hinweis
  console.log("📝 Stelle sicher, dass folgende Keys in .env.local gesetzt sind:");
  console.log("   PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD, POCKETBASE_URL, STRIPE_WEBHOOK_SECRET");
  console.log("");
}

main().catch((err) => {
  console.error("\n❌ Migration fehlgeschlagen:", err.message);
  process.exit(1);
});
