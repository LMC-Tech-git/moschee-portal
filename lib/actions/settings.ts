"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { logAudit } from "@/lib/audit";
import type { Mosque, Settings } from "@/types";

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
    tune: string;
    latitude: number | null;
    longitude: number | null;
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
      tune: data.tune,
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

    let settings: Settings | null = null;
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
        tune: "",
        locale: "de",
        default_post_visibility: "public",
        default_event_visibility: "public",
        donation_quick_amounts: "10,25,50,100",
        madrasa_fees_enabled: false,
        madrasa_default_fee_cents: 1000,
        fee_reminder_enabled: false,
        fee_reminder_day: 15,
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
  };
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
          madrasa_fees_enabled: record.madrasa_fees_enabled || false,
          madrasa_default_fee_cents: record.madrasa_default_fee_cents || 1000,
          fee_reminder_enabled: record.fee_reminder_enabled || false,
          fee_reminder_day: record.fee_reminder_day || 15,
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
