"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { logAudit } from "@/lib/audit";
import type { Sponsor, SponsorCategory } from "@/types";
import type { RecordModel } from "pocketbase";
import Stripe from "stripe";

// --- Helper ---

function mapRecord(r: RecordModel): Sponsor {
  return {
    id: r.id,
    mosque_id: r.mosque_id || "",
    name: r.name || "",
    logo: r.logo || "",
    description: r.description || "",
    website_url: r.website_url || "",
    category: (r.category as SponsorCategory) || undefined,
    start_date: r.start_date || "",
    end_date: r.end_date || "",
    is_active: r.is_active ?? false,
    is_approved: r.is_approved ?? false,
    notification_sent: r.notification_sent ?? false,
    sort_order: r.sort_order ?? 0,
    payment_status: r.payment_status || "open",
    payment_method: r.payment_method || undefined,
    amount_cents: r.amount_cents || undefined,
    contact_user_id: r.contact_user_id || undefined,
    contact_email: r.contact_email || undefined,
    provider_ref: r.provider_ref || undefined,
    paid_at: r.paid_at || undefined,
    created: r.created || "",
    updated: r.updated || "",
  };
}

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Sichtbarkeits-Check (kanonisch) ─────────────────────────────────────────

export async function isSponsorVisible(sponsor: Sponsor): Promise<boolean> {
  if (!sponsor.is_active || !sponsor.is_approved) return false;
  const now = new Date();
  if (sponsor.start_date) {
    const start = new Date(sponsor.start_date);
    if (now < start) return false;
  }
  if (sponsor.end_date) {
    const end = new Date(sponsor.end_date);
    // end_date ist inklusiv: bis Ende des Tages
    end.setHours(23, 59, 59, 999);
    if (now > end) return false;
  }
  return true;
}

// ─── Admin: Alle Sponsoren einer Moschee ─────────────────────────────────────

export async function getSponsors(
  mosqueId: string
): Promise<ActionResult<Sponsor[]>> {
  try {
    const pb = await getAdminPB();
    const records = await pb.collection("sponsors").getFullList({
      filter: `mosque_id = "${mosqueId}"`,
      sort: "sort_order,name",
    });
    return { success: true, data: records.map(mapRecord) };
  } catch (error) {
    console.error("[sponsors] getSponsors:", error);
    return { success: false, error: "Förderpartner konnten nicht geladen werden." };
  }
}

// ─── Public: Nur sichtbare Sponsoren ─────────────────────────────────────────

export async function getActiveSponsors(
  mosqueId: string
): Promise<ActionResult<Sponsor[]>> {
  try {
    const pb = await getAdminPB();
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const records = await pb.collection("sponsors").getFullList({
      filter: `mosque_id = "${mosqueId}" && is_active = true && is_approved = true && (start_date = "" || start_date <= "${today}") && (end_date = "" || end_date >= "${today}")`,
      sort: "sort_order,name",
    });
    return { success: true, data: records.map(mapRecord) };
  } catch (error) {
    console.error("[sponsors] getActiveSponsors:", error);
    return { success: false, error: "Förderpartner konnten nicht geladen werden." };
  }
}

// ─── Admin: Sponsor erstellen ─────────────────────────────────────────────────

export interface CreateSponsorInput {
  name: string;
  description?: string;
  website_url?: string;
  category?: SponsorCategory;
  amount_cents?: number;
  sort_order?: number;
  contact_user_id?: string;
  contact_email?: string;
}

