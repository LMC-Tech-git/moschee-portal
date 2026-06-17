"use server";

import { revalidateTag } from "next/cache";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { logAudit } from "@/lib/audit";
import {
  financeSettingsSchema,
  tvSettingsSchema,
  type FinanceSettingsInput,
  type TVSettingsInput,
} from "@/lib/validations";
import { assertFinanceAccess } from "@/lib/finance-permissions";
import { validateTVColors } from "@/lib/color-contrast";
import { getBrandColor } from "@/lib/constants";
import { isValidIban, normalizeIban } from "@/lib/epc-qr";
import type { Mosque, Settings, TVColors, TVModules, TVModuleCounts, TVModuleKey } from "@/types";
import { TV_MODULE_KEYS } from "@/types";

// =========================================
// Feature Flags (für MosqueContext auf Auth-Routen)
// =========================================

/**
 * Lädt nur die Feature-Flags einer Moschee (team_enabled, sponsors_enabled).
 * Wird im MosqueContext aufgerufen wenn keine Slug-Route vorliegt (z.B. /member/profile, /admin/*).
 */
export async function getFeatureFlags(mosqueId: string): Promise<{
  team_enabled: boolean;
  sponsors_enabled: boolean;
  contact_enabled: boolean;
  finance_enabled: boolean;
}> {
  try {
    const pb = await getAdminPB();
    const record = await pb
      .collection("settings")
      .getFirstListItem(`mosque_id = "${mosqueId}"`, {
        fields: "team_enabled,sponsors_enabled,contact_enabled,finance_enabled",
      });
    return {
      team_enabled: record.team_enabled ?? false,
      sponsors_enabled: record.sponsors_enabled ?? false,
      contact_enabled: record.contact_enabled ?? false,
      finance_enabled: record.finance_enabled ?? false,
    };
  } catch {
    return { team_enabled: false, sponsors_enabled: false, contact_enabled: false, finance_enabled: false };
  }
}

// =========================================
// Branding
// =========================================

export async function getBrandingSettings(mosqueId: string): Promise<{
  success: boolean;
  data?: Pick<
    Mosque,
    | "name"
    | "address"
    | "zip_code"
    | "city"
    | "phone"
    | "email"
    | "website"
    | "brand_logo"
    | "brand_primary_color"
    | "brand_accent_color"
    | "brand_theme"
    | "brand_hero_type"
    | "brand_hero_image"
  >;
  error?: string;
}> {
  try {
    const pb = await getAdminPB();
    const record = await pb.collection("mosques").getOne(mosqueId);
    return { success: true, data: record as unknown as Mosque };
  } catch (error) {
    console.error("[settings] getBrandingSettings:", error);
    return { success: false, error: "Einstellungen konnten nicht geladen werden." };
  }
}

export async function updateBrandingSettings(
  mosqueId: string,
  userId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const pb = await getAdminPB();

    const pbFormData = new FormData();
    pbFormData.append("name", (formData.get("name") as string)?.trim() || "");
    pbFormData.append("address", (formData.get("address") as string)?.trim() || "");
    pbFormData.append("zip_code", (formData.get("zip_code") as string)?.trim() || "");
    pbFormData.append("city", (formData.get("city") as string)?.trim() || "");
    pbFormData.append("phone", (formData.get("phone") as string)?.trim() || "");
    pbFormData.append("email", (formData.get("email") as string)?.trim() || "");
    pbFormData.append("website", (formData.get("website") as string)?.trim() || "");
    pbFormData.append("brand_theme", (formData.get("brand_theme") as string) || "emerald");
    pbFormData.append("brand_primary_color", (formData.get("brand_primary_color") as string)?.trim() || "");
    pbFormData.append("brand_accent_color", (formData.get("brand_accent_color") as string)?.trim() || "");
    pbFormData.append("brand_hero_type", (formData.get("brand_hero_type") as string) || "color");

    // Hero-Bild-Upload (optional)
    const heroImageFile = formData.get("brand_hero_image");
    if (heroImageFile && typeof heroImageFile !== "string" && "size" in (heroImageFile as object) && (heroImageFile as File).size > 0) {
      pbFormData.append("brand_hero_image", heroImageFile as Blob, (heroImageFile as File).name || "hero");
    }

    // Hero-Bild löschen
    const removeHeroImage = formData.get("remove_hero_image");
    if (removeHeroImage === "1") {
      const currentRecord = await pb.collection("mosques").getOne(mosqueId, { fields: "brand_hero_image" });
      const currentHero = currentRecord.brand_hero_image as string;
      if (currentHero) {
        pbFormData.append("brand_hero_image-", currentHero);
      }
    }

    // Logo-Upload (optional)
    const logoFile = formData.get("brand_logo");
    if (logoFile && typeof logoFile !== "string" && "size" in (logoFile as object) && (logoFile as File).size > 0) {
      pbFormData.append("brand_logo", logoFile as Blob, (logoFile as File).name || "logo");
    }

    // Logo löschen: PocketBase erwartet den echten Dateinamen im "field-" Feld
    const removeLogo = formData.get("remove_logo");
    if (removeLogo === "1") {
      const currentRecord = await pb.collection("mosques").getOne(mosqueId, { fields: "brand_logo" });
      const currentLogo = currentRecord.brand_logo as string;
      if (currentLogo) {
        pbFormData.append("brand_logo-", currentLogo);
      }
    }

    await pb.collection("mosques").update(mosqueId, pbFormData);

    await logAudit({
      mosqueId,
      userId,
      action: "update_branding",
      entityType: "mosques",
      entityId: mosqueId,
    });

    return { success: true };
  } catch (error) {
    console.error("[settings] updateBrandingSettings:", error);
    return { success: false, error: "Branding-Einstellungen konnten nicht gespeichert werden." };
  }
}

// =========================================
// Gebetszeiten
// =========================================

