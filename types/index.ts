// =========================================
// Zentrale Typ-Definitionen - Moschee-Portal V1
// 11 PocketBase Collections + Hilfstypen
// =========================================

// Inline-Typ für Eltern-Kind-Beziehungstyp (gespiegelt aus lib/constants.ts, um Zirkularimporte zu vermeiden)
export type RelationType = 'father' | 'mother' | 'guardian' | 'other';

// --- 1. Mosques (Moscheen / Vereine) ---
export type PaymentsMode = "disabled" | "platform_legacy" | "connect_test" | "connect_live";

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
  paypal_enabled: boolean;
  external_donation_url: string;
  external_donation_label: string;
  zip_code: string;
  website: string;
  brand_logo: string;
  brand_primary_color: string;
  brand_accent_color: string;
  brand_theme: string; // preset-id oder "custom"
  brand_hero_type: string; // "color" | "image"
  brand_hero_image: string;
  // Stripe Connect (Express, Direct Charges)
  stripe_account_id: string;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  stripe_details_submitted: boolean;
  stripe_requirements_currently_due: string[];
  stripe_requirements_eventually_due: string[];
  payments_mode: PaymentsMode;
  stripe_onboarded_at: string;
  stripe_last_synced_at: string;
  // Per-Capability Status (Stripe = Source of Truth, lokal Cache)
  stripe_card_payments_status: CapabilityStatus;
  stripe_sepa_debit_payments_status: CapabilityStatus;
  created: string;
  updated: string;
}

export type CapabilityStatus = "inactive" | "pending" | "active";

// Stripe Webhook Idempotenz
export interface StripeEvent {
  id: string;
  event_id: string;
  type: string;
  api_version: string;
  account_id: string;
  mosque_id: string;
  received_at: string;
  processed_at: string;
  status: "received" | "processed" | "failed";
  error: string;
  payload_hash: string;
  payload_preview: string;
  created: string;
  updated: string;
}

export type StripeHealth = "disabled" | "pending" | "restricted" | "healthy";

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
  fee_reminder_enabled: boolean;      // Automatische Gebühren-Erinnerung
  fee_reminder_day: number;           // Tag im Monat (1-28)
  // Geschwister-Rabatt
  sibling_discount_enabled: boolean;
  sibling_discount_2nd_percent: number; // 0–100
  sibling_discount_3rd_percent: number; // 0–100 (gilt ab 3. Kind)
  // Förderpartner
  sponsors_enabled: boolean;
  sponsors_visibility: "public" | "members";
  // Leitung & Team
  team_enabled: boolean;
  team_visibility: "public" | "members";
  // Kontaktformular
  contact_enabled: boolean;
  contact_email: string;
  contact_notify_admin: boolean;
  contact_auto_reply: boolean;
  // Wiederkehrende Spenden
  recurring_donations_enabled: boolean;
  recurring_min_cents: number;
  recurring_quick_amounts: string; // CSV "500,1000,2000,5000"
  // Mitgliedsbeitrags-Einzug (Session 27)
  membership_fees_enabled: boolean;
  membership_default_fee_cents: number;
  membership_default_interval: "monthly" | "quarterly" | "yearly";
  membership_reconcile_cursor: string; // JSON: { "<stripe_account_id>": { "last_invoice_created": <unix> } }
  // Finanzmodul (Sprint 3/4)
  finance_hard_lock_until: string;       // ISO date — MANUAL_WRITE ≤ Datum gesperrt
  finance_enabled: boolean;              // Admin-Modul-Gate (≠ public_finance_enabled)
  kassenbuch_start_year: number;         // Initialjahr der Buchführung
  kassenbuch_bar_start_cents: number;    // Anfangsbestand Bar im Startjahr
  kassenbuch_bank_start_cents: number;   // Anfangsbestand Bank im Startjahr
  // SEPA-Lastschrift Opt-In pro Moschee
  sepa_enabled: boolean;
  // Vereinsangaben für Spendenbescheinigungen (BMF-konform)
  verein_anschrift: string;            // Mehrzeilige Anschrift (Fallback: Moschee-Adresse)
  verein_steuernummer: string;         // Steuernummer des Vereins
  freistellungsbescheid_text: string;  // Frei konfigurierbarer Freistellungsbescheid-Satz
  verein_foerderzweck: string;         // Konfigurierbarer steuerbegünstigter Förderzweck
  created: string;
  updated: string;
}

