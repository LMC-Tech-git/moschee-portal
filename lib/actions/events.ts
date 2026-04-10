"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { eventSchema, type EventInput } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { sendEmailDirect } from "@/lib/email";
import { renderEventConfirmation } from "@/lib/email/templates";
import type { Event, EventRegistration } from "@/types";
import type { RecordModel } from "pocketbase";
import { checkDemoLimit } from "@/lib/demo";
import Stripe from "stripe";

// --- Helpers ---

function mapRecordToEvent(record: RecordModel): Event {
  return {
    id: record.id,
    mosque_id: record.mosque_id || "",
    title: record.title || "",
    description: record.description || "",
    category: record.category || "other",
    location_name: record.location_name || "",
    start_at: record.start_at || "",
    start_prayer: record.start_prayer || "",
    end_at: record.end_at || "",
    duration_minutes: record.duration_minutes || 0,
    visibility: record.visibility || "public",
    capacity: record.capacity || 0,
    status: record.status || "draft",
    cover_image: record.cover_image || "",
    created_by: record.created_by || "",
    created: record.created || "",
    updated: record.updated || "",
    is_recurring: record.is_recurring || false,
    recurrence_type: record.recurrence_type || "",
    recurrence_day_of_week: record.recurrence_day_of_week || "",
    recurrence_day_of_month: record.recurrence_day_of_month || 0,
    recurrence_end_date: record.recurrence_end_date || "",
    is_paid: record.is_paid || false,
    price_cents: record.price_cents || 0,
  };
}

// --- Server Actions ---

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Alle Events einer Moschee laden (Admin).
 */
export async function getEventsByMosque(
  mosqueId: string,
  options?: { status?: "published" | "cancelled" | "draft"; upcoming?: boolean; page?: number; limit?: number }
): Promise<ActionResult<Event[]> & { totalPages?: number; page?: number }> {
  try {
    const pb = await getAdminPB();
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    let filter = `mosque_id = "${mosqueId}"`;
    if (options?.status) {
      filter += ` && status = "${options.status}"`;
    }
    if (options?.upcoming) {
      filter += ` && start_at >= "${new Date().toISOString()}"`;
    }

    const records = await pb.collection("events").getList(page, limit, {
      filter,
      sort: "start_at",
    });

    return {
      success: true,
      data: records.items.map(mapRecordToEvent),
      totalPages: records.totalPages,
      page: records.page,
    };
  } catch (error) {
    console.error("[Events] Fehler beim Laden:", error);
    return { success: false, error: "Veranstaltungen konnten nicht geladen werden" };
  }
}

/**
 * Öffentliche kommende Events einer Moschee laden (nur visibility = "public").
 * Für nicht-eingeloggte Besucher.
 */
export async function getPublicUpcomingEvents(
  mosqueId: string,
  limit = 5
): Promise<ActionResult<Event[]>> {
  try {
    const pb = await getAdminPB();

    const records = await pb.collection("events").getList(1, limit, {
      filter: `mosque_id = "${mosqueId}" && status = "published" && visibility = "public" && (end_at = "" || end_at >= "${new Date().toISOString()}")`,
      sort: "start_at",
    });

    return {
      success: true,
      data: records.items.map(mapRecordToEvent),
    };
  } catch (error) {
    console.error("[Events] Fehler beim Laden:", error);
    return { success: false, error: "Veranstaltungen konnten nicht geladen werden" };
  }
}

/**
 * Alle kommenden Events für eingeloggte Mitglieder (public + members).
 */
export async function getMemberUpcomingEvents(
  mosqueId: string,
  limit = 50
): Promise<ActionResult<Event[]>> {
  try {
    const pb = await getAdminPB();

    const records = await pb.collection("events").getList(1, limit, {
      filter: `mosque_id = "${mosqueId}" && status = "published" && (end_at = "" || end_at >= "${new Date().toISOString()}")`,
      sort: "start_at",
    });

    return {
      success: true,
      data: records.items.map(mapRecordToEvent),
    };
  } catch (error) {
    console.error("[Events] Fehler beim Laden:", error);
    return { success: false, error: "Veranstaltungen konnten nicht geladen werden" };
  }
}

/**
 * Alle publizierten Events einer Moschee laden (öffentlich).
 * Zeigt zukünftige UND vergangene Events, sortiert nach Datum absteigend.
 */
export async function getPublicPublishedEvents(
  mosqueId: string,
  limit = 50
): Promise<ActionResult<Event[]>> {
  try {
    const pb = await getAdminPB();

    const records = await pb.collection("events").getList(1, limit, {
      filter: `mosque_id = "${mosqueId}" && status = "published" && visibility = "public"`,
      sort: "-start_at",
    });

    return {
      success: true,
      data: records.items.map(mapRecordToEvent),
    };
  } catch (error) {
    console.error("[Events] Fehler beim Laden:", error);
    return { success: false, error: "Veranstaltungen konnten nicht geladen werden" };
  }
}

/**
 * Alle publizierten Events für eingeloggte Mitglieder (public + members).
 * Zeigt zukünftige UND vergangene Events, sortiert nach Datum absteigend.
 */
