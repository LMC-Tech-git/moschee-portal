"use server";

import { randomBytes } from "crypto";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { logAudit } from "@/lib/audit";
import { applyPhoneNorm, detectCountryFromMosque } from "@/lib/phone";
import { sendEmailDirect } from "@/lib/email";
import { renderEmailChangeConfirmation } from "@/lib/email/templates";
import type { User, Donation, EventRegistration } from "@/types";
import type { RecordModel } from "pocketbase";

// --- Helpers ---

function mapRecordToUser(record: RecordModel): User {
  return {
    id: record.id,
    mosque_id: record.mosque_id || "",
    email: record.email || "",
    first_name: record.first_name || "",
    last_name: record.last_name || "",
    full_name: record.full_name || `${record.first_name || ""} ${record.last_name || ""}`.trim(),
    phone: record.phone || "",
    address: record.address || "",
    member_no: record.member_no || "",
    membership_number: record.membership_number || record.member_no || "",
    status: record.status || "pending",
    role: record.role || "member",
    created: record.created || "",
    updated: record.updated || "",
  };
}

// --- Server Actions ---

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Alle Mitglieder einer Moschee laden (Admin, paginiert + filterbar).
 */
export async function getMembersByMosque(
  mosqueId: string,
  options?: {
    status?: "pending" | "active" | "inactive" | "blocked";
    role?: "admin" | "member" | "teacher" | "imam" | "editor";
    search?: string;
    page?: number;
    limit?: number;
  }
): Promise<ActionResult<User[]> & { totalPages?: number; totalItems?: number; page?: number }> {
  try {
    const pb = await getAdminPB();
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    const filters: string[] = [`mosque_id = "${mosqueId}"`];
    if (options?.status) {
      filters.push(`status = "${options.status}"`);
    }
    if (options?.role) {
      filters.push(`role = "${options.role}"`);
    }
    if (options?.search?.trim()) {
      const q = options.search.trim().replace(/"/g, '\\"');
      filters.push(
        `(full_name ~ "${q}" || email ~ "${q}" || membership_number ~ "${q}" || member_no ~ "${q}")`
      );
    }

    const records = await pb.collection("users").getList(page, limit, {
      filter: filters.join(" && "),
      sort: "-created",
    });

    return {
      success: true,
      data: records.items.map(mapRecordToUser),
      totalPages: records.totalPages,
      totalItems: records.totalItems,
      page: records.page,
    };
  } catch (error) {
    console.error("[Members] Fehler beim Laden:", error);
    return { success: false, error: "Mitglieder konnten nicht geladen werden" };
  }
}

/**
 * Einzelnes Mitglied laden (Admin).
 */
export async function getMemberById(
  memberId: string,
  mosqueId: string
): Promise<ActionResult<User>> {
  try {
    const pb = await getAdminPB();
    const record = await pb.collection("users").getOne(memberId);

    if (record.mosque_id !== mosqueId) {
      return { success: false, error: "Mitglied nicht gefunden" };
    }

    return { success: true, data: mapRecordToUser(record) };
  } catch (error) {
    console.error("[Members] Fehler beim Laden:", error);
    return { success: false, error: "Mitglied konnte nicht geladen werden" };
  }
}

/**
 * Mitglied-Daten aktualisieren (Admin).
 */
export async function updateMember(
  memberId: string,
  mosqueId: string,
  adminUserId: string,
  data: {
    full_name: string;
    phone: string;
    membership_number: string;
    role: string;
    status: string;
  }
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();

    const member = await pb.collection("users").getOne(memberId);
    if (member.mosque_id !== mosqueId) {
      return { success: false, error: "Mitglied nicht gefunden" };
    }

    // Moschee laden → Land für Telefonnormalisierung bestimmen
    const mosque = await pb.collection("mosques").getOne(mosqueId);
    const country = detectCountryFromMosque(mosque as { timezone?: string; address?: string; city?: string });
    const normalizedPhone = applyPhoneNorm(data.phone, country);

    const changes: Record<string, unknown> = {};
    if (data.full_name !== member.full_name) changes.full_name = data.full_name;
    if (normalizedPhone !== (member.phone || "")) changes.phone = normalizedPhone;
    if (data.membership_number !== (member.membership_number || "")) changes.membership_number = data.membership_number;
    if (data.role !== member.role) changes.role = data.role;
    if (data.status !== member.status) changes.status = data.status;

    if (Object.keys(changes).length === 0) {
      return { success: true };
    }

    await pb.collection("users").update(memberId, changes);

    const details: Record<string, unknown> = {};
    if (changes.role) {
      details.old_role = member.role;
      details.new_role = data.role;
    }
    if (changes.status) {
      details.old_status = member.status;
      details.new_status = data.status;
    }
    if (changes.full_name) details.new_name = data.full_name;

    await logAudit({
      mosqueId,
      userId: adminUserId,
      action: changes.status ? "member.status_changed" : changes.role ? "member.role_changed" : "member.updated",
      entityType: "member",
      entityId: memberId,
      details,
    });

    return { success: true };
  } catch (error) {
    console.error("[Members] Fehler beim Update:", error);
    return { success: false, error: "Mitglied konnte nicht aktualisiert werden" };
  }
}