// --- 2b. Förderpartner (Sponsors) ---
export type SponsorCategory =
  | "gastronomie" | "lebensmittel" | "automobil" | "handwerk"
  | "gesundheit" | "bildung" | "reise" | "mode"
  | "immobilien" | "it_technik" | "dienstleistungen" | "sonstiges";

export interface Sponsor {
  id: string;
  mosque_id: string;
  name: string;
  logo?: string;
  description?: string;
  website_url?: string;
  category?: SponsorCategory;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  is_approved: boolean;
  notification_sent: boolean;
  sort_order: number;
  payment_status: "open" | "paid";
  payment_method?: "cash" | "transfer" | "stripe";
  amount_cents?: number;
  contact_user_id?: string;
  contact_email?: string;
  provider_ref?: string;
  paid_at?: string;
  months_paid?: number;
  created: string;
  updated: string;
}

// --- 2c. Team Members (Leitung & Team) ---
export interface TeamMember {
  id: string;
  mosque_id: string;
  name: string;
  role: string;
  bio?: string;
  photo?: string;
  email?: string;
  group?: string;
  sort_order: number;
  is_active: boolean;
  created_by?: string;
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
  address: string;
  member_no: string;
  membership_number: string; // deprecated alias für member_no
  status: "pending" | "active" | "inactive" | "blocked";
  role: "admin" | "member" | "teacher" | "imam" | "editor" | "super_admin" | "madrasa_admin" | "treasurer" | "secretary";
  created: string;
  updated: string;
}

// --- Web-Push Subscriptions ---
export type PushTopic =
  | "prayer_times"
  | "events"
  | "donations"
  | "posts"
  | "madrasa";

export interface PushSubscriptionRecord {
  id: string;
  mosque_id: string;
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  device_label: string;
  topics: PushTopic[];
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
  recurrence_month_mode?: "day" | "weekday"; // "day" = fester Tag, "weekday" = N. Wochentag
  recurrence_month_week?: number; // 1–4 oder -1 (letzter)
  recurrence_month_weekday?: string; // "monday"–"sunday"
  recurrence_end_date?: string;
  // Bezahlte Events
  is_paid?: boolean;
  price_cents?: number;
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
  status: "registered" | "cancelled" | "attended" | "no_show" | "pending" | "expired";
  registered_at: string;
  cancelled_at: string;
  verify_token: string;
  verified_at: string;
  source_ip_hash: string;
  user_agent: string;
  created: string;
  updated: string;
  // Zahlungsfelder (bezahlte Events)
  payment_status?: "free" | "pending" | "pending_sepa" | "paid" | "expired" | "failed";
  payment_method?: "card" | "sepa" | "cash" | "";
  original_payment_method?: string;
  payment_ref?: string;
  checkout_url?: string;
  expires_at?: string;
  paid_at?: string;
  cancel_reason?: string;
  // Nachgeladen für Mitglieds-Registrierungen
  member_name?: string;
  member_email?: string;
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
  provider: "stripe" | "sepa" | "paypal_link" | "external" | "manual";
  provider_ref: string; // Stripe Session ID, etc.
  status: "created" | "pending" | "paid" | "failed" | "failed_expired" | "refunded" | "cancelled" | "external" | "disputed";
  // "card" | "sepa_debit" | "" (legacy/unknown). Wird beim Donation-Create gespeichert
  // bzw. aus Stripe-PaymentIntent ausgelesen.
  payment_method_detail?: string;
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
  donor_name: string;
  donor_email: string;
  campaign_id: string;
  amount_cents: number;
  currency: string;
  interval: "monthly" | "quarterly" | "yearly";
  provider: "stripe";
  provider_subscription_id: string;
  status:
    | "pending"
    | "active"
    | "cancelled"
    | "canceled"
    | "abandoned"
    | "past_due"
    | "incomplete"
    | "unpaid";
  started_at: string;
  cancelled_at: string;
  // v2: Lifecycle / Payment Health
  provider_ref: string;
  cancel_at_period_end: boolean;
  current_period_end: string;
  last_payment_status: "paid" | "failed" | "pending" | "";
  last_payment_at: string;
  disabled_by_setting: boolean;
  // Session 27: Mitgliedsbeitrags-Einzug (Discriminator + Stripe-Linkage)
  subscription_type: "donation" | "membership_fee";
  stripe_subscription_item_id: string;
  subscription_generation: number;
  created: string;
  updated: string;
}

// --- Mitgliedsbeitrags-Einzug (Session 27) ---
export type MembershipInterval = "monthly" | "quarterly" | "yearly";

