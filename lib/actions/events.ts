"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { eventSchema, type EventInput } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { sendEmailDirect } from "@/lib/email";
import { renderEventConfirmation } from "@/lib/email/templates";
import type { Event, EventRegistration } from "@/types";
import type { RecordModel } from "pocketbase";
import { checkDemoLimit } from "@/lib/demo";

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
    }));

    // Mitglieds-Namen und E-Mails nachladen
    const memberUserIds = [
      ...new Set(
        registrations
          .filter((r) => r.registrant_type === "member" && r.user_id)
          .map((r) => r.user_id)
      ),
    ];
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
      "Registriert am",
      "Verifiziert am",
    ].join(";");

    // CSV Rows
    const rows = registrations.map((reg) => {
      const name =
        reg.registrant_type === "guest"
          ? reg.guest_name
          : `Mitglied (${reg.user_id})`;
      const email =
        reg.registrant_type === "guest" ? reg.guest_email : "";
      const typ =
        reg.registrant_type === "guest" ? "Gast" : "Mitglied";
      const status =
        reg.status === "registered"
          ? "Registriert"
          : reg.status === "cancelled"
            ? "Storniert"
            : reg.status === "attended"
              ? "Teilgenommen"
              : "Nicht erschienen";
      const registeredAt = reg.registered_at
        ? new Date(reg.registered_at).toLocaleString("de-DE")
        : "";
      const verifiedAt = reg.verified_at
        ? new Date(reg.verified_at).toLocaleString("de-DE")
        : "";

      return [name, email, typ, status, registeredAt, verifiedAt]
        .map((v) => `"${v.replace(/"/g, '""')}"`)
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
 */
export async function registerMemberForEvent(
  mosqueId: string,
  eventId: string,
  userId: string
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