export async function updatePrayerSettings(
  mosqueId: string,
  userId: string,
  data: {
    prayer_method: number;
    prayer_provider: string;
    mawaqit_mosque_id: string;
    prayer_source_id: string;
    sabah_offset_minutes: number;
    tune: string;
    latitude: number | null;
    longitude: number | null;
    ramadan_mode: boolean;
    ramadan_start: string;
    ramadan_end: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const pb = await getAdminPB();

    // Settings-Record für Moschee holen oder erstellen
    let settingsId: string | null = null;
    try {
      const record = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${mosqueId}"`);
      settingsId = record.id;
    } catch {
      // Noch kein Settings-Record
    }

    const settingsPayload = {
      mosque_id: mosqueId,
      prayer_method: data.prayer_method,
      prayer_provider: data.prayer_provider,
      mawaqit_mosque_id: data.mawaqit_mosque_id,
      prayer_source_id: data.prayer_source_id,
      sabah_offset_minutes: data.sabah_offset_minutes,
      tune: data.tune,
      ramadan_mode: data.ramadan_mode,
      ramadan_start: data.ramadan_start,
      ramadan_end: data.ramadan_end,
    };

    if (settingsId) {
      await pb.collection("settings").update(settingsId, settingsPayload);
    } else {
      await pb.collection("settings").create(settingsPayload);
    }

    // Koordinaten in Moschee-Record speichern
    if (data.latitude !== null && data.longitude !== null) {
      await pb.collection("mosques").update(mosqueId, {
        latitude: data.latitude,
        longitude: data.longitude,
      });
    }

    await logAudit({
      mosqueId,
      userId,
      action: "update_prayer_settings",
      entityType: "settings",
      entityId: settingsId || mosqueId,
    });

    return { success: true };
  } catch (error) {
    console.error("[settings] updatePrayerSettings:", error);
    return { success: false, error: "Gebetszeiten-Einstellungen konnten nicht gespeichert werden." };
  }
}

// =========================================
// Defaults
// =========================================

export async function updateDefaultSettings(
  mosqueId: string,
  userId: string,
  data: {
    locale: string;
    default_post_visibility: string;
    default_event_visibility: string;
    donation_quick_amounts: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const pb = await getAdminPB();

    let settingsId: string | null = null;
    try {
      const record = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${mosqueId}"`);
      settingsId = record.id;
    } catch {
      // Noch kein Settings-Record
    }

    const payload = { mosque_id: mosqueId, ...data };

    if (settingsId) {
      await pb.collection("settings").update(settingsId, payload);
    } else {
      await pb.collection("settings").create(payload);
    }

    await logAudit({
      mosqueId,
      userId,
      action: "update_default_settings",
      entityType: "settings",
      entityId: settingsId || mosqueId,
    });

    return { success: true };
  } catch (error) {
    console.error("[settings] updateDefaultSettings:", error);
    return { success: false, error: "Standard-Einstellungen konnten nicht gespeichert werden." };
  }
}

// =========================================
// Alle Settings laden (für die Settings-Seite)
// =========================================

export async function getPortalSettings(mosqueId: string): Promise<{
  success: boolean;
  mosque?: Mosque;
  settings?: Settings;
  error?: string;
}> {
  try {
    const pb = await getAdminPB();

    const mosqueRecord = await pb.collection("mosques").getOne(mosqueId);
    const mosque = mosqueRecord as unknown as Mosque;

    let settings: Settings;
    try {
      const record = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${mosqueId}"`);
      settings = record as unknown as Settings;
    } catch {
      // Defaults
      settings = {
        id: "",
        mosque_id: mosqueId,
        public_dashboard_enabled: true,
        members_dashboard_enabled: true,
        public_finance_enabled: true,
        newsletter_enabled: true,
        allow_guest_event_registration: true,
        allow_guest_donations: true,
        guest_registration_rate_limit_per_ip_per_hour: 10,
        guest_registration_email_verify: false,
        prayer_provider: "aladhan",
        prayer_method: 13,
        mawaqit_mosque_id: "",
        prayer_source_id: "",
        sabah_offset_minutes: -30,
        tune: "",
        ramadan_mode: false,
        ramadan_start: "",
        ramadan_end: "",
        locale: "de",
        default_post_visibility: "public",
        default_event_visibility: "public",
        donation_quick_amounts: "10,25,50,100",
        madrasa_fees_enabled: false,
        madrasa_default_fee_cents: 1000,
        fee_reminder_enabled: false,
        fee_reminder_day: 15,
        sibling_discount_enabled: false,
        sibling_discount_2nd_percent: 0,
        sibling_discount_3rd_percent: 0,
        sponsors_enabled: false,
        sponsors_visibility: "public",
        team_enabled: false,
        team_visibility: "public",
        contact_enabled: false,
        contact_email: "",
        contact_notify_admin: true,
        contact_auto_reply: true,
        recurring_donations_enabled: false,
        recurring_min_cents: 300,
        recurring_quick_amounts: "500,1000,2000,5000",
        membership_fees_enabled: false,
        membership_default_fee_cents: 1200,
        membership_default_interval: "monthly",
        membership_reconcile_cursor: "",
        finance_hard_lock_until: "",
        finance_enabled: false,
        kassenbuch_start_year: new Date().getFullYear(),
        kassenbuch_bar_start_cents: 0,
        kassenbuch_bank_start_cents: 0,
        sepa_enabled: true,
        bank_transfer_enabled: false,
        bank_iban: "",
        bank_bic: "",
        bank_holder: "",
        verein_anschrift: "",
        verein_steuernummer: "",
        freistellungsbescheid_text: "",
        verein_foerderzweck: "",
        // TV defaults
        tv_enabled: false,
        tv_modules: JSON.stringify({ prayer: true, events: true, posts: true, campaigns: false, qr_donate: false, qr_transfer: false, announcement: false }),
        tv_slide_order: JSON.stringify(["prayer", "events", "posts", "announcement", "campaigns", "qr_donate", "qr_transfer"]),
        tv_module_counts: JSON.stringify({ events: 3, posts: 1, campaigns: 1 }),
        tv_rotation_seconds: 15,
        tv_locale_mode: "single",
        tv_locale_primary: "de",
        tv_locale_secondary: "none",
        tv_locale_rotate_seconds: 8,
        tv_bg_color: "",
        tv_text_color: "",
        tv_accent_color: "",
        tv_announcement_text: "",
        tv_announcement_text_secondary: "",
        tv_show_hijri: true,
        tv_show_arabic_prayer_names: true,
        tv_highlight_active_prayer: true,
        tv_highlight_duration_seconds: 300,
        created: "",
        updated: "",
      };
    }

    return { success: true, mosque, settings };
  } catch (error) {
    console.error("[settings] getPortalSettings:", error);
    return { success: false, error: "Einstellungen konnten nicht geladen werden." };
  }
}