export async function getMemberPublishedEvents(
  mosqueId: string,
  limit = 50
): Promise<ActionResult<Event[]>> {
  try {
    const pb = await getAdminPB();

    const records = await pb.collection("events").getList(1, limit, {
      filter: `mosque_id = "${mosqueId}" && status = "published"`,
      sort: "-start_at",
    });

    return {
      success: true,
      data: records.items.map(mapRecordToEvent),
    };
  } catch (error) {
    console.error("[Events] Fehler beim Laden:", error);
    return { success: false, error: "Veranstaltungen konnten nicht geladen werden" };
  }
}

/**
 * Alle publizierten Events öffentlich gefiltert nach Kategorie.
 */
export async function getPublicEventsFiltered(
  mosqueId: string,
  options?: { category?: string; limit?: number }
): Promise<ActionResult<Event[]>> {
  try {
    const pb = await getAdminPB();
    const limit = options?.limit || 100;

    let filter = `mosque_id = "${mosqueId}" && status = "published" && visibility = "public"`;
    if (options?.category) {
      filter += ` && category = "${options.category}"`;
    }

    const records = await pb.collection("events").getList(1, limit, {
      filter,
      sort: "-start_at",
    });

    return { success: true, data: records.items.map(mapRecordToEvent) };
  } catch (error) {
    console.error("[Events] Fehler beim Laden (gefiltert):", error);
    return { success: false, error: "Veranstaltungen konnten nicht geladen werden" };
  }
}

/**
 * Alle publizierten Events für Mitglieder gefiltert nach Kategorie.
 */
export async function getMemberEventsFiltered(
  mosqueId: string,
  options?: { category?: string; limit?: number }
): Promise<ActionResult<Event[]>> {
  try {
    const pb = await getAdminPB();
    const limit = options?.limit || 100;

    let filter = `mosque_id = "${mosqueId}" && status = "published"`;
    if (options?.category) {
      filter += ` && category = "${options.category}"`;
    }

    const records = await pb.collection("events").getList(1, limit, {
      filter,
      sort: "-start_at",
    });

    return { success: true, data: records.items.map(mapRecordToEvent) };
  } catch (error) {
    console.error("[Events] Fehler beim Laden (Member gefiltert):", error);
    return { success: false, error: "Veranstaltungen konnten nicht geladen werden" };
  }
}

/**
 * Einzelnes Event laden.
 */
export async function getEventById(
  eventId: string,
  mosqueId: string
): Promise<ActionResult<Event>> {
  try {
    const pb = await getAdminPB();
    const record = await pb.collection("events").getOne(eventId);

    if (record.mosque_id !== mosqueId) {
      return { success: false, error: "Veranstaltung nicht gefunden" };
    }

    return { success: true, data: mapRecordToEvent(record) };
  } catch (error) {
    console.error("[Events] Fehler beim Laden:", error);
    return { success: false, error: "Veranstaltung konnte nicht geladen werden" };
  }
}

/**
 * Neues Event erstellen.
 */
export async function createEvent(
  mosqueId: string,
  userId: string,
  input: EventInput
): Promise<ActionResult<Event>> {
  try {
    const validated = eventSchema.parse(input);
    const pb = await getAdminPB();

    const demoCheck = await checkDemoLimit(mosqueId, "events");
    if (!demoCheck.allowed) return { success: false, error: demoCheck.error };

    const record = await pb.collection("events").create({
      ...validated,
      mosque_id: mosqueId,
      created_by: userId,
    });

    await logAudit({
      mosqueId,
      userId,
      action: "event.created",
      entityType: "event",
      entityId: record.id,
      details: { title: validated.title },
    });

    return { success: true, data: mapRecordToEvent(record) };
  } catch (error) {
    console.error("[Events] Fehler beim Erstellen:", error);
    return { success: false, error: "Veranstaltung konnte nicht erstellt werden" };
  }
}

/**
 * Event aktualisieren.
 */
export async function updateEvent(
  eventId: string,
  mosqueId: string,
  userId: string,
  input: EventInput
): Promise<ActionResult<Event>> {
  try {
    const validated = eventSchema.parse(input);
    const pb = await getAdminPB();

    const existing = await pb.collection("events").getOne(eventId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Veranstaltung nicht gefunden" };
    }

    const record = await pb.collection("events").update(eventId, validated);

    await logAudit({
      mosqueId,
      userId,
      action: "event.updated",
      entityType: "event",
      entityId: eventId,
      details: { title: validated.title },
    });

    return { success: true, data: mapRecordToEvent(record) };
  } catch (error) {
    console.error("[Events] Fehler beim Aktualisieren:", error);
    return { success: false, error: "Veranstaltung konnte nicht aktualisiert werden" };
  }
}

/**
 * Event löschen.
 */