export interface MembershipFeeConfig {
  id: string;
  mosque_id: string;
  user_id: string;
  amount_cents: number;
  interval: MembershipInterval;
  currency: string;
  active: boolean;
  exempt: boolean;
  exempt_until: string;
  version: number;
  effective_from: string;
  superseded_at: string; // "" = aktuell gültige Version
  notes: string;
  created_by: string;
  created: string;
  updated: string;
}

export interface MembershipFee {
  id: string;
  mosque_id: string;
  user_id: string;
  membership_fee_config_id: string;
  recurring_subscription_id: string;
  period_key: string;
  period_start: string;
  period_end: string; // EXKLUSIV
  period_bucket_id: string;
  amount_cents: number;
  currency: string;
  interval: MembershipInterval;
  status: "open" | "pending" | "paid" | "failed" | "waived" | "void";
  payment_method: "cash" | "transfer" | "stripe" | "waived" | "";
  paid_at: string;
  provider_ref: string;
  provider_invoice_status: string;
  source: "manual" | "stripe_webhook" | "migration" | "admin_bulk";
  waived_reason: string;
  waived_by: string;
  waived_at: string;
  billing_cycle_anchor: string;
  cycle_index: number;
  stripe_invoice_created: number;
  ledger_version: number;
  notes: string;
  created_by: string;
  created: string;
  updated: string;
}

export interface StripePriceCache {
  id: string;
  cache_key: string;
  stripe_price_id: string;
  connect_account_id: string;
  interval_count: number;
  livemode: boolean;
  active: boolean;
  created: string;
  updated: string;
}