// =========================================
// Madrasa-Gebühren
// =========================================

export async function getMadrasaFeeSettings(mosqueId: string): Promise<{
  success: boolean;
  data?: {
    madrasa_fees_enabled: boolean;
    madrasa_default_fee_cents: number;
    fee_reminder_enabled: boolean;
    fee_reminder_day: number;
    sibling_discount_enabled: boolean;
    sibling_discount_2nd_percent: number;
    sibling_discount_3rd_percent: number;
  };
  error?: string;
}> {
  try {
    const pb = await getAdminPB();
    try {
      const record = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${mosqueId}"`);

      // 3-Wege-Logik: null ≠ false (PB setzt null für neue Felder in bestehenden Records)
      const discount2nd = record.sibling_discount_2nd_percent || 0;
      const discount3rd = record.sibling_discount_3rd_percent || 0;
      const hasDiscountConfig = discount2nd > 0 || discount3rd > 0;
      if (record.sibling_discount_enabled == null && hasDiscountConfig) {
        console.warn("[settings] sibling_discount_enabled fallback für Settings-Record:", record.id);
      }
      const siblingDiscountEnabled: boolean =
        record.sibling_discount_enabled === true ? true
        : record.sibling_discount_enabled === false ? false
        : hasDiscountConfig;

      return {
        success: true,
        data: {
          madrasa_fees_enabled: record.madrasa_fees_enabled || false,
          madrasa_default_fee_cents: record.madrasa_default_fee_cents || 1000,
          fee_reminder_enabled: record.fee_reminder_enabled || false,
          fee_reminder_day: record.fee_reminder_day || 15,
          sibling_discount_enabled: siblingDiscountEnabled,
          sibling_discount_2nd_percent: discount2nd,
          sibling_discount_3rd_percent: discount3rd,
        },
      };
    } catch {
      return {
        success: true,
        data: {
          madrasa_fees_enabled: false,
          madrasa_default_fee_cents: 1000,
          fee_reminder_enabled: false,
          fee_reminder_day: 15,
          sibling_discount_enabled: false,
          sibling_discount_2nd_percent: 0,
          sibling_discount_3rd_percent: 0,
        },
      };
    }
  } catch (error) {
    console.error("[settings] getMadrasaFeeSettings:", error);
    return { success: false, error: "Einstellungen konnten nicht geladen werden." };
  }
}

export async function updateMadrasaFeeSettings(
  mosqueId: string,
  userId: string,
  data: {
    madrasa_fees_enabled: boolean;
    madrasa_default_fee_cents: number;
    fee_reminder_enabled: boolean;
    fee_reminder_day: number;
    sibling_discount_enabled: boolean;
    sibling_discount_2nd_percent: number;
    sibling_discount_3rd_percent: number;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const pb = await getAdminPB();

    let settingsId: string | null = null;
    try {
      const record = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${mosqueId}"`);
      settingsId = record.id;
    } catch {
      // Noch kein Settings-Record
    }

    const payload = { mosque_id: mosqueId, ...data };

    if (settingsId) {
      await pb.collection("settings").update(settingsId, payload);
    } else {
      await pb.collection("settings").create(payload);
    }

    await logAudit({
      mosqueId,
      userId,
      action: "update_madrasa_fee_settings",
      entityType: "settings",
      entityId: settingsId || mosqueId,
    });

    return { success: true };
  } catch (error) {
    console.error("[settings] updateMadrasaFeeSettings:", error);
    return { success: false, error: "Madrasa-Gebühren-Einstellungen konnten nicht gespeichert werden." };
  }
}

// =========================================
// Finanzmodul (Sprint 4)
// =========================================

export async function getFinanceSettings(mosqueId: string): Promise<{
  success: boolean;
  data?: FinanceSettingsInput;
  error?: string;
}> {
  try {
    const pb = await getAdminPB();
    try {
      const record = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${mosqueId}"`, {
          fields:
            "finance_enabled,kassenbuch_start_year,kassenbuch_bar_start_cents,kassenbuch_bank_start_cents,finance_hard_lock_until",
        });
      return {
        success: true,
        data: {
          finance_enabled: record.finance_enabled ?? false,
          kassenbuch_start_year: record.kassenbuch_start_year || new Date().getFullYear(),
          kassenbuch_bar_start_cents: record.kassenbuch_bar_start_cents || 0,
          kassenbuch_bank_start_cents: record.kassenbuch_bank_start_cents || 0,
          finance_hard_lock_until: record.finance_hard_lock_until || "",
        },
      };
    } catch {
      return {
        success: true,
        data: {
          finance_enabled: false,
          kassenbuch_start_year: new Date().getFullYear(),
          kassenbuch_bar_start_cents: 0,
          kassenbuch_bank_start_cents: 0,
          finance_hard_lock_until: "",
        },
      };
    }
  } catch (error) {
    console.error("[settings] getFinanceSettings:", error);
    return { success: false, error: "Einstellungen konnten nicht geladen werden." };
  }
}