export async function deleteEvent(
  eventId: string,
  mosqueId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();

    const existing = await pb.collection("events").getOne(eventId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Veranstaltung nicht gefunden" };
    }

    await pb.collection("events").delete(eventId);

    await logAudit({
      mosqueId,
      userId,
      action: "event.deleted",
      entityType: "event",
      entityId: eventId,
      details: { title: existing.title },
    });

    return { success: true };
  } catch (error) {
    console.error("[Events] Fehler beim Löschen:", error);
    return { success: false, error: "Veranstaltung konnte nicht gelöscht werden" };
  }
}

/**
 * Registrierungsanzahl für ein Event zählen.
 */
export async function getEventRegistrationCount(
  eventId: string
): Promise<number> {
  try {
    const pb = await getAdminPB();
    const result = await pb.collection("event_registrations").getList(1, 1, {
      filter: `event_id = "${eventId}" && status = "registered"`,
    });
    return result.totalItems;
  } catch {
    return 0;
  }
}

/**
 * Registrierungsanzahl für mehrere Events auf einmal laden.
 * Gibt eine Map eventId → Anzahl zurück.
 */
export async function getRegistrationCountsForEvents(
  eventIds: string[]
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (eventIds.length === 0) return counts;

  try {
    const pb = await getAdminPB();

    // Sequenziell laden (PB-Singleton verträgt keine parallelen Requests gut)
    for (let i = 0; i < eventIds.length; i++) {
      const eid = eventIds[i];
      try {
        const result = await pb.collection("event_registrations").getList(1, 1, {
          filter: `event_id = "${eid}" && status = "registered"`,
          fields: "id",
        });
        counts[eid] = result.totalItems;
      } catch {
        counts[eid] = 0;
      }
    }
  } catch {
    // Fallback: alle 0
    eventIds.forEach((eid) => { counts[eid] = 0; });
  }

  return counts;
}

/**
 * Gast-Registrierung für ein Event.
 * Server-seitig: IP-Hash und User-Agent werden hier gesetzt.
 */
export async function registerGuestForEvent(
  mosqueId: string,
  eventId: string,
  guestName: string,
  guestEmail: string,
  ipHash: string,
  userAgent: string
): Promise<ActionResult<EventRegistration>> {
  try {
    const pb = await getAdminPB();

    // Event prüfen
    const event = await pb.collection("events").getOne(eventId);
    if (event.mosque_id !== mosqueId || event.status !== "published") {
      return { success: false, error: "Veranstaltung nicht verfügbar" };
    }

    // Kapazität prüfen
    if (event.capacity > 0) {
      const regCount = await getEventRegistrationCount(eventId);
      if (regCount >= event.capacity) {
        return { success: false, error: "Veranstaltung ist ausgebucht" };
      }
    }

    // Doppelte Registrierung prüfen
    try {
      await pb.collection("event_registrations").getFirstListItem(
        `event_id = "${eventId}" && guest_email = "${guestEmail}" && status = "registered"`
      );
      return { success: false, error: "Sie sind bereits für diese Veranstaltung registriert" };
    } catch {
      // Keine doppelte Registrierung gefunden — gut
    }

    // Verify-Token generieren
    const verifyToken = crypto.randomUUID();

    const record = await pb.collection("event_registrations").create({
      mosque_id: mosqueId,
      event_id: eventId,
      registrant_type: "guest",
      guest_name: guestName,
      guest_email: guestEmail,
      status: "registered",
      registered_at: new Date().toISOString(),
      verify_token: verifyToken,
      source_ip_hash: ipHash,
      user_agent: userAgent,
    });

    const registration: EventRegistration = {
      id: record.id,
      mosque_id: record.mosque_id,
      event_id: record.event_id,
      registrant_type: record.registrant_type,
      user_id: record.user_id || "",
      guest_name: record.guest_name || "",
      guest_email: record.guest_email || "",
      status: record.status,
      registered_at: record.registered_at || "",
      cancelled_at: record.cancelled_at || "",
      verify_token: record.verify_token || "",
      verified_at: record.verified_at || "",
      source_ip_hash: record.source_ip_hash || "",
      user_agent: record.user_agent || "",
      created: record.created || "",
      updated: record.updated || "",
    };

    logAudit({
      mosqueId,
      action: "event_registration.guest_created",
      entityType: "event_registration",
      entityId: record.id,
      details: { event_id: eventId, guest_email: guestEmail },
    });

    return { success: true, data: registration };
  } catch (error) {
    console.error("[Events] Fehler bei Gast-Registrierung:", error);
    return { success: false, error: "Registrierung fehlgeschlagen" };
  }
}

/**
 * Alle Registrierungen für ein Event laden (Admin).
 */