/**
 * Mitglied-Status ändern (Admin).
 */
export async function updateMemberStatus(
  memberId: string,
  mosqueId: string,
  adminUserId: string,
  newStatus: "pending" | "active" | "inactive" | "blocked"
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();

    const member = await pb.collection("users").getOne(memberId);
    if (member.mosque_id !== mosqueId) {
      return { success: false, error: "Mitglied nicht gefunden" };
    }

    const wasInactive = member.status === "inactive" || member.status === "pending";

    await pb.collection("users").update(memberId, { status: newStatus });

    await logAudit({
      mosqueId,
      userId: adminUserId,
      action: "member.status_changed",
      entityType: "user",
      entityId: memberId,
      details: { old_status: member.status, new_status: newStatus },
    });

    // Reaktivierungs-E-Mail senden
    if (newStatus === "active" && wasInactive && member.email) {
      try {
        const mosque = await pb.collection("mosques").getOne(mosqueId);
        const mosqueName = mosque.name || "Moschee-Portal";
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
        const userName = (member.full_name || `${member.first_name || ""} ${member.last_name || ""}`.trim()) || undefined;

        const { baseTemplate } = await import("@/lib/email/templates");
        const greeting = userName ? `Liebe/r ${userName},` : "Guten Tag,";
        const content = `
          <p style="margin:0 0 16px;color:#111827;font-size:16px;font-weight:600;">${greeting}</p>
          <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.6;">
            Ihr Konto bei <strong>${mosqueName}</strong> wurde aktiviert. Sie können sich jetzt im Portal anmelden.
          </p>
          ${appUrl ? `<p style="margin:16px 0 0;"><a href="${appUrl}/login" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">Jetzt anmelden</a></p>` : ""}
        `;
        const html = baseTemplate(content, mosqueName, mosque.brand_primary_color || undefined);

        await sendEmailDirect({
          to: member.email,
          subject: `Ihr Konto wurde aktiviert — ${mosqueName}`,
          html,
        });
      } catch (emailErr) {
        console.error("[Members] Reaktivierungs-E-Mail fehlgeschlagen:", emailErr);
        // Kein Fehler zurückgeben — Status-Update war erfolgreich
      }
    }

    return { success: true };
  } catch (error) {
    console.error("[Members] Fehler beim Status-Update:", error);
    return { success: false, error: "Status konnte nicht geändert werden" };
  }
}

/**
 * Mitglied-Rolle ändern (Admin).
 */
export async function updateMemberRole(
  memberId: string,
  mosqueId: string,
  adminUserId: string,
  newRole: "admin" | "member" | "teacher" | "imam" | "editor"
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();

    const member = await pb.collection("users").getOne(memberId);
    if (member.mosque_id !== mosqueId) {
      return { success: false, error: "Mitglied nicht gefunden" };
    }

    await pb.collection("users").update(memberId, { role: newRole });

    await logAudit({
      mosqueId,
      userId: adminUserId,
      action: "member.role_changed",
      entityType: "user",
      entityId: memberId,
      details: { old_role: member.role, new_role: newRole },
    });

    return { success: true };
  } catch (error) {
    console.error("[Members] Fehler:", error);
    return { success: false, error: "Rolle konnte nicht geändert werden" };
  }
}

/**
 * Eigenes Profil aktualisieren (Member).
 */
export async function updateProfile(
  userId: string,
  data: { first_name: string; last_name: string; phone: string; address?: string }
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();

    // User laden, um mosque_id für Telefonnormalisierung zu kennen
    const user = await pb.collection("users").getOne(userId);
    let normalizedPhone = (data.phone ?? "").trim();
    if (user.mosque_id) {
      const mosque = await pb.collection("mosques").getOne(user.mosque_id);
      const country = detectCountryFromMosque(mosque as { timezone?: string; address?: string; city?: string });
      normalizedPhone = applyPhoneNorm(data.phone, country);
    }

    await pb.collection("users").update(userId, {
      first_name: data.first_name,
      last_name: data.last_name,
      full_name: `${data.first_name} ${data.last_name}`.trim(),
      phone: normalizedPhone,
      address: data.address ?? "",
    });

    return { success: true };
  } catch (error) {
    console.error("[Profile] Fehler:", error);
    return { success: false, error: "Profil konnte nicht aktualisiert werden" };
  }
}

/**
 * E-Mail-Adresse ändern: Token generieren + Bestätigungsmail an neue Adresse senden.
 */
export async function requestEmailChange(
  userId: string,
  newEmail: string
): Promise<ActionResult> {
  try {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { success: false, error: "Ungültige E-Mail-Adresse." };
    }

    const pb = await getAdminPB();

    // Neue Adresse darf nicht schon vergeben sein
    try {
      await pb.collection("users").getFirstListItem(`email = "${trimmed}"`);
      return { success: false, error: "Diese E-Mail-Adresse wird bereits verwendet." };
    } catch {
      // Gut — nicht vergeben
    }

    const user = await pb.collection("users").getOne(userId);

    // Nicht ändern wenn identisch
    if (user.email === trimmed) {
      return { success: false, error: "Das ist bereits Ihre aktuelle E-Mail-Adresse." };
    }

    const mosque = await pb.collection("mosques").getOne(user.mosque_id);

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await pb.collection("users").update(userId, {
      pending_email: trimmed,
      email_change_token: token,
      email_change_expires_at: expiresAt,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const confirmUrl = `${appUrl}/api/email-change/confirm?token=${token}`;
    const userName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || undefined;

    const html = renderEmailChangeConfirmation({
      mosqueName: mosque.name,
      userName,
      newEmail: trimmed,
      confirmUrl,
      accentColor: mosque.brand_primary_color || undefined,
    });

    const sendResult = await sendEmailDirect({
      to: trimmed,
      subject: `E-Mail-Adresse bestätigen — ${mosque.name}`,
      html,
    });

    if (!sendResult.success) {
      await pb.collection("users").update(userId, {
        pending_email: "",
        email_change_token: "",
        email_change_expires_at: "",
      });
      return { success: false, error: "Bestätigungs-E-Mail konnte nicht gesendet werden." };
    }

    return { success: true };
  } catch (error) {
    console.error("[requestEmailChange] Fehler:", error);
    return { success: false, error: "E-Mail-Änderung konnte nicht gestartet werden." };
  }
}

/**
 * Spendenhistorie eines Mitglieds laden.
 */
export async function getMemberDonations(
  userId: string,
  mosqueId: string
): Promise<ActionResult<Donation[]>> {
  try {
    const pb = await getAdminPB();

    const records = await pb.collection("donations").getFullList({
      filter: `user_id = "${userId}" && mosque_id = "${mosqueId}"`,
      sort: "-created",
    });

    const donations: Donation[] = records.map((r) => ({
      id: r.id,
      mosque_id: r.mosque_id || "",
      campaign_id: r.campaign_id || "",
      donor_type: r.donor_type || "member",
      user_id: r.user_id || "",
      donor_name: r.donor_name || "",
      donor_email: r.donor_email || "",
      amount: r.amount || 0,
      amount_cents: r.amount_cents || Math.round((r.amount || 0) * 100),
      currency: r.currency || "EUR",
      is_recurring: r.is_recurring || false,
      subscription_id: r.subscription_id || "",
      provider: r.provider || "stripe",
      provider_ref: r.provider_ref || "",
      status: r.status || "paid",
      paid_at: r.paid_at || "",
      created: r.created || "",
      updated: r.updated || "",
    }));

    return { success: true, data: donations };
  } catch (error) {
    console.error("[Members] Fehler beim Laden der Spenden:", error);
    return { success: false, error: "Spendenhistorie konnte nicht geladen werden" };
  }
}

/**
 * Event-Teilnahmehistorie eines Mitglieds laden.
 */
export async function getMemberEventHistory(
  userId: string,
  mosqueId: string
): Promise<
  ActionResult<
    (EventRegistration & { event_title?: string; event_start_at?: string })[]
  >
> {
  try {
    const pb = await getAdminPB();

    const records = await pb.collection("event_registrations").getFullList({
      filter: `user_id = "${userId}" && mosque_id = "${mosqueId}"`,
      sort: "-created",
      expand: "event_id",
    });

    const history = records.map((r) => {
      const expanded = r.expand?.event_id;
      return {
        id: r.id,
        mosque_id: r.mosque_id || "",
        event_id: r.event_id || "",
        registrant_type: r.registrant_type || "member" as const,
        user_id: r.user_id || "",
        guest_name: r.guest_name || "",
        guest_email: r.guest_email || "",
        status: r.status || "registered",
        registered_at: r.registered_at || r.created || "",
        cancelled_at: r.cancelled_at || "",
        verify_token: r.verify_token || "",
        verified_at: r.verified_at || "",
        source_ip_hash: r.source_ip_hash || "",
        user_agent: r.user_agent || "",
        created: r.created || "",
        updated: r.updated || "",
        event_title: expanded?.title || "",
        event_start_at: expanded?.start_at || "",
      };
    });

    return { success: true, data: history };
  } catch (error) {
    console.error("[Members] Fehler beim Laden der Event-Historie:", error);
    return { success: false, error: "Event-Historie konnte nicht geladen werden" };
  }
}

/**
 * Spendenbescheinigungsdaten für ein Jahr laden.
 */
export interface DonationReceiptData {
  mosque: {
    name: string;
    address: string;
    city: string;
  };
  donor: {
    full_name: string;
    email: string;
    membership_number: string;
  };
  year: number;
  donations: {
    id: string;
    amount_cents: number;
    paid_at: string;
    provider: string;
  }[];
  totalCents: number;
}

export async function getDonationReceiptData(
  userId: string,
  mosqueId: string,
  year: number
): Promise<ActionResult<DonationReceiptData>> {
  try {
    const pb = await getAdminPB();

    // Moschee-Daten laden
    const mosque = await pb.collection("mosques").getOne(mosqueId);

    // User-Daten laden
    const user = await pb.collection("users").getOne(userId);
    if (user.mosque_id !== mosqueId) {
      return { success: false, error: "Zugriff verweigert" };
    }

    // Bezahlte Spenden des Users laden (Jahresfilter in JS,
    // da paid_at bei manuell gesetztem Status leer sein kann → PB-Filter schlägt fehl)
    const allPaid = await pb.collection("donations").getFullList({
      filter: `user_id = "${userId}" && mosque_id = "${mosqueId}" && status = "paid"`,
      sort: "paid_at",
    });

    const records = allPaid.filter((r) => {
      const dateStr = r.paid_at || r.created || "";
      if (!dateStr) return false;
      return new Date(dateStr).getFullYear() === year;
    });

    const donations = records.map((r) => ({
      id: r.id,
      amount_cents: r.amount_cents || Math.round((r.amount || 0) * 100),
      paid_at: r.paid_at || r.created || "",
      provider: r.provider || "stripe",
    }));

    const totalCents = donations.reduce((sum, d) => sum + d.amount_cents, 0);

    return {
      success: true,
      data: {
        mosque: {
          name: mosque.name || "",
          address: mosque.address || "",
          city: mosque.city || "",
        },
        donor: {
          full_name: user.full_name || `${user.first_name || ""} ${user.last_name || ""}`.trim(),
          email: user.email || "",
          membership_number: user.membership_number || user.member_no || "",
        },
        year,
        donations,
        totalCents,
      },
    };
  } catch (error) {
    console.error("[Members] Fehler Spendenbescheinigung:", error);
    return { success: false, error: "Daten konnten nicht geladen werden" };
  }
}

/**
 * Spendenbescheinigung per E-Mail an den Spender senden.
 */
export async function sendDonationReceiptByEmail(
  userId: string,
  mosqueId: string,
  year: number
): Promise<ActionResult<{ email: string }>> {
  try {
    const receiptResult = await getDonationReceiptData(userId, mosqueId, year);
    if (!receiptResult.success || !receiptResult.data) {
      return { success: false, error: receiptResult.error || "Daten nicht gefunden" };
    }
    const d = receiptResult.data;
    if (d.donations.length === 0) {
      return { success: false, error: "Keine Spenden für dieses Jahr vorhanden" };
    }
    if (!d.donor.email) {
      return { success: false, error: "Keine E-Mail-Adresse hinterlegt" };
    }

    // Branding-Farbe laden (optional)
    let accentColor: string | undefined;
    try {
      const pb = await getAdminPB();
      const settings = await pb.collection("settings").getFirstListItem(`mosque_id = "${mosqueId}"`);
      accentColor = settings.brand_primary_color || undefined;
    } catch { /* kein Branding → Default */ }

    const { renderAnnualDonationReceipt } = await import("@/lib/email/templates");
    const { sendEmailDirect } = await import("@/lib/email");

    const html = renderAnnualDonationReceipt({
      mosqueName: d.mosque.name,
      mosqueAddress: d.mosque.address,
      mosqueCity: d.mosque.city,
      donorName: d.donor.full_name,
      donorMembershipNumber: d.donor.membership_number || undefined,
      year: d.year,
      donations: d.donations,
      totalCents: d.totalCents,
      accentColor,
    });

    const result = await sendEmailDirect({
      to: d.donor.email,
      subject: `Spendenbescheinigung ${d.year} — ${d.mosque.name}`,
      html,
    });

    if (!result.success) {
      return { success: false, error: result.error || "E-Mail konnte nicht gesendet werden" };
    }

    return { success: true, data: { email: d.donor.email } };
  } catch (error) {
    console.error("[Members] Fehler beim Senden der Spendenbescheinigung:", error);
    return { success: false, error: "Unbekannter Fehler beim E-Mail-Versand" };
  }
}

// --- Mitglied löschen ---

export async function deleteMember(
  targetUserId: string,
  mosqueId: string,
  actorUserId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    if (!targetUserId || !mosqueId || !actorUserId) {
      return { success: false, error: "Ungültige Parameter" };
    }
    if (targetUserId === actorUserId) {
      return { success: false, error: "Du kannst dein eigenes Konto nicht löschen" };
    }

    const pb = await getAdminPB();

    // Tenant-Check
    const target = await pb.collection("users").getOne(targetUserId, { fields: "id,mosque_id,full_name,email" });
    if (target.mosque_id !== mosqueId) {
      return { success: false, error: "Mitglied nicht gefunden" };
    }

    await pb.collection("users").delete(targetUserId);

    await logAudit({
      mosqueId,
      userId: actorUserId,
      action: "member.deleted",
      entityType: "user",
      entityId: targetUserId,
      details: { email: target.email, full_name: target.full_name },
    });

    return { success: true };
  } catch (error) {
    console.error("[Members] Fehler beim Löschen:", error);
    return { success: false, error: "Mitglied konnte nicht gelöscht werden" };
  }
}

// --- Chart / KPI Data ---

export async function getMemberStats(mosqueId: string): Promise<{
  byStatus: { active: number; pending: number; inactive: number; blocked: number };
  byMonth: { month: string; count: number }[];
}> {
  try {
    const pb = await getAdminPB();
    const records = await pb.collection("users").getFullList({
      filter: `mosque_id = "${mosqueId}"`,
      fields: "id,created,status",
    });

    const byStatus = { active: 0, pending: 0, inactive: 0, blocked: 0 };
    records.forEach((r) => {
      const s = r.status as keyof typeof byStatus;
      if (s in byStatus) byStatus[s]++;
    });

    const monthMap = new Map<string, number>();
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 11);
    cutoff.setDate(1);
    cutoff.setHours(0, 0, 0, 0);

    records.forEach((r) => {
      const d = new Date(r.created);
      if (d >= cutoff) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthMap.set(key, (monthMap.get(key) || 0) + 1);
      }
    });

    const byMonth: { month: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      d.setDate(1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonth.push({ month: key, count: monthMap.get(key) || 0 });
    }

    return { byStatus, byMonth };
  } catch (error) {
    console.error("[Members] getMemberStats Fehler:", error);
    return {
      byStatus: { active: 0, pending: 0, inactive: 0, blocked: 0 },
      byMonth: [],
    };
  }
}