export async function updateFinanceSettings(
  mosqueId: string,
  data: FinanceSettingsInput
): Promise<{ success: boolean; error?: string }> {
  try {
    // Q4-Guard: Rolle + mosque-match serverseitig
    const { userId } = await assertFinanceAccess(mosqueId);

    const parsed = financeSettingsSchema.safeParse(data);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}:${i.message}`).join("; ");
      return { success: false, error: `Ungültige Eingabe: ${issues}` };
    }

    const pb = await getAdminPB();
    let settingsId: string | null = null;
    try {
      const record = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${mosqueId}"`);
      settingsId = record.id;
    } catch {
      // Kein Settings-Record
    }

    const payload = { mosque_id: mosqueId, ...parsed.data };

    if (settingsId) {
      await pb.collection("settings").update(settingsId, payload);
    } else {
      await pb.collection("settings").create(payload);
    }

    await logAudit({
      mosqueId,
      userId,
      action: "update_finance_settings",
      entityType: "settings",
      entityId: settingsId || mosqueId,
      after: { ...parsed.data },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "forbidden") {
      return { success: false, error: "Keine Berechtigung." };
    }
    console.error("[settings] updateFinanceSettings:", error);
    return { success: false, error: "Finanz-Einstellungen konnten nicht gespeichert werden." };
  }
}

// =========================================
// Mitgliedsbeiträge (Session 27)
// =========================================

export interface MembershipFeeSettings {
  membership_fees_enabled: boolean;
  membership_default_fee_cents: number;
  membership_default_interval: "monthly" | "quarterly" | "yearly";
}

export async function getMembershipFeeSettings(mosqueId: string): Promise<{
  success: boolean;
  data?: MembershipFeeSettings;
  error?: string;
}> {
  try {
    const pb = await getAdminPB();
    try {
      const record = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${mosqueId}"`);
      return {
        success: true,
        data: {
          membership_fees_enabled: record.membership_fees_enabled || false,
          membership_default_fee_cents: record.membership_default_fee_cents || 1200,
          membership_default_interval:
            (record.membership_default_interval as MembershipFeeSettings["membership_default_interval"]) ||
            "monthly",
        },
      };
    } catch {
      return {
        success: true,
        data: {
          membership_fees_enabled: false,
          membership_default_fee_cents: 1200,
          membership_default_interval: "monthly",
        },
      };
    }
  } catch (error) {
    console.error("[settings] getMembershipFeeSettings:", error);
    return { success: false, error: "Einstellungen konnten nicht geladen werden." };
  }
}

export async function updateMembershipFeeSettings(
  mosqueId: string,
  userId: string,
  data: MembershipFeeSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    const pb = await getAdminPB();

    let settingsId: string | null = null;
    try {
      const record = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${mosqueId}"`);
      settingsId = record.id;
    } catch {
      // Noch kein Settings-Record
    }

    const payload = { mosque_id: mosqueId, ...data };

    if (settingsId) {
      await pb.collection("settings").update(settingsId, payload);
    } else {
      await pb.collection("settings").create(payload);
    }

    await logAudit({
      mosqueId,
      userId,
      action: "update_membership_fee_settings",
      entityType: "settings",
      entityId: settingsId || mosqueId,
    });

    return { success: true };
  } catch (error) {
    console.error("[settings] updateMembershipFeeSettings:", error);
    return {
      success: false,
      error: "Mitgliedsbeitrags-Einstellungen konnten nicht gespeichert werden.",
    };
  }
}

// =========================================
// PocketBase SMTP-Einstellungen
// (für Passwort-Reset und Auth-E-Mails via PocketBase)
// =========================================

export interface PbSmtpSettings {
  smtp: {
    enabled: boolean;
    host: string;
    port: number;
    username: string;
    password: string;
    tls: boolean;
    authMethod: string;
    localName: string;
  };
  meta: {
    senderName: string;
    senderAddress: string;
    appName?: string;
    appUrl?: string;
  };
}

export async function getPbSmtpSettings(): Promise<{
  success: boolean;
  data?: PbSmtpSettings;
  error?: string;
}> {
  try {
    const pb = await getAdminPB();
    // pb.send() nutzt den aktuellen Auth-Token
    const data = await pb.send("/api/settings", { method: "GET" });
    return {
      success: true,
      data: {
        smtp: data.smtp || {
          enabled: false,
          host: "",
          port: 465,
          username: "",
          password: "",
          tls: true,
          authMethod: "PLAIN",
          localName: "",
        },
        meta: data.meta || {
          senderName: "Moschee Portal",
          senderAddress: "",
          appName: "Moschee Portal",
          appUrl: process.env.NEXT_PUBLIC_APP_URL || "",
        },
      },
    };
  } catch (error) {
    console.error("[settings] getPbSmtpSettings:", error);
    return { success: false, error: "SMTP-Einstellungen konnten nicht geladen werden." };
  }
}

export async function updatePbSmtpSettings(
  data: PbSmtpSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    const pb = await getAdminPB();
    await pb.send("/api/settings", {
      method: "PATCH",
      body: data,
    });
    return { success: true };
  } catch (error) {
    console.error("[settings] updatePbSmtpSettings:", error);
    return { success: false, error: "SMTP-Einstellungen konnten nicht gespeichert werden." };
  }
}

// =========================================
// Resend-Status (nur ob konfiguriert, nie der Key selbst)
// =========================================

export async function getResendStatus(): Promise<{ configured: boolean }> {
  return { configured: !!process.env.RESEND_API_KEY };
}

// =========================================
// Förderpartner-Einstellungen
// =========================================

