// =========================================
// Zentrale Typ-Definitionen - Moschee-Portal V1
// 11 PocketBase Collections + Hilfstypen
// =========================================

// --- 1. Mosques (Moscheen / Vereine) ---
export interface Mosque {
  id: string;
  name: string;
  slug: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  timezone: string; // z.B. "Europe/Berlin"
  phone: string;
  email: string;
  public_enabled: boolean;
  donation_provider: "stripe" | "paypal" | "external" | "none";
  paypal_donate_url: string;
  external_donation_url: string;
  external_donation_label: string;
  zip_code: string;
  website: string;
  brand_logo: string;
  brand_primary_color: string;
  brand_accent_color: string;
  brand_theme: string; // preset-id oder "custom"
  created: string;
  updated: string;
}

// --- Hilfstyp: Externe Spendenkonfiguration ---
export interface ExternalDonationConfig {
  enabled: boolean;
  label: string;
  url: string;
  description: string;
}

// --- 2. Settings (1 Zeile pro Moschee) ---
export interface Settings {
  id: string;
  mosque_id: string;
  public_dashboard_enabled: boolean;
  members_dashboard_enabled: boolean;
  public_finance_enabled: boolean;
  newsletter_enabled: boolean;
  allow_guest_event_registration: boolean;
  allow_guest_donations: boolean;
  guest_registration_rate_limit_per_ip_per_hour: number;
  guest_registration_email_verify: boolean;
  prayer_provider: "aladhan" | "off"; // "aladhan" (default) | "off"
  prayer_method: number;              // Aladhan method (default: 13 = Diyanet)
  tune: string;                       // JSON: TuneOffsets (Minuten-Offsets je Gebet)
  locale: string;                     // "de" | "tr"
  default_post_visibility: string;    // "public" | "members"
  default_event_visibility: string;   // "public" | "members"
  donation_quick_amounts: string;     // "10,25,50,100"
  // Madrasa-Gebühren
  madrasa_fees_enabled: boolean;
  madrasa_default_fee_cents: number;  // z.B. 1000 = 10 €
  created: string;
  updated: string;
}

// --- 3. Users (PocketBase Auth Collection) ---
export interface User {
  id: string;
  mosque_id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string; // deprecated, Abwärtskompatibilität
  phone: string;
  member_no: string;
  membership_number: string; // deprecated alias für member_no
  status: "pending" | "active" | "inactive" | "blocked";
  role: "admin" | "member" | "teacher" | "imam";
  created: string;
  updated: string;
}

// --- 4. Posts (WhatsApp-Ersatz / Beiträge) ---
export interface Post {
  id: string;
  mosque_id: string;
  title: string;
  content: string;
  category: "announcement" | "youth" | "campaign" | "event" | "general";
  visibility: "public" | "members";
  pinned: boolean;
  status: "published" | "draft";
  published_at: string;
  attachments: string[];
  created_by: string;
  created: string;
  updated: string;
  expand?: {
    created_by?: User;
  };
}

// --- 5. Events (Veranstaltungen) ---
export interface Event {
  id: string;
  mosque_id: string;
  title: string;
  description: string;
  category: "youth" | "lecture" | "quran" | "community" | "ramadan" | "other";
  location_name: string;
  start_at: string;
  start_prayer: string; // "" | "fajr" | "dhuhr" | "asr" | "maghrib" | "isha"
  end_at: string;
  duration_minutes: number; // 0 = keine Angabe
  visibility: "public" | "members";
  capacity: number; // 0 = unbegrenzt
  status: "published" | "cancelled" | "draft";
  cover_image: string;
  created_by: string;
  created: string;
  updated: string;
  // Wiederkehrende Events
  is_recurring?: boolean;
  recurrence_type?: "daily" | "weekly" | "monthly" | "";
  recurrence_day_of_week?: string; // "monday" … "sunday"
  recurrence_day_of_month?: number; // 1–31
  recurrence_end_date?: string;
  expand?: {
    created_by?: User;
  };
}

