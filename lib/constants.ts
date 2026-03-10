import type { Post, Event, Campaign, Course, CourseEnrollment, Attendance, AcademicYear, Student } from "@/types";

// =========================================
// Post-Kategorien
// =========================================

export const postCategoryLabels: Record<Post["category"], string> = {
  announcement: "Ankündigung",
  youth: "Jugend",
  campaign: "Kampagne",
  event: "Veranstaltung",
  general: "Allgemein",
};

export const postCategoryColors: Record<Post["category"], string> = {
  announcement: "bg-red-100 text-red-700",
  youth: "bg-purple-100 text-purple-700",
  campaign: "bg-amber-100 text-amber-700",
  event: "bg-blue-100 text-blue-700",
  general: "bg-gray-100 text-gray-700",
};

export const postCategoryOptions = [
  { value: "announcement", label: "Ankündigung" },
  { value: "youth", label: "Jugend" },
  { value: "campaign", label: "Kampagne" },
  { value: "event", label: "Veranstaltung" },
  { value: "general", label: "Allgemein" },
] as const;

// =========================================
// Event-Kategorien
// =========================================

export const eventCategoryLabels: Record<Event["category"], string> = {
  youth: "Jugend",
  lecture: "Vortrag",
  quran: "Quran",
  community: "Gemeinde",
  ramadan: "Ramadan",
  other: "Sonstiges",
};

export const eventCategoryColors: Record<Event["category"], string> = {
  youth: "bg-purple-100 text-purple-700",
  lecture: "bg-blue-100 text-blue-700",
  quran: "bg-emerald-100 text-emerald-700",
  community: "bg-amber-100 text-amber-700",
  ramadan: "bg-green-100 text-green-700",
  other: "bg-gray-100 text-gray-700",
};

export const eventCategoryOptions = [
  { value: "youth", label: "Jugend" },
  { value: "lecture", label: "Vortrag" },
  { value: "quran", label: "Quran" },
  { value: "community", label: "Gemeinde" },
  { value: "ramadan", label: "Ramadan" },
  { value: "other", label: "Sonstiges" },
] as const;

// =========================================
// Kampagnen-Kategorien
// =========================================

export const campaignCategoryLabels: Record<Campaign["category"], string> = {
  ramadan: "Ramadan",
  construction: "Bau",
  aid: "Hilfe",
  maintenance: "Instandhaltung",
  general: "Allgemein",
};

export const campaignCategoryOptions = [
  { value: "ramadan", label: "Ramadan" },
  { value: "construction", label: "Bau" },
  { value: "aid", label: "Hilfe" },
  { value: "maintenance", label: "Instandhaltung" },
  { value: "general", label: "Allgemein" },
] as const;

// =========================================
// Sichtbarkeit
// =========================================

export const visibilityOptions = [
  { value: "public", label: "Öffentlich" },
  { value: "members", label: "Nur Mitglieder" },
] as const;

// =========================================
// Status-Labels + Farben
// =========================================

export const postStatusLabels: Record<Post["status"], string> = {
  published: "Veröffentlicht",
  draft: "Entwurf",
};

export const postStatusColors: Record<Post["status"], string> = {
  published: "bg-green-100 text-green-700",
  draft: "bg-gray-100 text-gray-600",
};

export const eventStatusLabels: Record<Event["status"], string> = {
  published: "Veröffentlicht",
  cancelled: "Abgesagt",
  draft: "Entwurf",
};

export const eventStatusColors: Record<Event["status"], string> = {
  published: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  draft: "bg-gray-100 text-gray-600",
};

export const campaignStatusLabels: Record<Campaign["status"], string> = {
  active: "Aktiv",
  paused: "Pausiert",
  completed: "Abgeschlossen",
};

export const campaignStatusColors: Record<Campaign["status"], string> = {
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-blue-100 text-blue-700",
};

export const campaignCategoryColors: Record<Campaign["category"], string> = {
  ramadan: "bg-green-100 text-green-700",
  construction: "bg-orange-100 text-orange-700",
  aid: "bg-rose-100 text-rose-700",
  maintenance: "bg-slate-100 text-slate-700",
  general: "bg-gray-100 text-gray-700",
};

// =========================================
// Sichtbarkeit - Labels + Farben
// =========================================