export async function updateSponsorsSettings(
  mosqueId: string,
  userId: string,
  data: { sponsors_enabled: boolean; sponsors_visibility: "public" | "members" }
): Promise<{ success: boolean; error?: string }> {
  try {
    const pb = await getAdminPB();

    let settingsId: string | null = null;
    try {
      const record = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${mosqueId}"`);
      settingsId = record.id;
    } catch {
      // Kein Settings-Record
    }

    const payload = { mosque_id: mosqueId, ...data };

    if (settingsId) {
      await pb.collection("settings").update(settingsId, payload);
    } else {
      await pb.collection("settings").create(payload);
    }

    await logAudit({
      mosqueId,
      userId,
      action: "update_sponsors_settings",
      entityType: "settings",
      entityId: settingsId || mosqueId,
      after: data,
    });

    return { success: true };
  } catch (error) {
    console.error("[settings] updateSponsorsSettings:", error);
    return { success: false, error: "Förderpartner-Einstellungen konnten nicht gespeichert werden." };
  }
}

// =========================================
// Leitung & Team-Einstellungen
// =========================================

export async function updateTeamSettings(
  mosqueId: string,
  userId: string,
  data: { team_enabled: boolean; team_visibility: "public" | "members" }
): Promise<{ success: boolean; error?: string }> {
  try {
    const pb = await getAdminPB();

    let settingsId: string | null = null;
    try {
      const record = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${mosqueId}"`);
      settingsId = record.id;
    } catch {
      // Kein Settings-Record
    }

    const payload = { mosque_id: mosqueId, ...data };

    if (settingsId) {
      await pb.collection("settings").update(settingsId, payload);
    } else {
      await pb.collection("settings").create(payload);
    }

    await logAudit({
      mosqueId,
      userId,
      action: "update_team_settings",
      entityType: "settings",
      entityId: settingsId || mosqueId,
      after: data,
    });

    return { success: true };
  } catch (error) {
    console.error("[settings] updateTeamSettings:", error);
    return { success: false, error: "Team-Einstellungen konnten nicht gespeichert werden." };
  }
}

// =========================================
// Kontaktformular-Einstellungen
// =========================================

export async function updateContactSettings(
  mosqueId: string,
  userId: string,
  data: {
    contact_enabled: boolean;
    contact_email: string;
    contact_notify_admin: boolean;
    contact_auto_reply: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const pb = await getAdminPB();

    let settingsId: string | null = null;
    try {
      const record = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${mosqueId}"`);
      settingsId = record.id;
    } catch {
      // Kein Settings-Record
    }

    const payload = { mosque_id: mosqueId, ...data };

    if (settingsId) {
      await pb.collection("settings").update(settingsId, payload);
    } else {
      await pb.collection("settings").create(payload);
    }

    await logAudit({
      mosqueId,
      userId,
      action: "update_contact_settings",
      entityType: "settings",
      entityId: settingsId || mosqueId,
      after: data,
    });

    return { success: true };
  } catch (error) {
    console.error("[settings] updateContactSettings:", error);
    return { success: false, error: "Kontakt-Einstellungen konnten nicht gespeichert werden." };
  }
}

// =========================================
// Vereinsangaben für Spendenbescheinigungen
// =========================================

export async function getVereinSettings(mosqueId: string): Promise<{
  success: boolean;
  data?: {
    verein_anschrift: string;
    verein_steuernummer: string;
    freistellungsbescheid_text: string;
    verein_foerderzweck: string;
  };
  error?: string;
}> {
  try {
    const pb = await getAdminPB();
    let record: Record<string, unknown> | null = null;
    try {
      record = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${mosqueId}"`);
    } catch {
      // Kein Settings-Record → Defaults
    }
    return {
      success: true,
      data: {
        verein_anschrift: (record?.verein_anschrift as string) || "",
        verein_steuernummer: (record?.verein_steuernummer as string) || "",
        freistellungsbescheid_text:
          (record?.freistellungsbescheid_text as string) || "",
        verein_foerderzweck: (record?.verein_foerderzweck as string) || "",
      },
    };
  } catch (error) {
    console.error("[settings] getVereinSettings:", error);
    return { success: false, error: "Vereinsangaben konnten nicht geladen werden." };
  }
}

export async function updateVereinSettings(
  mosqueId: string,
  userId: string,
  data: {
    verein_anschrift: string;
    verein_steuernummer: string;
    freistellungsbescheid_text: string;
    verein_foerderzweck: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const pb = await getAdminPB();

    let settingsId: string | null = null;
    try {
      const record = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${mosqueId}"`);
      settingsId = record.id;
    } catch {
      // Kein Settings-Record
    }

    const payload = { mosque_id: mosqueId, ...data };

    if (settingsId) {
      await pb.collection("settings").update(settingsId, payload);
    } else {
      await pb.collection("settings").create(payload);
    }

    await logAudit({
      mosqueId,
      userId,
      action: "update_verein_settings",
      entityType: "settings",
      entityId: settingsId || mosqueId,
      after: data,
    });

    return { success: true };
  } catch (error) {
    console.error("[settings] updateVereinSettings:", error);
    return { success: false, error: "Vereinsangaben konnten nicht gespeichert werden." };
  }
}

// =========================================
// Überweisungs-QR (EPC069-12 / Girocode)
// =========================================

export interface BankTransferSettings {
  bank_transfer_enabled: boolean;
  bank_iban: string;
  bank_bic: string;
  bank_holder: string;
}

export async function getBankTransferSettings(mosqueId: string): Promise<{
  success: boolean;
  data?: BankTransferSettings;
  error?: string;
}> {
  try {
    const pb = await getAdminPB();
    let record: Record<string, unknown> | null = null;
    try {
      record = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${mosqueId}"`);
    } catch {
      // Kein Settings-Record → Defaults
    }
    return {
      success: true,
      data: {
        bank_transfer_enabled: (record?.bank_transfer_enabled as boolean) || false,
        bank_iban: (record?.bank_iban as string) || "",
        bank_bic: (record?.bank_bic as string) || "",
        bank_holder: (record?.bank_holder as string) || "",
      },
    };
  } catch (error) {
    console.error("[settings] getBankTransferSettings:", error);
    return { success: false, error: "Einstellungen konnten nicht geladen werden." };
  }
}