export async function createSponsor(
  mosqueId: string,
  userId: string,
  input: CreateSponsorInput
): Promise<ActionResult<Sponsor>> {
  try {
    if (!input.name?.trim()) {
      return { success: false, error: "Name ist erforderlich." };
    }
    if (input.description && input.description.length > 300) {
      return { success: false, error: "Beschreibung darf max. 300 Zeichen lang sein." };
    }

    const pb = await getAdminPB();
    const record = await pb.collection("sponsors").create({
      mosque_id: mosqueId,
      name: input.name.trim(),
      description: input.description?.trim() || "",
      website_url: input.website_url?.trim() || "",
      category: input.category || "",
      amount_cents: input.amount_cents || 0,
      sort_order: input.sort_order ?? 0,
      is_active: false,
      is_approved: false,
      notification_sent: false,
      payment_status: "open",
      contact_user_id: input.contact_user_id || "",
      contact_email: input.contact_email?.trim() || "",
      created_by: userId,
    });

    const sponsor = mapRecord(record);

    await logAudit({
      mosqueId,
      userId,
      action: "sponsor.created",
      entityType: "sponsors",
      entityId: record.id,
      after: { name: sponsor.name, category: sponsor.category },
    });

    return { success: true, data: sponsor };
  } catch (error) {
    console.error("[sponsors] createSponsor:", error);
    return { success: false, error: "Förderpartner konnte nicht erstellt werden." };
  }
}

// ─── Admin: Sponsor aktualisieren ────────────────────────────────────────────

export interface UpdateSponsorInput {
  name?: string;
  description?: string;
  website_url?: string;
  category?: SponsorCategory | "";
  amount_cents?: number;
  sort_order?: number;
  end_date?: string;
  contact_user_id?: string;
  contact_email?: string;
}

export async function updateSponsor(
  mosqueId: string,
  userId: string,
  sponsorId: string,
  input: UpdateSponsorInput
): Promise<ActionResult<Sponsor>> {
  try {
    if (input.description && input.description.length > 300) {
      return { success: false, error: "Beschreibung darf max. 300 Zeichen lang sein." };
    }

    const pb = await getAdminPB();

    // Alten Zustand für Audit laden
    const existing = await pb.collection("sponsors").getOne(sponsorId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Nicht gefunden." };
    }

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.description !== undefined) updateData.description = input.description.trim();
    if (input.website_url !== undefined) updateData.website_url = input.website_url.trim();
    if (input.category !== undefined) updateData.category = input.category;
    if (input.amount_cents !== undefined) updateData.amount_cents = input.amount_cents;
    if (input.sort_order !== undefined) updateData.sort_order = input.sort_order;
    if (input.contact_user_id !== undefined) updateData.contact_user_id = input.contact_user_id;
    if (input.contact_email !== undefined) updateData.contact_email = input.contact_email.trim();

    // Bei Verlängerung: notification_sent zurücksetzen
    if (input.end_date !== undefined) {
      updateData.end_date = input.end_date;
      if (input.end_date !== existing.end_date) {
        updateData.notification_sent = false;
      }
    }

    const record = await pb.collection("sponsors").update(sponsorId, updateData);
    const sponsor = mapRecord(record);

    await logAudit({
      mosqueId,
      userId,
      action: "sponsor.updated",
      entityType: "sponsors",
      entityId: sponsorId,
      before: { name: existing.name, end_date: existing.end_date },
      after: { name: sponsor.name, end_date: sponsor.end_date },
    });

    return { success: true, data: sponsor };
  } catch (error) {
    console.error("[sponsors] updateSponsor:", error);
    return { success: false, error: "Förderpartner konnte nicht aktualisiert werden." };
  }
}

// ─── Admin: Sponsor löschen ────────────────────────────────────────────────

export async function deleteSponsor(
  mosqueId: string,
  userId: string,
  sponsorId: string
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();

    const existing = await pb.collection("sponsors").getOne(sponsorId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Nicht gefunden." };
    }

    await pb.collection("sponsors").delete(sponsorId);

    await logAudit({
      mosqueId,
      userId,
      action: "sponsor.deleted",
      entityType: "sponsors",
      entityId: sponsorId,
      before: { name: existing.name },
    });

    return { success: true };
  } catch (error) {
    console.error("[sponsors] deleteSponsor:", error);
    return { success: false, error: "Förderpartner konnte nicht gelöscht werden." };
  }
}

// ─── Admin: Freigeben ─────────────────────────────────────────────────────────