export const visibilityLabels: Record<string, string> = {
  public: "Öffentlich",
  members: "Nur Mitglieder",
};

export const visibilityColors: Record<string, string> = {
  public: "bg-sky-100 text-sky-700",
  members: "bg-violet-100 text-violet-700",
};

// =========================================
// Madrasa - Schuljahr-Status
// =========================================

export const academicYearStatusLabels: Record<AcademicYear["status"], string> = {
  active: "Aktiv",
  archived: "Archiviert",
};

export const academicYearStatusColors: Record<AcademicYear["status"], string> = {
  active: "bg-emerald-100 text-emerald-700",
  archived: "bg-gray-100 text-gray-600",
};

// =========================================
// Madrasa - Kurs-Kategorien
// =========================================

export const courseCategoryLabels: Record<Course["category"], string> = {
  quran: "Quran",
  tajweed: "Tajweed",
  fiqh: "Fiqh",
  arabic: "Arabisch",
  sira: "Sira",
  islamic_studies: "Islamkunde",
  other: "Sonstiges",
};

export const courseCategoryColors: Record<Course["category"], string> = {
  quran: "bg-emerald-100 text-emerald-700",
  tajweed: "bg-teal-100 text-teal-700",
  fiqh: "bg-indigo-100 text-indigo-700",
  arabic: "bg-amber-100 text-amber-700",
  sira: "bg-rose-100 text-rose-700",
  islamic_studies: "bg-purple-100 text-purple-700",
  other: "bg-gray-100 text-gray-700",
};

export const courseCategoryOptions = [
  { value: "quran", label: "Quran" },
  { value: "tajweed", label: "Tajweed" },
  { value: "fiqh", label: "Fiqh" },
  { value: "arabic", label: "Arabisch" },
  { value: "sira", label: "Sira" },
  { value: "islamic_studies", label: "Islamkunde" },
  { value: "other", label: "Sonstiges" },
] as const;

// =========================================
// Madrasa - Kurs-Level
// =========================================

export const courseLevelLabels: Record<Course["level"], string> = {
  beginner: "Anfänger",
  intermediate: "Fortgeschritten",
  advanced: "Experte",
  mixed: "Gemischt",
};

export const courseLevelColors: Record<Course["level"], string> = {
  beginner: "bg-green-100 text-green-700",
  intermediate: "bg-yellow-100 text-yellow-700",
  advanced: "bg-red-100 text-red-700",
  mixed: "bg-blue-100 text-blue-700",
};

export const courseLevelOptions = [
  { value: "beginner", label: "Anfänger" },
  { value: "intermediate", label: "Fortgeschritten" },
  { value: "advanced", label: "Experte" },
  { value: "mixed", label: "Gemischt" },
] as const;

// =========================================
// Madrasa - Kurs-Status
// =========================================

export const courseStatusLabels: Record<Course["status"], string> = {
  active: "Aktiv",
  paused: "Pausiert",
  archived: "Archiviert",
};

export const courseStatusColors: Record<Course["status"], string> = {
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  archived: "bg-gray-100 text-gray-600",
};

// =========================================
// Madrasa - Wochentage
// =========================================

export const dayOfWeekLabels: Record<Course["day_of_week"], string> = {
  monday: "Montag",
  tuesday: "Dienstag",
  wednesday: "Mittwoch",
  thursday: "Donnerstag",
  friday: "Freitag",
  saturday: "Samstag",
  sunday: "Sonntag",
};

export const dayOfWeekOptions = [
  { value: "monday", label: "Montag" },
  { value: "tuesday", label: "Dienstag" },
  { value: "wednesday", label: "Mittwoch" },
  { value: "thursday", label: "Donnerstag" },
  { value: "friday", label: "Freitag" },
  { value: "saturday", label: "Samstag" },
  { value: "sunday", label: "Sonntag" },
] as const;

// =========================================
// Madrasa - Einschreibungs-Status
// =========================================

export const enrollmentStatusLabels: Record<CourseEnrollment["status"], string> = {
  enrolled: "Eingeschrieben",
  completed: "Abgeschlossen",
  dropped: "Abgemeldet",
  on_hold: "Pausiert",
};

