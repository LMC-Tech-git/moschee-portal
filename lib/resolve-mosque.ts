import { cache } from "react";
import { getAdminPB } from "./pocketbase-admin";
import type { Mosque, Settings } from "@/types";

/**
 * Löst eine Moschee anhand ihres Slugs auf (server-seitig).
 * Gibt null zurück wenn der Slug nicht existiert.
 *
 * React.cache() stellt sicher, dass die Funktion pro Render-Baum
 * nur einmal aufgerufen wird – auch wenn Layout + Page sie beide nutzen.
 */
export const resolveMosqueBySlug = cache(async (
  slug: string
): Promise<Mosque | null> => {
  try {
    const pb = await getAdminPB();
    const record = await pb
      .collection("mosques")
      .getFirstListItem(`slug = "${slug.replace(/"/g, "")}"`);
    return record as unknown as Mosque;
  } catch (error) {
    console.error(`[resolveMosque] Fehler bei slug="${slug}":`, error);
    return null;
  }
});

/**
 * Lädt die Settings einer Moschee.
 * Gibt Default-Werte zurück wenn keine Settings existieren.
 */
export async function resolveMosqueSettings(
  mosqueId: string
): Promise<Settings> {
  const defaults: Settings = {
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
    recurring_min_cents: 1000,
    recurring_quick_amounts: "1000,2000,5000,10000",
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
    verein_anschrift: "",
    verein_steuernummer: "",
    freistellungsbescheid_text: "",
    verein_foerderzweck: "",
    // TV defaults
    tv_enabled: false,
    tv_modules: JSON.stringify({ prayer: true, events: true, posts: true, campaigns: false, qr_donate: false, announcement: false }),
    tv_slide_order: JSON.stringify(["prayer", "events", "posts", "announcement", "campaigns", "qr_donate"]),
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

  try {
    const pb = await getAdminPB();
    const record = await pb
      .collection("settings")
      .getFirstListItem(`mosque_id = "${mosqueId}"`);
    return { ...defaults, ...(record as unknown as Settings) };
  } catch {
    return defaults;
  }
}

/**
 * Löst eine Moschee + Settings zusammen auf.
 * Convenience-Funktion für Route Handlers und Server Components.
 */
export async function resolveMosqueWithSettings(
  slug: string
): Promise<{ mosque: Mosque; settings: Settings } | null> {
  const mosque = await resolveMosqueBySlug(slug);
  if (!mosque) return null;

  const settings = await resolveMosqueSettings(mosque.id);
  return { mosque, settings };
}