export async function getEventRegistrations(
  eventId: string,
  mosqueId: string
): Promise<ActionResult<EventRegistration[]>> {
  try {
    const pb = await getAdminPB();

    // Event prüfen (Tenant-Check)
    const event = await pb.collection("events").getOne(eventId);
    if (event.mosque_id !== mosqueId) {
      return { success: false, error: "Veranstaltung nicht gefunden" };
    }

    const records = await pb
      .collection("event_registrations")
      .getFullList({
        filter: `event_id = "${eventId}"`,
        sort: "-created",
      });

    const registrations: EventRegistration[] = records.map((record) => ({
      id: record.id,
      mosque_id: record.mosque_id || "",
      event_id: record.event_id || "",
      registrant_type: record.registrant_type || "guest",
      user_id: record.user_id || "",
      guest_name: record.guest_name || "",
      guest_email: record.guest_email || "",
      status: record.status || "registered",
      registered_at: record.registered_at || record.created || "",
      cancelled_at: record.cancelled_at || "",
      verify_token: record.verify_token || "",
      verified_at: record.verified_at || "",
      source_ip_hash: record.source_ip_hash || "",
      user_agent: record.user_agent || "",
      created: record.created || "",
      updated: record.updated || "",
      // Zahlungsfelder
      payment_status: record.payment_status || undefined,
      payment_method: record.payment_method || undefined,
      original_payment_method: record.original_payment_method || undefined,
      payment_ref: record.payment_ref || undefined,
      checkout_url: record.checkout_url || undefined,
      expires_at: record.expires_at || undefined,
      paid_at: record.paid_at || undefined,
      cancel_reason: record.cancel_reason || undefined,
    }));

    // Mitglieds-Namen und E-Mails nachladen
    const memberUserIds = Array.from(
      new Set(
        registrations
          .filter((r) => r.registrant_type === "member" && r.user_id)
          .map((r) => r.user_id)
      )
    );
    if (memberUserIds.length > 0) {
      try {
        const userFilter = memberUserIds.map((id) => `id = "${id}"`).join(" || ");
        const users = await pb.collection("users").getFullList({
          filter: userFilter,
          fields: "id,first_name,last_name,email",
        });
        const userMap = new Map(users.map((u) => [u.id, u]));
        registrations.forEach((r) => {
          if (r.registrant_type === "member" && r.user_id) {
            const u = userMap.get(r.user_id);
            if (u) {
              r.member_name =
                [u.first_name, u.last_name].filter(Boolean).join(" ") ||
                u.email ||
                "";
              r.member_email = u.email || "";
            }
          }
        });
      } catch {
        // Fehler beim User-Lookup ignorieren — Fallback auf "Mitglied"
      }
    }

    return { success: true, data: registrations };
  } catch (error) {
    console.error("[Events] Fehler beim Laden der Registrierungen:", error);
    return {
      success: false,
      error: "Registrierungen konnten nicht geladen werden",
    };
  }
}

/**
 * Exportiert alle Registrierungen eines Events als CSV-String.
 */
export async function exportRegistrationsCSV(
  eventId: string,
  mosqueId: string
): Promise<ActionResult<string>> {
  try {
    const result = await getEventRegistrations(eventId, mosqueId);
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const registrations = result.data;

    // CSV Header
    const header = [
      "Name",
      "E-Mail",
      "Typ",
      "Status",
      "Zahlung",
      "Zahlungsmethode",
      "Abbruchgrund",
      "Bezahlt am",
      "Registriert am",
    ].join(";");

    const STATUS_LABELS: Record<string, string> = {
      registered: "Registriert",
      attended: "Teilgenommen",
      cancelled: "Storniert",
      no_show: "Nicht erschienen",
      pending: "Ausstehend",
      expired: "Abgelaufen",
    };
    const PAYMENT_STATUS_LABELS: Record<string, string> = {
      free: "Kostenlos",
      pending: "Ausstehend",
      pending_sepa: "SEPA läuft",
      paid: "Bezahlt",
      expired: "Abgelaufen",
      failed: "Fehlgeschlagen",
    };
    const PAYMENT_METHOD_LABELS: Record<string, string> = {
      card: "Karte",
      sepa: "SEPA",
      cash: "Bar",
    };

    // CSV Rows
    const rows = registrations.map((reg) => {
      const name =
        reg.registrant_type === "guest"
          ? reg.guest_name
          : reg.member_name || "Mitglied";
      const email =
        reg.registrant_type === "guest"
          ? reg.guest_email
          : reg.member_email || "";
      const typ = reg.registrant_type === "guest" ? "Gast" : "Mitglied";
      const status = STATUS_LABELS[reg.status] ?? reg.status;
      const paymentStatus = reg.payment_status
        ? (PAYMENT_STATUS_LABELS[reg.payment_status] ?? reg.payment_status)
        : "";
      const paymentMethod = reg.payment_method
        ? (PAYMENT_METHOD_LABELS[reg.payment_method] ?? reg.payment_method)
        : "";
      const cancelReason = reg.cancel_reason || "";
      const paidAt = reg.paid_at
        ? new Date(reg.paid_at).toLocaleString("de-DE")
        : "";
      const registeredAt = reg.registered_at
        ? new Date(reg.registered_at).toLocaleString("de-DE")
        : "";

      return [name, email, typ, status, paymentStatus, paymentMethod, cancelReason, paidAt, registeredAt]
        .map((v) => `"${(v ?? "").replace(/"/g, '""')}"`)
        .join(";");
    });

    const csv = [header, ...rows].join("\n");
    return { success: true, data: csv };
  } catch (error) {
    console.error("[Events] CSV-Export Fehler:", error);
    return { success: false, error: "CSV-Export fehlgeschlagen" };
  }
}