export async function approveSponsor(
  mosqueId: string,
  userId: string,
  sponsorId: string,
  approved: boolean
): Promise<ActionResult<Sponsor>> {
  try {
    const pb = await getAdminPB();

    const existing = await pb.collection("sponsors").getOne(sponsorId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Nicht gefunden." };
    }

    const record = await pb.collection("sponsors").update(sponsorId, {
      is_approved: approved,
    });

    await logAudit({
      mosqueId,
      userId,
      action: approved ? "sponsor.approved" : "sponsor.unapproved",
      entityType: "sponsors",
      entityId: sponsorId,
      after: { name: existing.name, is_approved: approved },
    });

    return { success: true, data: mapRecord(record) };
  } catch (error) {
    console.error("[sponsors] approveSponsor:", error);
    return { success: false, error: "Freigabe konnte nicht gespeichert werden." };
  }
}

// ─── Admin: Aktivieren/Deaktivieren ──────────────────────────────────────────

export async function toggleSponsorActive(
  mosqueId: string,
  userId: string,
  sponsorId: string,
  active: boolean
): Promise<ActionResult<Sponsor>> {
  try {
    const pb = await getAdminPB();

    const existing = await pb.collection("sponsors").getOne(sponsorId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Nicht gefunden." };
    }

    const record = await pb.collection("sponsors").update(sponsorId, {
      is_active: active,
      is_approved: active,
    });

    await logAudit({
      mosqueId,
      userId,
      action: active ? "sponsor.activated" : "sponsor.deactivated",
      entityType: "sponsors",
      entityId: sponsorId,
      after: { name: existing.name, is_active: active, is_approved: active },
    });

    return { success: true, data: mapRecord(record) };
  } catch (error) {
    console.error("[sponsors] toggleSponsorActive:", error);
    return { success: false, error: "Status konnte nicht geändert werden." };
  }
}

// ─── Admin: Als bezahlt markieren (Bar / Überweisung) ────────────────────────

export async function markSponsorPaid(
  mosqueId: string,
  userId: string,
  sponsorId: string,
  method: "cash" | "transfer",
  durationMonths: number
): Promise<ActionResult<Sponsor>> {
  try {
    if (durationMonths < 1 || durationMonths > 120) {
      return { success: false, error: "Ungültige Laufzeit." };
    }

    const pb = await getAdminPB();

    const existing = await pb.collection("sponsors").getOne(sponsorId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Nicht gefunden." };
    }

    const startDate = new Date();
    // end_date immer auf letzten Tag des Endmonats setzen
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + durationMonths + 1, 0);

    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    const record = await pb.collection("sponsors").update(sponsorId, {
      payment_status: "paid",
      payment_method: method,
      start_date: startStr,
      end_date: endStr,
      paid_at: new Date().toISOString(),
      is_active: true,
      // notification_sent bleibt false (neue Laufzeit → neue Erinnerung möglich)
      notification_sent: false,
    });

    await logAudit({
      mosqueId,
      userId,
      action: "sponsor.marked_paid",
      entityType: "sponsors",
      entityId: sponsorId,
      after: {
        name: existing.name,
        payment_method: method,
        start_date: startStr,
        end_date: endStr,
        duration_months: durationMonths,
      },
    });

    return { success: true, data: mapRecord(record) };
  } catch (error) {
    console.error("[sponsors] markSponsorPaid:", error);
    return { success: false, error: "Zahlung konnte nicht gespeichert werden." };
  }
}

// ─── Admin: Logo hochladen ────────────────────────────────────────────────────

export async function uploadSponsorLogo(
  mosqueId: string,
  userId: string,
  sponsorId: string,
  formData: FormData
): Promise<ActionResult<Sponsor>> {
  try {
    const pb = await getAdminPB();

    const existing = await pb.collection("sponsors").getOne(sponsorId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Nicht gefunden." };
    }

    const record = await pb.collection("sponsors").update(sponsorId, formData);

    return { success: true, data: mapRecord(record) };
  } catch (error) {
    console.error("[sponsors] uploadSponsorLogo:", error);
    return { success: false, error: "Logo konnte nicht hochgeladen werden." };
  }
}