export async function updateBankTransferSettings(
  mosqueId: string,
  userId: string,
  data: BankTransferSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    // IBAN serverseitig per mod-97 prüfen → Admin-Tippfehler fällt sofort auf,
    // nicht erst beim Spender mit kaputtem QR-Code.
    if (data.bank_transfer_enabled) {
      if (!data.bank_iban?.trim()) {
        return { success: false, error: "Bitte eine IBAN angeben, wenn Überweisung aktiviert ist." };
      }
      if (!isValidIban(data.bank_iban)) {
        return { success: false, error: "Ungültige IBAN. Bitte Eingabe prüfen." };
      }
      if (!data.bank_holder?.trim()) {
        return { success: false, error: "Bitte den Kontoinhaber angeben." };
      }
    }

    const pb = await getAdminPB();

    let settingsId: string | null = null;
    try {
      const record = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${mosqueId}"`);
      settingsId = record.id;
    } catch {
      // Kein Settings-Record
    }

    const payload = {
      mosque_id: mosqueId,
      bank_transfer_enabled: data.bank_transfer_enabled,
      bank_iban: normalizeIban(data.bank_iban),
      bank_bic: (data.bank_bic || "").replace(/\s+/g, "").toUpperCase(),
      bank_holder: (data.bank_holder || "").trim(),
    };

    if (settingsId) {
      await pb.collection("settings").update(settingsId, payload);
    } else {
      await pb.collection("settings").create(payload);
    }

    await logAudit({
      mosqueId,
      userId,
      action: "update_bank_transfer_settings",
      entityType: "settings",
      entityId: settingsId || mosqueId,
    });

    return { success: true };
  } catch (error) {
    console.error("[settings] updateBankTransferSettings:", error);
    return { success: false, error: "Überweisungs-Einstellungen konnten nicht gespeichert werden." };
  }
}

// =========================================
// Zahlungsarten-Einstellungen (PayPal)
// =========================================

/**
 * Liest PayPal-Zahlungseinstellungen vom Mosque-Record.
 */
export async function getPaymentSettings(mosqueId: string): Promise<{
  donation_provider: string;
  paypal_enabled: boolean;
  paypal_donate_url: string;
}> {
  try {
    const pb = await getAdminPB();
    const mosque = await pb
      .collection("mosques")
      .getOne(mosqueId, { fields: "donation_provider,paypal_enabled,paypal_donate_url" });
    return {
      donation_provider: mosque.donation_provider || "stripe",
      paypal_enabled: mosque.paypal_enabled ?? false,
      paypal_donate_url: mosque.paypal_donate_url || "",
    };
  } catch (error) {
    console.error("[settings] getPaymentSettings:", error);
    return { donation_provider: "stripe", paypal_enabled: false, paypal_donate_url: "" };
  }
}

/**
 * Speichert PayPal-Zahlungseinstellungen auf dem Mosque-Record.
 * Validiert die PayPal-URL serverseitig (hostname muss "paypal.me" sein).
 */
export async function updatePaymentSettings(
  mosqueId: string,
  data: { paypal_enabled: boolean; paypal_donate_url: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Backend-Validierung: echte Domain-Prüfung (verhindert paypal.me.evil.com)
    if (data.paypal_enabled && data.paypal_donate_url) {
      try {
        const parsed = new URL(data.paypal_donate_url);
        if (parsed.hostname !== "paypal.me") {
          return { success: false, error: "Ungültige PayPal-URL. Bitte eine paypal.me-URL eingeben." };
        }
      } catch {
        return { success: false, error: "Ungültige URL-Format." };
      }
    }

    if (data.paypal_enabled && !data.paypal_donate_url) {
      return { success: false, error: "Bitte eine PayPal.me-URL eingeben wenn PayPal aktiviert ist." };
    }

    const pb = await getAdminPB();
    await pb.collection("mosques").update(mosqueId, {
      paypal_enabled: data.paypal_enabled,
      paypal_donate_url: data.paypal_donate_url || "",
    });

    await logAudit({
      mosqueId,
      action: "payment_settings_updated",
      entityType: "mosque",
      entityId: mosqueId,
      after: data,
    });

    return { success: true };
  } catch (error) {
    console.error("[settings] updatePaymentSettings:", error);
    return { success: false, error: "Zahlungseinstellungen konnten nicht gespeichert werden." };
  }
}

// =========================================
// Wiederkehrende Spenden (Daueraufträge)
// =========================================

export interface RecurringDonationSettings {
  recurring_donations_enabled: boolean;
  recurring_min_cents: number;
  recurring_quick_amounts: string;
}

export async function getRecurringDonationSettings(mosqueId: string): Promise<{
  success: boolean;
  data?: RecurringDonationSettings;
  error?: string;
}> {
  try {
    const pb = await getAdminPB();
    try {
      const record = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${mosqueId}"`, {
          fields: "recurring_donations_enabled,recurring_min_cents,recurring_quick_amounts",
        });
      return {
        success: true,
        data: {
          recurring_donations_enabled: record.recurring_donations_enabled ?? false,
          recurring_min_cents: record.recurring_min_cents ?? 1000,
          recurring_quick_amounts: record.recurring_quick_amounts ?? "1000,2000,5000,10000",
        },
      };
    } catch {
      return {
        success: true,
        data: {
          recurring_donations_enabled: false,
          recurring_min_cents: 1000,
          recurring_quick_amounts: "1000,2000,5000,10000",
        },
      };
    }
  } catch (error) {
    console.error("[settings] getRecurringDonationSettings:", error);
    return { success: false, error: "Einstellungen konnten nicht geladen werden." };
  }
}