/**
 * 1-Klick Mitglieder-Anmeldung für ein Event.
 * Bei bezahlten Events: gibt checkoutUrl zurück statt direkt zu registrieren.
 */
export async function registerMemberForEvent(
  mosqueId: string,
  eventId: string,
  userId: string,
  slug?: string,
  baseUrl?: string
): Promise<ActionResult<EventRegistration> & { checkoutUrl?: string }> {
  try {
    const pb = await getAdminPB();

    // Event prüfen
    const event = await pb.collection("events").getOne(eventId);
    if (event.mosque_id !== mosqueId || event.status !== "published") {
      return { success: false, error: "Veranstaltung nicht verfügbar" };
    }

    // Bezahltes Event → Stripe Checkout
    if (event.is_paid && event.price_cents >= 50) {
      if (!slug || !baseUrl) {
        return { success: false, error: "Konfigurationsfehler: slug/baseUrl fehlen" };
      }
      const checkoutResult = await createEventStripeCheckout(mosqueId, userId, eventId, slug, baseUrl);
      if (!checkoutResult.success || !checkoutResult.checkoutUrl) {
        return { success: false, error: checkoutResult.error || "Checkout fehlgeschlagen" };
      }
      return { success: true, checkoutUrl: checkoutResult.checkoutUrl };
    }

    // Kapazität prüfen (kostenlose Events)
    if (event.capacity > 0) {
      const regCount = await getEventRegistrationCount(eventId);
      if (regCount >= event.capacity) {
        return { success: false, error: "Veranstaltung ist ausgebucht" };
      }
    }

    // Doppelte Registrierung prüfen
    try {
      await pb.collection("event_registrations").getFirstListItem(
        `event_id = "${eventId}" && user_id = "${userId}" && status = "registered"`
      );
      return {
        success: false,
        error: "Sie sind bereits für diese Veranstaltung angemeldet",
      };
    } catch {
      // Keine doppelte Registrierung — gut
    }

    const record = await pb.collection("event_registrations").create({
      mosque_id: mosqueId,
      event_id: eventId,
      registrant_type: "member",
      user_id: userId,
      status: "registered",
      payment_status: "free",
      registered_at: new Date().toISOString(),
    });

    const registration: EventRegistration = {
      id: record.id,
      mosque_id: record.mosque_id,
      event_id: record.event_id,
      registrant_type: record.registrant_type,
      user_id: record.user_id || "",
      guest_name: "",
      guest_email: "",
      status: record.status,
      registered_at: record.registered_at || "",
      cancelled_at: "",
      verify_token: "",
      verified_at: "",
      source_ip_hash: "",
      user_agent: "",
      created: record.created || "",
      updated: record.updated || "",
    };

    logAudit({
      mosqueId,
      userId,
      action: "event_registration.member_created",
      entityType: "event_registration",
      entityId: record.id,
      details: { event_id: eventId },
    });

    // E-Mail-Bestätigung senden (asynchron, Fehler nicht werfen)
    try {
      const [userRecord, mosqueRecord] = await Promise.all([
        pb.collection("users").getOne(userId, { fields: "email,first_name,last_name,name" }),
        pb.collection("mosques").getOne(mosqueId, { fields: "name,brand_primary_color" }),
      ]);

      if (userRecord.email) {
        const eventDate = event.start_at
          ? new Date(event.start_at).toLocaleDateString("de-DE", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })
          : "";
        const recipientName =
          userRecord.first_name || userRecord.name || undefined;

        const html = renderEventConfirmation({
          mosqueName: mosqueRecord.name,
          eventTitle: event.title,
          eventDate,
          eventLocation: event.location_name || undefined,
          registrantName: recipientName,
          accentColor: mosqueRecord.brand_primary_color || undefined,
        });

        sendEmailDirect({
          to: userRecord.email,
          subject: `Anmeldung bestätigt: ${event.title}`,
          html,
        }).catch((e) => console.error("[Events] Bestätigungsmail fehlgeschlagen:", e));
      }
    } catch (emailErr) {
      console.error("[Events] Fehler beim Laden der Bestätigungsdaten:", emailErr);
    }

    return { success: true, data: registration };
  } catch (error) {
    console.error("[Events] Fehler bei Mitglieder-Registrierung:", error);
    return { success: false, error: "Anmeldung fehlgeschlagen" };
  }
}

/**
 * Mitglieder-Abmeldung von einem Event.
 */
export async function cancelMemberRegistration(
  eventId: string,
  userId: string,
  mosqueId: string
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();

    const reg = await pb.collection("event_registrations").getFirstListItem(
      `event_id = "${eventId}" && user_id = "${userId}" && mosque_id = "${mosqueId}" && status = "registered"`
    );

    await pb.collection("event_registrations").update(reg.id, {
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    });

    logAudit({
      mosqueId,
      userId,
      action: "event_registration.cancelled",
      entityType: "event_registration",
      entityId: reg.id,
      details: { event_id: eventId },
    });

    return { success: true };
  } catch {
    return { success: false, error: "Abmeldung fehlgeschlagen" };
  }
}