// --- 6. Event Registrations (Gast + Mitglied) ---
export interface EventRegistration {
  id: string;
  mosque_id: string;
  event_id: string;
  registrant_type: "member" | "guest";
  user_id: string; // optional, nur bei member
  guest_name: string; // nur bei guest
  guest_email: string; // nur bei guest
  status: "registered" | "cancelled" | "attended" | "no_show";
  registered_at: string;
  cancelled_at: string;
  verify_token: string;
  verified_at: string;
  source_ip_hash: string;
  user_agent: string;
  created: string;
  updated: string;
}

// --- 7. Campaigns (Spendenkampagnen) ---
export interface Campaign {
  id: string;
  mosque_id: string;
  title: string;
  description: string;
  category: "ramadan" | "construction" | "aid" | "maintenance" | "general";
  goal_amount_cents: number;
  currency: string; // default "EUR"
  start_at: string;
  end_at: string;
  status: "active" | "paused" | "completed";
  cover_image: string;
  created_by: string;
  created: string;
  updated: string;
}

// --- 8. Donations (Spenden) ---
export interface Donation {
  id: string;
  mosque_id: string;
  campaign_id: string; // optional
  donor_type: "member" | "guest";
  user_id: string; // optional
  donor_name: string;
  donor_email: string;
  amount: number; // EUR (Pflichtfeld in PB)
  amount_cents: number;
  currency: string; // default "EUR"
  is_recurring: boolean;
  subscription_id: string; // optional, Relation → recurring_subscriptions
  provider: "stripe" | "paypal_link" | "external" | "manual";
  provider_ref: string; // Stripe Session ID, etc.
  status: "created" | "pending" | "paid" | "failed" | "refunded" | "cancelled";
  paid_at: string;
  created: string;
  updated: string;
}

// --- 9. Recurring Subscriptions (Daueraufträge) ---
export interface RecurringSubscription {
  id: string;
  mosque_id: string;
  donor_type: "member" | "guest";
  user_id: string;
  donor_email: string;
  campaign_id: string;
  amount_cents: number;
  currency: string;
  interval: "monthly";
  provider: "stripe";
  provider_subscription_id: string;
  status: "active" | "paused" | "cancelled";
  started_at: string;
  cancelled_at: string;
  created: string;
  updated: string;
}

// --- 10. Email Outbox (E-Mail-Protokoll) ---
export interface EmailOutbox {
  id: string;
  mosque_id: string;
  type:
    | "newsletter"
    | "event_confirmation"
    | "event_reminder"
    | "donation_receipt"
    | "guest_event_verify"
    | "fee_reminder"
    | "admin_notification";
  to_email: string;
  subject: string;
  body_html: string;
  status: "queued" | "sent" | "failed";
  sent_at: string;
  created_by: string;
  meta_json: string; // JSON string
  created: string;
  updated: string;
}

// --- 11. Audit Logs ---
export interface AuditLog {
  id: string;
  mosque_id: string;
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_json: string; // JSON — Zustand vor der Änderung (nullable)
  after_json: string;  // JSON — Zustand nach der Änderung (nullable)
  diff_json: string;   // JSON — Legacy / ergänzende Details
  created: string;
}

// --- 12. Students (Madrasa-Schüler) ---
export interface Student {
  id: string;
  mosque_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: "male" | "female" | "";
  parent_id: string; // optional Relation → users (Elternteil als Mitglied)
  parent_name: string; // Freitext wenn kein Portal-Mitglied
  parent_phone: string;
  // Erweiterte Felder (v2)
  address: string;
  school_name: string;
  school_class: string;
  health_notes: string;
  mother_name: string;
  mother_phone: string;
  father_name: string;
  father_phone: string;
  membership_status: "active" | "none" | "planned" | "";
  notes: string;
  status: "active" | "inactive";
  created: string;
  updated: string;
  expand?: {
    parent_id?: User;
  };
}

// --- 13. Academic Years (Schuljahre) ---
export interface AcademicYear {
  id: string;
  mosque_id: string;
  name: string; // z.B. "2025/26"
  start_date: string;
  end_date: string;
  status: "active" | "archived";
  created: string;
  updated: string;
}