export async function updateRecurringDonationSettings(
  mosqueId: string,
  userId: string,
  data: RecurringDonationSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    if (data.recurring_min_cents < 100) {
      return { success: false, error: "Mindestbetrag ist 1,00 €." };
    }
    const quickAmounts = data.recurring_quick_amounts
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (quickAmounts.some((a) => !/^\d+$/.test(a))) {
      return { success: false, error: "Schnell-Beträge müssen Ganzzahlen in Cent sein." };
    }

    const pb = await getAdminPB();
    let settingsId: string | null = null;
    try {
      const record = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${mosqueId}"`);
      settingsId = record.id;
    } catch {
      // kein Record
    }

    const payload = { mosque_id: mosqueId, ...data };

    if (settingsId) {
      const updated = await pb.collection("settings").update(settingsId, payload);
      // PocketBase ignoriert unbekannte Felder still → Schema-Check
      if (
        "recurring_donations_enabled" in payload &&
        typeof updated.recurring_donations_enabled === "undefined"
      ) {
        throw new Error(
          "Recurring settings fields missing in schema — run: node scripts/migrate-v1.mjs"
        );
      }
    } else {
      await pb.collection("settings").create(payload);
    }

    await logAudit({
      mosqueId,
      userId,
      action: "update_recurring_donation_settings",
      entityType: "settings",
      entityId: settingsId || mosqueId,
      after: { ...data },
    });

    return { success: true };
  } catch (error) {
    console.error("[settings] updateRecurringDonationSettings:", error);
    return { success: false, error: "Dauerauftrag-Einstellungen konnten nicht gespeichert werden." };
  }
}

// =========================================
// TV-Anzeige (Public-Bildschirm-Modus)
// =========================================

export type TVSettingsResolved = {
  tv_enabled: boolean;
  tv_modules: TVModules;
  tv_slide_order: TVModuleKey[];
  tv_module_counts: TVModuleCounts;
  tv_rotation_seconds: number;
  tv_locale_mode: "single" | "rotate" | "bilingual";
  tv_locale_primary: "de" | "tr" | "ar" | "en";
  tv_locale_secondary: "de" | "tr" | "ar" | "en" | "none";
  tv_locale_rotate_seconds: number;
  tv_bg_color: string;
  tv_text_color: string;
  tv_accent_color: string;
  tv_announcement_text: string;
  tv_announcement_text_secondary: string;
  tv_show_hijri: boolean;
  tv_show_arabic_prayer_names: boolean;
  tv_highlight_active_prayer: boolean;
  tv_highlight_duration_seconds: number;
};

const DEFAULT_TV_MODULES: TVModules = {
  prayer: true,
  events: true,
  posts: true,
  campaigns: false,
  qr_donate: false,
  qr_transfer: false,
  announcement: false,
};

const DEFAULT_TV_SLIDE_ORDER: TVModuleKey[] = [
  "prayer",
  "events",
  "posts",
  "announcement",
  "campaigns",
  "qr_donate",
  "qr_transfer",
];

const DEFAULT_TV_MODULE_COUNTS: TVModuleCounts = {
  events: 3,
  posts: 1,
  campaigns: 1,
};

function parseTVJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === "object") return raw as T;
  if (typeof raw === "string") {
    if (!raw.trim()) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function normalizeTVModules(raw: unknown): TVModules {
  const parsed = parseTVJson<Partial<TVModules>>(raw, {});
  const result: TVModules = { ...DEFAULT_TV_MODULES };
  for (const key of TV_MODULE_KEYS) {
    if (typeof parsed[key] === "boolean") result[key] = parsed[key] as boolean;
  }
  return result;
}

function normalizeTVSlideOrder(raw: unknown): TVModuleKey[] {
  const parsed = parseTVJson<TVModuleKey[]>(raw, []);
  if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_TV_SLIDE_ORDER;
  const known = new Set<TVModuleKey>(TV_MODULE_KEYS);
  const filtered = parsed.filter((k): k is TVModuleKey => known.has(k as TVModuleKey));
  // Fehlende Module hinten anhängen — damit nach Schema-Erweiterungen nichts verloren geht
  for (const k of DEFAULT_TV_SLIDE_ORDER) {
    if (!filtered.includes(k)) filtered.push(k);
  }
  return filtered.slice(0, 7);
}

function normalizeTVModuleCounts(raw: unknown): TVModuleCounts {
  const parsed = parseTVJson<TVModuleCounts>(raw, {});
  const result: TVModuleCounts = { ...DEFAULT_TV_MODULE_COUNTS };
  for (const key of TV_MODULE_KEYS) {
    const n = parsed[key];
    if (typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 10) result[key] = n;
  }
  return result;
}

export async function getTVSettings(mosqueId: string): Promise<TVSettingsResolved> {
  const defaults: TVSettingsResolved = {
    tv_enabled: false,
    tv_modules: { ...DEFAULT_TV_MODULES },
    tv_slide_order: [...DEFAULT_TV_SLIDE_ORDER],
    tv_module_counts: { ...DEFAULT_TV_MODULE_COUNTS },
    tv_rotation_seconds: 15,
    tv_locale_mode: "single",
    tv_locale_primary: "de",
    tv_locale_secondary: "tr",
    tv_locale_rotate_seconds: 8,
    tv_bg_color: "",
    tv_text_color: "",
    tv_accent_color: "",
    tv_announcement_text: "",
    tv_announcement_text_secondary: "",
    tv_show_hijri: true,
    tv_show_arabic_prayer_names: true,
    tv_highlight_active_prayer: true,
    tv_highlight_duration_seconds: 300,
  };

  try {
    const pb = await getAdminPB();
    const record = await pb
      .collection("settings")
      .getFirstListItem(`mosque_id = "${mosqueId.replace(/"/g, "")}"`);
    const r = record as unknown as Settings & {
      tv_enabled?: boolean;
      tv_modules?: unknown;
      tv_slide_order?: unknown;
      tv_module_counts?: unknown;
      tv_rotation_seconds?: number;
      tv_locale_mode?: string;
      tv_locale_primary?: string;
      tv_locale_secondary?: string;
      tv_locale_rotate_seconds?: number;
      tv_bg_color?: string;
      tv_text_color?: string;
      tv_accent_color?: string;
      tv_announcement_text?: string;
      tv_announcement_text_secondary?: string;
      tv_show_hijri?: boolean;
      tv_show_arabic_prayer_names?: boolean;
      tv_highlight_active_prayer?: boolean;
      tv_highlight_duration_seconds?: number;
    };
    return {
      tv_enabled: r.tv_enabled ?? defaults.tv_enabled,
      tv_modules: normalizeTVModules(r.tv_modules),
      tv_slide_order: normalizeTVSlideOrder(r.tv_slide_order),
      tv_module_counts: normalizeTVModuleCounts(r.tv_module_counts),
      tv_rotation_seconds: r.tv_rotation_seconds && r.tv_rotation_seconds >= 5 ? r.tv_rotation_seconds : defaults.tv_rotation_seconds,
      tv_locale_mode: (r.tv_locale_mode as TVSettingsResolved["tv_locale_mode"]) || defaults.tv_locale_mode,
      tv_locale_primary: (r.tv_locale_primary as TVSettingsResolved["tv_locale_primary"]) || defaults.tv_locale_primary,
      tv_locale_secondary: (r.tv_locale_secondary as TVSettingsResolved["tv_locale_secondary"]) || defaults.tv_locale_secondary,
      tv_locale_rotate_seconds: r.tv_locale_rotate_seconds && r.tv_locale_rotate_seconds >= 3 ? r.tv_locale_rotate_seconds : defaults.tv_locale_rotate_seconds,
      tv_bg_color: r.tv_bg_color ?? "",
      tv_text_color: r.tv_text_color ?? "",
      tv_accent_color: r.tv_accent_color ?? "",
      tv_announcement_text: r.tv_announcement_text ?? "",
      tv_announcement_text_secondary: r.tv_announcement_text_secondary ?? "",
      tv_show_hijri: r.tv_show_hijri ?? defaults.tv_show_hijri,
      tv_show_arabic_prayer_names: r.tv_show_arabic_prayer_names ?? defaults.tv_show_arabic_prayer_names,
      tv_highlight_active_prayer: r.tv_highlight_active_prayer ?? defaults.tv_highlight_active_prayer,
      tv_highlight_duration_seconds: r.tv_highlight_duration_seconds && r.tv_highlight_duration_seconds >= 60 ? r.tv_highlight_duration_seconds : defaults.tv_highlight_duration_seconds,
    };
  } catch {
    return defaults;
  }
}


export async function updateTVSettings(
  mosqueId: string,
  userId: string,
  data: TVSettingsInput
): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
  const parsed = tvSettingsSchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.join(".") || "";
    const msg = first?.message || "Ungültige TV-Einstellungen";
    return { success: false, error: path ? `${path}: ${msg}` : msg };
  }
  const v = parsed.data;

  try {
    const pb = await getAdminPB();

    let settingsId: string | null = null;
    try {
      const record = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${mosqueId.replace(/"/g, "")}"`);
      settingsId = record.id;
    } catch {
      // Noch kein Settings-Record
    }

    // Mosque für Brand-Farben holen (für Contrast-Validierung der resolved-Defaults)
    const mosqueRecord = await pb.collection("mosques").getOne(mosqueId, {
      fields: "brand_theme,brand_primary_color",
    });
    const mosque = mosqueRecord as unknown as Mosque;

    // Bei mode='single' Sekundärsprache server-seitig normalisieren
    const secondary = v.tv_locale_mode === "single" ? v.tv_locale_secondary : v.tv_locale_secondary;

    const resolvedColors: TVColors = {
      bg: "#0a0a0a",
      text: "#fafafa",
      accent: getBrandColor(mosque.brand_theme, mosque.brand_primary_color),
    };
    const contrast = validateTVColors(v.tv_bg_color, v.tv_text_color, v.tv_accent_color, resolvedColors);

    const payload = {
      mosque_id: mosqueId,
      tv_enabled: v.tv_enabled,
      tv_modules: JSON.stringify(v.tv_modules),
      tv_slide_order: JSON.stringify(v.tv_slide_order),
      tv_module_counts: JSON.stringify(v.tv_module_counts),
      tv_rotation_seconds: v.tv_rotation_seconds,
      tv_locale_mode: v.tv_locale_mode,
      tv_locale_primary: v.tv_locale_primary,
      tv_locale_secondary: secondary,
      tv_locale_rotate_seconds: v.tv_locale_rotate_seconds,
      tv_bg_color: v.tv_bg_color,
      tv_text_color: v.tv_text_color,
      tv_accent_color: v.tv_accent_color,
      tv_announcement_text: v.tv_announcement_text,
      tv_announcement_text_secondary: v.tv_announcement_text_secondary,
      tv_show_hijri: v.tv_show_hijri,
      tv_show_arabic_prayer_names: v.tv_show_arabic_prayer_names,
      tv_highlight_active_prayer: v.tv_highlight_active_prayer,
      tv_highlight_duration_seconds: v.tv_highlight_duration_seconds,
    };

    if (settingsId) {
      await pb.collection("settings").update(settingsId, payload);
    } else {
      await pb.collection("settings").create(payload);
    }

    await logAudit({
      mosqueId,
      userId,
      action: "update_tv_settings",
      entityType: "settings",
      entityId: settingsId || mosqueId,
    });

    revalidateTag(`mosque:${mosqueId}:tv`);

    if (!contrast.ok) {
      return { success: true, warnings: contrast.warnings };
    }
    return { success: true };
  } catch (error) {
    console.error("[settings] updateTVSettings:", error);
    return { success: false, error: "TV-Einstellungen konnten nicht gespeichert werden." };
  }
}