/**
 * Prüft ob ein Mitglied bereits für ein Event registriert ist.
 */
export async function isMemberRegistered(
  eventId: string,
  userId: string
): Promise<boolean> {
  try {
    const pb = await getAdminPB();
    await pb.collection("event_registrations").getFirstListItem(
      `event_id = "${eventId}" && user_id = "${userId}" && status = "registered"`
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Registrierungsstatus eines Mitglieds für ein Event (inkl. payment_status).
 */
export async function getMemberRegistrationStatus(
  eventId: string,
  userId: string
): Promise<{ registered: boolean; registration?: EventRegistration }> {
  try {
    const pb = await getAdminPB();
    const record = await pb.collection("event_registrations").getFirstListItem(
      `event_id = "${eventId}" && user_id = "${userId}" && status != "cancelled" && status != "expired"`
    );
    return {
      registered: true,
      registration: {
        id: record.id,
        mosque_id: record.mosque_id,
        event_id: record.event_id,
        registrant_type: record.registrant_type,
        user_id: record.user_id || "",
        guest_name: "",
        guest_email: "",
        status: record.status,
        registered_at: record.registered_at || "",
        cancelled_at: "",
        verify_token: "",
        verified_at: "",
        source_ip_hash: "",
        user_agent: "",
        created: record.created || "",
        updated: record.updated || "",
        payment_status: record.payment_status || undefined,
        payment_method: record.payment_method || undefined,
        checkout_url: record.checkout_url || undefined,
        expires_at: record.expires_at || undefined,
        paid_at: record.paid_at || undefined,
        cancel_reason: record.cancel_reason || undefined,
      },
    };
  } catch {
    return { registered: false };
  }
}

// ─── Kapazitätsprüfung für bezahlte Events ────────────────────────────────────

/**
 * Zählt belegte Plätze für bezahlte Events:
 * - status = "registered" (paid + free)
 * - status = "pending" AND payment_method = "cash"
 * - payment_status = "pending_sepa"
 */
async function getPaidEventOccupancy(pb: Awaited<ReturnType<typeof getAdminPB>>, eventId: string): Promise<number> {
  const [confirmed, cashPending, sepa] = await Promise.all([
    pb.collection("event_registrations").getList(1, 1, {
      filter: `event_id = "${eventId}" && status = "registered"`,
      fields: "id",
    }),
    pb.collection("event_registrations").getList(1, 1, {
      filter: `event_id = "${eventId}" && status = "pending" && payment_method = "cash"`,
      fields: "id",
    }),
    pb.collection("event_registrations").getList(1, 1, {
      filter: `event_id = "${eventId}" && payment_status = "pending_sepa"`,
      fields: "id",
    }),
  ]);
  return confirmed.totalItems + cashPending.totalItems + sepa.totalItems;
}

// ─── Pending-Registrierungen ablaufen lassen ──────────────────────────────────

/**
 * Setzt abgelaufene pending-Registrierungen (nur card, nicht cash) auf expired.
 * Limit: 50 Records pro Aufruf.
 */
export async function expirePendingRegistrations(eventId?: string): Promise<void> {
  try {
    const pb = await getAdminPB();
    const now = new Date().toISOString();
    let filter = `payment_status = "pending" && payment_method != "cash" && expires_at != "" && expires_at < "${now}"`;
    if (eventId) filter += ` && event_id = "${eventId}"`;

    const records = await pb.collection("event_registrations").getList(1, 50, { filter });
    for (let i = 0; i < records.items.length; i++) {
      const rec = records.items[i];
      await pb.collection("event_registrations").update(rec.id, {
        status: "expired",
        payment_status: "expired",
        cancel_reason: "payment_timeout",
      });
    }
  } catch (err) {
    console.error("[Events] expirePendingRegistrations Fehler:", err);
  }
}

// ─── Stripe Checkout für bezahlte Events ─────────────────────────────────────

/**
 * Erstellt eine Stripe-Checkout-Session für ein bezahltes Event.
 * Gibt die Checkout-URL zurück.
 */
export async function createEventStripeCheckout(
  mosqueId: string,
  userId: string,
  eventId: string,
  slug: string,
  baseUrl: string
): Promise<ActionResult & { checkoutUrl?: string }> {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return { success: false, error: "Stripe nicht konfiguriert" };

    const pb = await getAdminPB();

    // Event laden und validieren
    const event = await pb.collection("events").getOne(eventId);
    if (event.mosque_id !== mosqueId || event.status !== "published") {
      return { success: false, error: "Veranstaltung nicht verfügbar" };
    }
    if (!event.is_paid || !event.price_cents || event.price_cents < 50) {
      return { success: false, error: "Veranstaltung ist nicht kostenpflichtig" };
    }

    // Abgelaufene Registrierungen bereinigen
    await expirePendingRegistrations(eventId);

    // 1. Prüfung: bereits registriert oder pending?
    let existingReg: RecordModel | null = null;
    try {
      existingReg = await pb.collection("event_registrations").getFirstListItem(
        `user_id = "${userId}" && event_id = "${eventId}" && payment_status != "expired" && payment_status != "failed"`
      );
    } catch {
      // Keine gefunden
    }

    if (existingReg) {
      if (existingReg.payment_status === "paid") {
        return { success: false, error: "Sie sind bereits für diese Veranstaltung angemeldet" };
      }
      if (existingReg.payment_status === "pending_sepa") {
        return { success: false, error: "Eine SEPA-Zahlung ist bereits in Bearbeitung" };
      }
      if (existingReg.payment_method === "cash") {
        return { success: false, error: "Sie haben bereits eine Barzahlung reserviert" };
      }
      if (existingReg.payment_status === "pending" && existingReg.checkout_url) {
        return { success: true, checkoutUrl: existingReg.checkout_url };
      }
    }

    // 2. Prüfung direkt vor Insert (Race Condition minimieren)
    let doubleCheck: RecordModel | null = null;
    try {
      doubleCheck = await pb.collection("event_registrations").getFirstListItem(
        `user_id = "${userId}" && event_id = "${eventId}" && payment_status = "pending"`
      );
    } catch {
      // Keine gefunden
    }
    if (doubleCheck?.checkout_url) {
      return { success: true, checkoutUrl: doubleCheck.checkout_url };
    }

    // Kapazitätsprüfung (explizit)
    if (event.capacity > 0) {
      const occupancy = await getPaidEventOccupancy(pb, eventId);
      if (occupancy >= event.capacity) {
        return { success: false, error: "Veranstaltung ist ausgebucht" };
      }
    }

    // User-E-Mail laden
    const user = await pb.collection("users").getOne(userId, { fields: "email,first_name,last_name,name" });

    // Registration erstellen (pending, kein Platzverbrauch für card)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const regRecord = await pb.collection("event_registrations").create({
      mosque_id: mosqueId,
      event_id: eventId,
      registrant_type: "member",
      user_id: userId,
      status: "pending",
      payment_status: "pending",
      payment_method: "card",
      registered_at: new Date().toISOString(),
      expires_at: expiresAt,
    });

    // Stripe-Session erstellen
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "sepa_debit"],
      customer_email: user.email || undefined,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: event.title,
              description: `Veranstaltung · Moschee.App erhebt keine Provision.`,
            },
            unit_amount: event.price_cents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        payment_type: "event",
        mosque_id: mosqueId,
        event_id: eventId,
        registration_id: regRecord.id,
        user_id: userId,
      },
      // Metadata auch auf PaymentIntent → payment_intent.succeeded Webhook
      payment_intent_data: {
        metadata: {
          payment_type: "event",
          mosque_id: mosqueId,
          event_id: eventId,
          registration_id: regRecord.id,
          user_id: userId,
        },
      },
      success_url: `${baseUrl}/${slug}/events/${eventId}?payment_success=true`,
      cancel_url: `${baseUrl}/${slug}/events/${eventId}?payment_cancelled=true`,
    });

    // payment_ref + checkout_url speichern
    await pb.collection("event_registrations").update(regRecord.id, {
      payment_ref: session.id,
      checkout_url: session.url || "",
    });

    return { success: true, checkoutUrl: session.url || "" };
  } catch (error) {
    console.error("[Events] Stripe Checkout Fehler:", error);
    return { success: false, error: "Checkout konnte nicht gestartet werden" };
  }
}