// --- 13. Courses (Madrasa-Kurse) ---
export interface Course {
  id: string;
  mosque_id: string;
  academic_year_id: string; // Relation → academic_years
  title: string;
  description: string;
  category: "quran" | "tajweed" | "fiqh" | "arabic" | "sira" | "islamic_studies" | "other";
  level: "beginner" | "intermediate" | "advanced" | "mixed";
  teacher_id: string; // Relation → users (role=teacher)
  day_of_week: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
  start_time: string; // z.B. "16:00"
  end_time: string; // z.B. "17:30"
  location_name: string;
  max_students: number; // 0 = unbegrenzt
  status: "active" | "paused" | "archived";
  created_by: string;
  created: string;
  updated: string;
  expand?: {
    teacher_id?: User;
    created_by?: User;
    academic_year_id?: AcademicYear;
  };
}

// --- 15. Course Enrollments (Kurseinschreibungen) ---
export interface CourseEnrollment {
  id: string;
  mosque_id: string;
  course_id: string;
  student_id: string; // Relation → students
  status: "enrolled" | "completed" | "dropped" | "on_hold";
  enrolled_at: string;
  completed_at: string;
  notes: string;
  created: string;
  updated: string;
  expand?: {
    course_id?: Course;
    student_id?: Student;
  };
}

// --- 16. Attendance (Anwesenheit) ---
export interface Attendance {
  id: string;
  mosque_id: string;
  course_id: string;
  student_id: string; // Relation → students
  session_date: string;
  status: "present" | "absent" | "late" | "excused";
  notes: string;
  marked_by: string; // Relation → users (Lehrer/Admin)
  created: string;
  updated: string;
  expand?: {
    student_id?: Student;
  };
}

// --- Kurs mit Statistiken ---
export interface CourseWithStats extends Course {
  enrolled_count: number;
  teacher_name?: string;
}

// --- 17. Invites (Einladungslinks) ---
export interface Invite {
  id: string;
  mosque_id: string;
  created_by: string;
  token: string;
  type: "personal" | "group";
  label: string;
  email: string;
  role: "member" | "teacher" | "admin" | "imam";
  initial_status: "pending" | "active";
  max_uses: number; // 1 für personal, n für group (0=unbegrenzt)
  uses_count: number;
  expires_at: string;
  is_active: boolean;
  created: string;
  updated: string;
}

// =========================================
// Hilfstypen
// =========================================

// --- Prayer Times (Provider Layer) ---
export interface PrayerTimes {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  date: string;      // "YYYY-MM-DD"
  hijriDate: string; // z.B. "02 Sha'ban 1447"
  provider: "aladhan";
}

export interface TuneOffsets {
  fajr: number;
  sunrise: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

// Cache-Collection für monatliche Kalender-Daten
export interface PrayerTimesCache {
  id: string;
  mosque_id: string;
  month_key: string;     // "YYYY-MM"
  calendar_json: string; // JSON-Array der AlAdhan-Tageseinträge
  fetched_at: string;    // ISO-Datum
  created: string;
  updated: string;
}

/** @deprecated Verwende PrayerTimes stattdessen */
export interface PrayerTime {
  name: string;
  time: string;
}

// --- Navigation ---
export interface NavigationItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

// --- Campaign mit berechnetem Fortschritt ---
export interface CampaignWithProgress extends Campaign {
  raised_cents: number;
  donor_count: number;
  progress_percent: number;
}

// --- 18. Student Fees (Madrasa-Gebühren) ---
export interface StudentFee {
  id: string;
  mosque_id: string;
  student_id: string;         // Relation → students
  month_key: string;          // "YYYY-MM"
  amount_cents: number;
  status: "open" | "paid" | "waived";
  paid_at: string;
  payment_method: "cash" | "transfer" | "stripe" | "waived" | "";
  provider_ref: string;       // Stripe Session ID
  notes: string;
  created_by: string;         // Relation → users
  created: string;
  updated: string;
  expand?: {
    student_id?: Student;
  };
}

// --- StudentFee mit Schüler-Info (für Übersichten) ---
export interface StudentFeeWithStudent extends StudentFee {
  student_name: string;
  student: Student;
}
