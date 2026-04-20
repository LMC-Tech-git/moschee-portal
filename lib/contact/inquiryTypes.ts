// =========================================
// Kontaktformular — zentrale Anfragetyp-Definitionen
// Importiert von: validations.ts, BaseContactForm, API-Routes
// =========================================

export const MOSQUE_INQUIRY_TYPES = [
  "general",
  "membership",
  "event",
  "donation",
  "madrasa",
  "funeral",
  "other",
] as const;

export const PLATFORM_INQUIRY_TYPES = [
  "demo",
  "support",
  "partnership",
  "bug",
  "feedback",
  "other",
] as const;

export type MosqueInquiryType = (typeof MOSQUE_INQUIRY_TYPES)[number];
export type PlatformInquiryType = (typeof PLATFORM_INQUIRY_TYPES)[number];
export type InquiryType = MosqueInquiryType | PlatformInquiryType;

export interface ContactFormConfig<T extends InquiryType> {
  /** Vorbereitete Optionen — Label bereits durch Wrapper übersetzt */
  inquiryTypes: { value: T; label: string }[];
  /** Org-Feld anzeigen (Plattform: true, Gemeinde: false) */
  showOrganization: boolean;
  /** API-Endpunkt — muss mit "/api/" beginnen */
  apiPath: string;
  /** Vorausgewählter Typ — Typ-sicher: nur T, keine beliebige string */
  defaultInquiryType?: T;
}