/**
 * Erneute Zahlung für eine abgelaufene/fehlgeschlagene Registrierung.
 * Alte Stripe-Session wird gecancelt, neue Session erstellt.
 */
export async function retryEventPayment(
  registrationId: string,
  userId: string,
  slug: string,
  baseUrl: string
): Promise<ActionResult & { checkoutUrl?: string }> {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return { success: false, error: "Stripe nicht konfiguriert" };

    const pb = await getAdminPB();
    const reg = await pb.collection("event_registrations").getOne(registrationId);

    if (reg.user_id !== userId) {
      return { success: false, error: "Keine Berechtigung" };
    }
    if (!["pending", "expired", "failed"].includes(reg.payment_status || "")) {
      return { success: false, error: "Zahlung kann nicht wiederholt werden" };
    }

    const event = await pb.collection("events").getOne(reg.event_id);
    if (!event.is_paid || !event.price_cents || event.price_cents < 50) {
      return { success: false, error: "Veranstaltung ist nicht kostenpflichtig" };
    }

    // Alte Stripe-Session expiren (ignoriere Fehler — Session könnte schon abgelaufen sein)
    if (reg.payment_ref) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
        await stripe.checkout.sessions.expire(reg.payment_ref);
      } catch {
        // Ignorieren
      }
    }

    const user = await pb.collection("users").getOne(userId, { fields: "email" });
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "sepa_debit"],
      customer_email: user.email || undefined,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: event.title },
            unit_amount: event.price_cents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        payment_type: "event",
        mosque_id: reg.mosque_id,
        event_id: reg.event_id,
        registration_id: registrationId,
        user_id: userId,
      },
      payment_intent_data: {
        metadata: {
          payment_type: "event",
          mosque_id: reg.mosque_id,
          event_id: reg.event_id,
          registration_id: registrationId,
          user_id: userId,
        },
      },
      success_url: `${baseUrl}/${slug}/events/${eventId}?payment_success=true`,
      cancel_url: `${baseUrl}/${slug}/events/${eventId}?payment_cancelled=true`,
    });

    await pb.collection("event_registrations").update(registrationId, {
      status: "pending",
      payment_status: "pending",
      payment_method: "card",
      payment_ref: session.id,
      checkout_url: session.url || "",
      expires_at: expiresAt,
      cancel_reason: null,
    });

    return { success: true, checkoutUrl: session.url || "" };
  } catch (error) {
    console.error("[Events] Retry Payment Fehler:", error);
    return { success: false, error: "Erneute Zahlung fehlgeschlagen" };
  }
}

