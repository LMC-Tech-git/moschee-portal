import { z } from "zod";

// =========================================
// Zod Validierungsschemas - Moschee-Portal V1
// =========================================

// --- Auth ---

export const loginSchema = z.object({
  email: z.string().email("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
  password: z.string().min(1, "Bitte geben Sie Ihr Passwort ein"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    first_name: z.string().min(2, "Mindestens 2 Zeichen"),
    last_name: z.string().min(2, "Mindestens 2 Zeichen"),
    email: z.string().email("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
    password: z.string().min(8, "Mindestens 8 Zeichen"),
    passwordConfirm: z.string().min(8, "Mindestens 8 Zeichen"),
    member_no: z.string().optional(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Die Passwörter stimmen nicht überein",
    path: ["passwordConfirm"],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

// --- Kontaktformular ---

export const contactFormSchema = z.object({
  name: z.string().min(2, "Name muss mindestens 2 Zeichen lang sein").max(100, "Name zu lang"),
  email: z
    .string()
    .email("Bitte eine gültige E-Mail-Adresse eingeben")
    .max(254, "E-Mail-Adresse zu lang"),
  organization: z.string().max(100, "Organisation zu lang").optional().default(""),
  inquiry_type: z.enum(["demo", "support", "partnership", "bug", "feedback", "other"], {
    message: "Bitte einen Anfragetyp wählen",
  }),
  message: z
    .string()
    .min(10, "Nachricht muss mindestens 10 Zeichen lang sein")
    .max(2000, "Nachricht darf maximal 2000 Zeichen lang sein"),
  privacy_accepted: z.literal(true, {
    message: "Datenschutzerklärung muss akzeptiert werden",
  }),
  // honeypot wird NICHT validiert — serverseitig stille Erkennung
});
export type ContactFormInput = z.infer<typeof contactFormSchema>;

// --- Posts ---

export const postSchema = z.object({
  title: z.string().min(3, "Titel muss mindestens 3 Zeichen lang sein").max(200),
  content: z.string().min(10, "Inhalt muss mindestens 10 Zeichen lang sein"),
  category: z.enum(["announcement", "youth", "campaign", "event", "general"]),
  visibility: z.enum(["public", "members"]),
  pinned: z.boolean().default(false),
  status: z.enum(["published", "draft"]).default("draft"),
});
export type PostInput = z.infer<typeof postSchema>;

// --- Events ---

export const eventSchema = z
  .object({
    title: z.string().min(3, "Titel muss mindestens 3 Zeichen lang sein").max(200),
    description: z.string().optional().default(""),
    category: z.enum(["youth", "lecture", "quran", "community", "ramadan", "other"]),
    location_name: z.string().optional().default(""),
    start_at: z.string().optional().default(""),
    start_prayer: z.string().optional().default(""),
    end_at: z.string().optional().default(""),
    duration_minutes: z.number().int().min(0).optional().default(0),
    visibility: z.enum(["public", "members"]),
    capacity: z.number().int().min(0).default(0),
    status: z.enum(["published", "cancelled", "draft"]).default("draft"),
    // Wiederkehrende Events
    is_recurring: z.boolean().optional().default(false),
    recurrence_type: z.string().optional().default(""),
    recurrence_day_of_week: z.string().optional().default(""),
    recurrence_day_of_month: z.number().int().min(0).max(31).optional().default(0),
    recurrence_month_mode: z.enum(["day", "weekday"]).optional().default("day"),
    recurrence_month_week: z.number().int().min(-1).max(4).optional().default(1),
    recurrence_month_weekday: z.string().optional().default(""),
    recurrence_end_date: z.string().optional().default(""),
    // Bezahlte Events
    is_paid: z.boolean().optional().default(false),
    price_cents: z.number().int().min(0).optional().default(0),
  })
  .superRefine((data, ctx) => {
    if (data.is_paid && (!data.price_cents || data.price_cents < 50)) {
      ctx.addIssue({
        code: "custom",
        path: ["price_cents"],
        message: "Preis muss mindestens 0,50 € betragen",
      });
    }
  });
export type EventInput = z.infer<typeof eventSchema>;

// --- Guest Event Registration ---

export const guestRegistrationSchema = z.object({
  guest_name: z.string().min(2, "Name muss mindestens 2 Zeichen lang sein"),
  guest_email: z.string().email("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
  accept_privacy: z.literal(true, {
    message: "Datenschutzerklärung muss akzeptiert werden",
  }),
});
export type GuestRegistrationInput = z.infer<typeof guestRegistrationSchema>;

// --- Campaigns ---

export const campaignSchema = z.object({
  title: z.string().min(3, "Titel muss mindestens 3 Zeichen lang sein").max(200),
  description: z.string().optional().default(""),
  category: z.enum(["ramadan", "construction", "aid", "maintenance", "general"]),
  goal_amount_cents: z.number().int().min(100, "Mindestens 1,00 €"),
  start_at: z.string().optional().default(""),
  end_at: z.string().optional().default(""),
  status: z.enum(["active", "paused", "completed"]).default("active"),
});
export type CampaignInput = z.infer<typeof campaignSchema>;

// --- Donation Checkout ---

export const donationCheckoutSchema = z.object({
  amount_cents: z.number().int().min(100, "Mindestens 1,00 €"),
  campaign_id: z.string().optional(),
  donor_name: z.string().optional().default(""),
  donor_email: z.string().email().optional(),
  is_recurring: z.boolean().default(false),
  cover_fees: z.boolean().default(false),
  /** Nur für Demo: Zahlungsmethode vorauswählen ("card" | "sepa_debit") */
  payment_method_type: z.enum(["card", "sepa_debit"]).default("card").optional(),
});
export type DonationCheckoutInput = z.infer<typeof donationCheckoutSchema>;

// --- Newsletter ---

export const newsletterSchema = z.object({
  subject: z.string().min(3, "Betreff muss mindestens 3 Zeichen lang sein"),
  body_html: z.string().min(10, "Inhalt muss mindestens 10 Zeichen lang sein"),
  to_segment: z.enum(["all", "active", "admins", "teachers"]).default("all"),
});
export type NewsletterInput = z.infer<typeof newsletterSchema>;

// --- Madrasa: Student ---

export const studentSchema = z.object({
  first_name: z.string().min(1, "Vorname ist erforderlich").max(100),
  last_name: z.string().min(1, "Nachname ist erforderlich").max(100),
  date_of_birth: z.string().min(1, "Geburtstag ist erforderlich"),
  gender: z.enum(["male", "female", ""]).default(""),
  parent_id: z.string().optional().default(""),
  parent_name: z.string().optional().default(""),
  parent_phone: z.string().optional().default(""),
  // Erweiterte Felder (v2)
  address: z.string().optional().default(""),
  school_name: z.string().optional().default(""),
  school_class: z.string().optional().default(""),
  health_notes: z.string().optional().default(""),
  mother_name: z.string().optional().default(""),
  mother_phone: z.string().optional().default(""),
  father_name: z.string().optional().default(""),
  father_phone: z.string().optional().default(""),
  membership_status: z.enum(["active", "none", "planned", ""]).default(""),
  // Neue Felder (v3)
  last_year_attended: z.boolean().default(false),
  last_year_teacher: z.string().optional().default(""),
  whatsapp_contact: z.enum(["mother", "father", "both", ""]).default(""),
  parent_is_member: z.boolean().default(false),
  notes: z.string().optional().default(""),
  status: z.enum(["active", "inactive"]).default("active"),
  custom_discount_percent: z.number().min(0).max(100).optional().default(0),
});
export type StudentInput = z.infer<typeof studentSchema>;

// --- Madrasa: Schüler (Eltern-Kontext — strengere Validierung) ---

export const memberStudentSchema = studentSchema
  .omit({ status: true })
  .extend({
    gender: z.enum(["male", "female"], { message: "Bitte Geschlecht angeben" }),
    school_name: z.string().min(1, "Besuchte Schule / KITA ist erforderlich"),
    school_class: z.string().min(1, "Klasse ist erforderlich"),
    last_year_attended: z.boolean(),
    last_year_teacher: z.string().optional().default(""),
    whatsapp_contact: z.enum(["mother", "father", "both"], {
      message: "Bitte WhatsApp-Kontakt angeben",
    }),
    parent_is_member: z.boolean(),
    privacy_accepted: z.literal(true, {
      message: "Datenschutzerklärung muss akzeptiert werden",
    }),
  })
  .superRefine((data, ctx) => {
    if (data.last_year_attended && !data.last_year_teacher) {
      ctx.addIssue({
        code: "custom",
        path: ["last_year_teacher"],
        message: "Lehrer ist erforderlich",
      });
    }
    if (
      (data.whatsapp_contact === "mother" || data.whatsapp_contact === "both") &&
      !data.mother_phone
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["mother_phone"],
        message: "Handynummer der Mutter ist erforderlich",
      });
    }
    if (
      (data.whatsapp_contact === "father" || data.whatsapp_contact === "both") &&
      !data.father_phone
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["father_phone"],
        message: "Handynummer des Vaters ist erforderlich",
      });
    }
  });
export type MemberStudentInput = z.infer<typeof memberStudentSchema>;

// --- Madrasa: Academic Year ---

export const academicYearSchema = z.object({
  name: z.string().min(3, "Name muss mindestens 3 Zeichen lang sein").max(20),
  start_date: z.string().min(1, "Startdatum ist erforderlich"),
  end_date: z.string().min(1, "Enddatum ist erforderlich"),
  status: z.enum(["active", "archived"]).default("active"),
});
export type AcademicYearInput = z.infer<typeof academicYearSchema>;

// --- Madrasa: Courses ---

export const courseSchema = z.object({
  academic_year_id: z.string().min(1, "Schuljahr ist erforderlich"),
  title: z.string().min(3, "Titel muss mindestens 3 Zeichen lang sein").max(200),
  description: z.string().optional().default(""),
  category: z.enum(["quran", "tajweed", "fiqh", "arabic", "sira", "islamic_studies", "other"]),
  level: z.enum(["beginner", "intermediate", "advanced", "mixed"]).default("mixed"),
  teacher_id: z.string().min(1, "Bitte wählen Sie einen Lehrer aus"),
  day_of_week: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
  start_time: z.string().min(1, "Startzeit ist erforderlich"),
  end_time: z.string().optional().default(""),
  location_name: z.string().optional().default(""),
  max_students: z.number().int().min(0).default(0),
  status: z.enum(["active", "paused", "archived"]).default("active"),
});
export type CourseInput = z.infer<typeof courseSchema>;

// --- Madrasa: Enrollment ---

export const enrollmentSchema = z.object({
  course_id: z.string().min(1, "Kurs ist erforderlich"),
  student_id: z.string().min(1, "Schüler ist erforderlich"),
  status: z.enum(["enrolled", "completed", "dropped", "on_hold"]).default("enrolled"),
  notes: z.string().optional().default(""),
});
export type EnrollmentInput = z.infer<typeof enrollmentSchema>;

// --- Invites ---

export const createInviteSchema = z.object({
  type: z.enum(["personal", "group"]),
  label: z.string().max(100).optional().default(""),
  email: z.string().email("Ungültige E-Mail-Adresse").optional().or(z.literal("")).default(""),
  role: z.enum(["member", "teacher", "imam", "admin", "editor", "super_admin", "madrasa_admin", "treasurer", "secretary"]).default("member"),
  initial_status: z.enum(["pending", "active"]).default("pending"),
  max_uses: z.number().int().min(1, "Mindestens 1 Nutzung").optional(),
  expires_at: z.string().optional().default(""),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const inviteRegisterSchema = z
  .object({
    first_name: z.string().min(2, "Mindestens 2 Zeichen"),
    last_name: z.string().min(2, "Mindestens 2 Zeichen"),
    email: z.string().email("Bitte eine gültige E-Mail-Adresse eingeben"),
    password: z.string().min(8, "Mindestens 8 Zeichen"),
    passwordConfirm: z.string().min(8, "Mindestens 8 Zeichen"),
    accept_privacy: z.literal(true, {
      message: "Datenschutzerklärung muss akzeptiert werden",
    }),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Die Passwörter stimmen nicht überein",
    path: ["passwordConfirm"],
  });
export type InviteRegisterInput = z.infer<typeof inviteRegisterSchema>;

// --- Madrasa: Student Fees ---

export const studentFeeMarkSchema = z.object({
  payment_method: z.enum(["cash", "transfer", "waived"]),
  notes: z.string().optional().default(""),
  paid_at: z.string().optional().default(""),
});
export type StudentFeeMarkInput = z.infer<typeof studentFeeMarkSchema>;

// --- Madrasa: Attendance ---

export const attendanceSchema = z.object({
  course_id: z.string().min(1, "Kurs ist erforderlich"),
  student_id: z.string().min(1, "Schüler ist erforderlich"),
  session_date: z.string().min(1, "Datum ist erforderlich"),
  status: z.enum(["present", "absent", "late", "excused"]),
  notes: z.string().optional().default(""),
});
export type AttendanceInput = z.infer<typeof attendanceSchema>;

// --- Invites ---

/** Valides E-Mail-Format oder leer (optionales Feld). */
export const inviteEmailSchema = z.string().email().or(z.literal(""));