// ─── Cron: Ablaufende Sponsoren prüfen (interner Aufruf) ─────────────────────
// Wird am 21. jedes Monats aufgerufen. Findet Sponsoren deren end_date
// im aktuellen Monat liegt (= am Monatsende abläuft).

export async function checkExpiringSponsors(mosqueId: string): Promise<{
  expiring: Sponsor[];
}> {
  const pb = await getAdminPB();

  // Sponsoren deren end_date im aktuellen Monat liegt und noch keine Erinnerung erhalten haben
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const records = await pb.collection("sponsors").getFullList({
    filter: `mosque_id = "${mosqueId}" && is_active = true && notification_sent = false && end_date >= "${firstOfMonth}" && end_date <= "${lastOfMonth}"`,
  });

  return { expiring: records.map(mapRecord) };
}

export async function markSponsorNotificationSent(
  sponsorId: string
): Promise<void> {
  const pb = await getAdminPB();
  await pb.collection("sponsors").update(sponsorId, { notification_sent: true });
}

// ─── Mitglied: Eigene Sponsoren laden (als Kontakt verlinkt) ─────────────────

export async function getSponsorsByContact(
  mosqueId: string,
  userId: string
): Promise<ActionResult<Sponsor[]>> {
  try {
    const pb = await getAdminPB();
    const records = await pb.collection("sponsors").getFullList({
      filter: `mosque_id = "${mosqueId}" && contact_user_id = "${userId}"`,
      sort: "-created",
    });
    return { success: true, data: records.map(mapRecord) };
  } catch (error) {
    console.error("[sponsors] getSponsorsByContact:", error);
    return { success: false, error: "Förderpartner konnten nicht geladen werden." };
  }
}

// ─── Mitglied: Stripe-Checkout für Förderpartner-Zahlung ─────────────────────

export async function createSponsorStripeCheckout(
  mosqueId: string,
  userId: string,
  sponsorId: string,
  baseUrl: string
): Promise<ActionResult<{ checkout_url: string }>> {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return { success: false, error: "Stripe ist nicht konfiguriert." };
    }

    const pb = await getAdminPB();
    const sponsorRecord = await pb.collection("sponsors").getOne(sponsorId);

    if (sponsorRecord.mosque_id !== mosqueId) {
      return { success: false, error: "Nicht gefunden." };
    }
    if (sponsorRecord.contact_user_id !== userId) {
      return { success: false, error: "Nicht berechtigt." };
    }
    if (sponsorRecord.payment_status !== "open") {
      return { success: false, error: "Dieser Beitrag wurde bereits bezahlt." };
    }
    if (!sponsorRecord.amount_cents || sponsorRecord.amount_cents <= 0) {
      return { success: false, error: "Kein Betrag hinterlegt." };
    }

    // Kontakt-E-Mail ermitteln
    let contactEmail: string | undefined;
    try {
      const user = await pb.collection("users").getOne(userId, { fields: "email" });
      contactEmail = user.email || undefined;
    } catch { /* E-Mail nicht verfügbar */ }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: contactEmail,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: sponsorRecord.name,
              description: "Förderpartner-Beitrag",
            },
            unit_amount: sponsorRecord.amount_cents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        mosque_id: mosqueId,
        sponsor_id: sponsorId,
        payment_type: "sponsor",
        contact_user_id: userId,
      },
      success_url: `${baseUrl}/member/profile?sponsor_paid=true`,
      cancel_url: `${baseUrl}/member/profile`,
    });

    // Session-ID speichern
    await pb.collection("sponsors").update(sponsorId, { provider_ref: session.id });

    return { success: true, data: { checkout_url: session.url || "" } };
  } catch (error) {
    console.error("[sponsors] createSponsorStripeCheckout:", error);
    return { success: false, error: "Zahlung konnte nicht gestartet werden." };
  }
}