/**
 * User wechselt zu Barzahlung (nach Fehlschlag oder direkt).
 * Reserviert einen Platz ohne Online-Zahlung.
 */
export async function switchToBarPayment(
  registrationId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();
    const reg = await pb.collection("event_registrations").getOne(registrationId);

    if (reg.user_id !== userId) {
      return { success: false, error: "Keine Berechtigung" };
    }
    if (!["pending", "failed", "expired"].includes(reg.payment_status || "")) {
      return { success: false, error: "Wechsel zu Barzahlung nicht möglich" };
    }

    // Kapazität nochmal prüfen (cash reserviert Platz)
    const event = await pb.collection("events").getOne(reg.event_id);
    if (event.capacity > 0) {
      const occupancy = await getPaidEventOccupancy(pb, reg.event_id);
      if (occupancy >= event.capacity) {
        return { success: false, error: "Veranstaltung ist ausgebucht" };
      }
    }

    await pb.collection("event_registrations").update(registrationId, {
      payment_method: "cash",
      payment_status: "pending",
      expires_at: null,
      cancel_reason: reg.cancel_reason === "sepa_failed" ? "sepa_failed" : null,
      original_payment_method: reg.payment_method || null,
    });

    logAudit({
      mosqueId: reg.mosque_id,
      userId,
      action: "event_registration.switched_to_cash",
      entityType: "event_registration",
      entityId: registrationId,
      details: { event_id: reg.event_id },
    });

    return { success: true };
  } catch (error) {
    console.error("[Events] Switch to Bar Fehler:", error);
    return { success: false, error: "Wechsel zu Barzahlung fehlgeschlagen" };
  }
}

/**
 * Admin markiert eine Registrierung als bar bezahlt.
 */
export async function markEventCashPaid(
  registrationId: string,
  mosqueId: string
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();
    const reg = await pb.collection("event_registrations").getOne(registrationId);

    if (reg.mosque_id !== mosqueId) {
      return { success: false, error: "Keine Berechtigung" };
    }
    if (reg.payment_method !== "cash" || reg.payment_status !== "pending") {
      return { success: false, error: "Registrierung ist nicht für Barzahlung vorgesehen" };
    }

    await pb.collection("event_registrations").update(registrationId, {
      status: "registered",
      payment_status: "paid",
      payment_method: "cash",
      paid_at: new Date().toISOString(),
    });

    logAudit({
      mosqueId,
      action: "event_registration.paid_cash",
      entityType: "event_registration",
      entityId: registrationId,
      details: { event_id: reg.event_id, user_id: reg.user_id },
    });

    return { success: true };
  } catch (error) {
    console.error("[Events] Mark Cash Paid Fehler:", error);
    return { success: false, error: "Barzahlung konnte nicht bestätigt werden" };
  }
}

/**
 * Admin markiert eine Registrierung manuell als bezahlt (Cash oder SEPA-Fallback).
 * payment_method wird NICHT verändert — sepa bleibt sepa, cash bleibt cash.
 */
export async function markEventPaidManually(
  registrationId: string,
  mosqueId: string
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();
    const reg = await pb.collection("event_registrations").getOne(registrationId);

    if (reg.mosque_id !== mosqueId) {
      return { success: false, error: "Keine Berechtigung" };
    }

    const isManuallyPayable =
      (reg.payment_method === "cash" && reg.payment_status === "pending") ||
      reg.payment_status === "pending_sepa";

    if (!isManuallyPayable) {
      return { success: false, error: "Zahlung kann nicht manuell bestätigt werden" };
    }

    await pb.collection("event_registrations").update(registrationId, {
      status: "registered",
      payment_status: "paid",
      // payment_method bleibt unverändert!
      paid_at: new Date().toISOString(),
    });

    logAudit({
      mosqueId,
      action: "event_registration.paid_manual",
      entityType: "event_registration",
      entityId: registrationId,
      details: {
        event_id: reg.event_id,
        user_id: reg.user_id,
        payment_method: reg.payment_method,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[Events] Mark Paid Manually Fehler:", error);
    return { success: false, error: "Zahlung konnte nicht bestätigt werden" };
  }
}