export const enrollmentStatusColors: Record<CourseEnrollment["status"], string> = {
  enrolled: "bg-emerald-100 text-emerald-700",
  completed: "bg-blue-100 text-blue-700",
  dropped: "bg-red-100 text-red-700",
  on_hold: "bg-amber-100 text-amber-700",
};

// =========================================
// Madrasa - Anwesenheits-Status
// =========================================

export const attendanceStatusLabels: Record<Attendance["status"], string> = {
  present: "Anwesend",
  absent: "Abwesend",
  late: "Verspätet",
  excused: "Entschuldigt",
};

export const attendanceStatusColors: Record<Attendance["status"], string> = {
  present: "bg-emerald-100 text-emerald-700",
  absent: "bg-red-100 text-red-700",
  late: "bg-amber-100 text-amber-700",
  excused: "bg-blue-100 text-blue-700",
};

// =========================================
// Madrasa - Schüler-Status
// =========================================

export const studentStatusLabels: Record<Student["status"], string> = {
  active: "Aktiv",
  inactive: "Inaktiv",
};

export const studentStatusColors: Record<Student["status"], string> = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-gray-100 text-gray-600",
};

// =========================================
// Madrasa - Geschlecht
// =========================================

export const genderLabels: Record<string, string> = {
  male: "Männlich",
  female: "Weiblich",
  "": "—",
};

// =========================================
// Theme-Presets
// =========================================

export const THEME_PRESETS = [
  { id: "emerald", name: "Smaragd (Standard)", primary: "#059669", accent: "#d97706" },
  { id: "teal",    name: "Blaugrün",            primary: "#0d9488", accent: "#6366f1" },
  { id: "blue",    name: "Islamisch Blau",       primary: "#1d4ed8", accent: "#f59e0b" },
  { id: "indigo",  name: "Indigo",               primary: "#4338ca", accent: "#10b981" },
  { id: "navy",    name: "Marine",               primary: "#1e3a5f", accent: "#f59e0b" },
  { id: "purple",  name: "Violett",              primary: "#7c3aed", accent: "#10b981" },
  { id: "gold",    name: "Gold",                 primary: "#b45309", accent: "#059669" },
  { id: "rose",    name: "Rose",                 primary: "#be185d", accent: "#0d9488" },
  { id: "custom",  name: "Benutzerdefiniert",    primary: "",        accent: "" },
] as const;

export type ThemePresetId = (typeof THEME_PRESETS)[number]["id"];

/** Gibt die primäre Brand-Farbe für eine Moschee zurück. */
export function getBrandColor(
  brandTheme: string,
  brandPrimaryColor: string
): string {
  if (brandTheme === "custom") return brandPrimaryColor || "#059669";
  const preset = THEME_PRESETS.find((p) => p.id === brandTheme);
  return preset?.primary || brandPrimaryColor || "#059669";
}

// =========================================
// Gebetszeit-Provider
// =========================================

export const PRAYER_PROVIDERS = [
  { value: "aladhan", label: "AlAdhan API (Diyanet/Türkei)" },
  { value: "off",     label: "Deaktiviert (kein Widget)" },
] as const;

// =========================================
// Gebetszeit-Berechnungsmethoden (Aladhan)
// =========================================

export const PRAYER_METHODS = [
  { method: 2,  name: "ISNA (Nordamerika)" },
  { method: 3,  name: "Muslim World League (Empfohlen Europa)" },
  { method: 4,  name: "Umm Al-Qura, Makkah" },
  { method: 5,  name: "Ägyptische Generalbehörde" },
  { method: 9,  name: "Kuwait" },
  { method: 13, name: "Diyanet İşleri Başkanlığı (Türkei)" },
  { method: 15, name: "Moonsighting Committee Worldwide" },
] as const;

// =========================================
// Rollen-Labels
// =========================================

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Plattform-Admin',
  admin: 'Administrator',
  editor: 'Editor',
  imam: 'Imam',
  teacher: 'Lehrer',
  member: 'Mitglied',
};

export const ROLE_OPTIONS = [
  { value: 'member',  label: 'Mitglied' },
  { value: 'admin',   label: 'Administrator' },
  { value: 'editor',  label: 'Editor (Beiträge, Events, Kampagnen)' },
  { value: 'teacher', label: 'Lehrer (Madrasa)' },
  { value: 'imam',    label: 'Imam (Beiträge posten)' },
] as const;