export interface MembershipReconcileError {
  id: string;
  mosque_id: string;
  stripe_event_id: string;
  invoice_id: string;
  reason: string;
  payload_excerpt: string;
  retry_count: number;
  resolved_at: string;
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
  // Neue Felder (v3)
  last_year_attended: boolean;
  last_year_teacher: string;
  whatsapp_contact: "mother" | "father" | "both" | "";
  parent_is_member: boolean;
  privacy_accepted_at: string;
  // Neue Felder (v4) — Vater/Mutter als eigenständige Portal-Benutzer
  /** @deprecated — use parent_child_relations */
  father_user_id?: string;
  /** @deprecated — use parent_child_relations */
  mother_user_id?: string;
  // Neue Felder (v5) — Individueller Rabatt
  custom_discount_percent?: number; // 0–100, 0 = kein Rabatt
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

// --- 13a. ParentChildRelation (Eltern ↔ Kinder Junction Table) ---
export interface ParentChildRelation {
  id: string;
  mosque_id: string;
  parent_user: string; // Relation → users
  student: string;     // Relation → students
  relation_type: RelationType;
  created: string;
  updated: string;
  expand?: {
    parent_user?: User;
    student?: Student;
  };
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
  performance?: 1 | 2 | 3 | 4 | 5; // Leistungsbeurteilung: 1=sehr schlecht … 5=sehr gut
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
  reminder_sent_at: string;   // ISO-Datum der letzten Mahnung
  discount_applied_cents: number; // Ersparnis durch Rabatt (0 = kein Rabatt)
  sibling_rank: number;           // Position in der Geschwister-Gruppe (1=erstes, 2=zweites, 3+=drittes+)
  discount_type: "none" | "sibling" | "custom"; // Welcher Rabatt-Mechanismus gewonnen hat
  discount_percent_applied: number; // Tatsächlich angewendeter Rabatt-Prozentsatz (Snapshot)
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

// =========================================
// Finance V1 — Event-Layer + Ledger-Projection
// (Plan §1 + §13)
// =========================================

export type Zahlungskanal = "bar" | "ueberweisung" | "stripe" | "paypal" | "sonstige";
export type KontoTyp = "bank" | "cash" | "other";
export type FinanceClassification = "income" | "expense";

// Phase 1 erlaubte event_type-Werte (Zod-enforced); income_adjusted/fee_applied = Phase 2
export type Phase1EventType = "income_received" | "income_refunded" | "chargeback";

export type LedgerAcceptanceContext =
  | "pre_lock"            // vor jeglichem Hard-Lock
  | "post_lock_system"    // System-Event (Webhook/Backfill) trotz Lock
  | "post_lock_manual_blocked"; // Manual-Action war geblockt, System emittierte trotzdem

export type FinanceRelationType = "refund_of" | "chargeback_of" | "adjustment_of";

// payload_json v1 (Zod .strict() — keine zeitkritischen Felder, kein currency/amount-Echo)
export interface FinanceEventPayloadV1 {
  source_status: string;          // z.B. "paid", "refunded"
  category: string | null;        // Quell-Kategorie (donation.category etc.), NICHT EÜR-ID
  provider: string;               // "stripe" | "sepa" | "manual" | "paypal_link" | …
  payment_method: string | null;  // donation.payment_method_detail o.ä.
}

// finance_source_events Row
export interface FinanceSourceEvent {
  id: string;
  mosque_id: string;
  event_uuid: string;
  external_event_id: string;
  source_event_key: string;
  related_event_id: string;
  relation_type: FinanceRelationType | "";
  original_amount_cents: number | null;
  ledger_acceptance_context: LedgerAcceptanceContext;
  event_hash_sha256: string;      // Phase 1 leer
  event_type: Phase1EventType | "income_adjusted" | "fee_applied"; // DB-Enum komplett, Engine nur Phase1
  classification: FinanceClassification; // denormalisiert, einmal beim Write
  source_collection: "donations" | "student_fees" | "sponsors";
  source_type: "donation" | "fee" | "sponsor";
  source_id: string;
  betrag_cents: number;
  kategorie: string;              // FINANCE_CATEGORIES-ID
  konto_typ: KontoTyp;
  zahlungskanal: Zahlungskanal;
  currency: string;               // "EUR" Phase 1
  occurred_at: string;            // ISO date
  payload_schema_version: number; // 1 Phase 1
  payload_json: string;           // JSON-encoded FinanceEventPayloadV1
  metadata_json: string;          // unstrikt, nur Debug/Integration
  created: string;
}

// transactions Row (manuell, Sprint 3)
export interface Transaction {
  id: string;
  mosque_id: string;
  buchungsdatum: string;
  leistungsdatum: string;
  betrag_cents: number;
  typ: "einnahme" | "ausgabe";
  classification: FinanceClassification;
  kategorie: string;
  beschreibung: string;
  beleg_nummer: string;
  beleg_datei: string;
  beleg_datei_sha256: string;
  konto_typ: KontoTyp;
  zahlungskanal: Zahlungskanal | "";
  quelle: "manuell" | "storno";
  referenz_id: string;
  storno_of: string;
  is_storno: boolean;
  interne_notiz: string;
  created_by: string;
  created: string;
  updated: string;
}

// finance_sequences Row (Hint-Counter, Phase 1; UNIQUE ist Garantie)
export interface FinanceSequence {
  id: string;
  mosque_id: string;
  year: number;
  next_number: number;
  version: number;
}

// LedgerAtom — gemeinsame Anzeige/Reporting-Struktur (Plan §13)
// PURITY: KEINE optionalen Felder außer source_origin.
export interface LedgerAtom {
  id: string;
  mosque_id: string;
  datum: string;                  // occurred_at | buchungsdatum
  betrag_cents: number;           // immer positiv
  signed_amount_cents: number;    // classification===income? +betrag : -betrag
  kategorie: string;
  konto_typ: KontoTyp;
  zahlungskanal: Zahlungskanal;   // immer Enum (kein "")
  classification: FinanceClassification;
  source_system: "external_event" | "manual_transaction";
  source_origin?: {
    source_collection: string;
    source_id: string;
    event_uuid: string;
  };
  beleg_nummer: string;           // "" bei events
  readonly: boolean;              // event=true, manual=false
}

// --- Finance Reports (Sprint 4) ---

// Paginierte Ledger-Sicht (gemergte Atoms). truncated=true → UI-Hard-Limit erreicht.
export interface LedgerPage {
  atoms: LedgerAtom[];
  total: number;
  hasMore: boolean;
  truncated: boolean;
}

export interface FinanceKPIs {
  einnahmen_cents: number;
  ausgaben_cents: number;
  saldo_cents: number;
  kassenstand_bar_cents: number;
  kassenstand_bank_cents: number;
}

// Bestandsblock je Konto (Kassenbericht). anfang + einnahmen − ausgaben = ende.
export interface KontoBlock {
  anfang_cents: number;
  einnahmen_cents: number;
  ausgaben_cents: number;
  ende_cents: number;
}

export interface EURReport {
  einnahmen: { kategorie: string; cents: number }[];
  ausgaben: { kategorie: string; cents: number }[];
  einnahmen_total_cents: number;
  ausgaben_total_cents: number;
  ueberschuss_cents: number;
}

export interface JahresberichtReport {
  kpis: FinanceKPIs;
  monate: { month: string; einnahmen_cents: number; ausgaben_cents: number }[];
  eur: EURReport;
}

export interface KassenberichtReport {
  year: number;
  bar: KontoBlock;
  bank: KontoBlock;
  gesamt: KontoBlock;
}
