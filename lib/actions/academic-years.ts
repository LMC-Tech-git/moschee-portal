"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { academicYearSchema, type AcademicYearInput } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import type { AcademicYear } from "@/types";
import type { RecordModel } from "pocketbase";
import PocketBase from "pocketbase";

// --- Helpers ---

async function archiveOtherActiveYears(
  pb: PocketBase,
  mosqueId: string,
  exceptId?: string
): Promise<void> {
  const filterParts = [`mosque_id = "${mosqueId}"`, `status = "active"`];
  if (exceptId) filterParts.push(`id != "${exceptId}"`);
  const existing = await pb.collection("academic_years").getFullList({
    filter: filterParts.join(" && "),
  });
  for (const yr of existing) {
    await pb.collection("academic_years").update(yr.id, { status: "archived" });
  }
}

function mapRecord(record: RecordModel): AcademicYear {
  return {
    id: record.id,
    mosque_id: record.mosque_id || "",
    name: record.name || "",
    start_date: record.start_date || "",
    end_date: record.end_date || "",
    status: record.status || "active",
    created: record.created || "",
    updated: record.updated || "",
  };
}

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Alle Schuljahre einer Moschee laden.
 */
export async function getAcademicYearsByMosque(
  mosqueId: string
): Promise<ActionResult<AcademicYear[]>> {
  try {
    const pb = await getAdminPB();
    const records = await pb.collection("academic_years").getFullList({
      filter: `mosque_id = "${mosqueId}"`,
      sort: "-start_date",
    });
    return { success: true, data: records.map(mapRecord) };
  } catch (error) {
    console.error("[AcademicYears] Fehler beim Laden:", error);
    return { success: false, error: "Schuljahre konnten nicht geladen werden" };
  }
}

/**
 * Aktives Schuljahr einer Moschee laden.
 */
export async function getActiveAcademicYear(
  mosqueId: string
): Promise<ActionResult<AcademicYear>> {
  try {
    const pb = await getAdminPB();
    const record = await pb.collection("academic_years").getFirstListItem(
      `mosque_id = "${mosqueId}" && status = "active"`
    );
    return { success: true, data: mapRecord(record) };
  } catch {
    return { success: false, error: "Kein aktives Schuljahr gefunden" };
  }
}

/**
 * Neues Schuljahr erstellen.
 */
export async function createAcademicYear(
  mosqueId: string,
  userId: string,
  input: AcademicYearInput
): Promise<ActionResult<AcademicYear>> {
  try {
    const validated = academicYearSchema.parse(input);
    const pb = await getAdminPB();

    if (validated.status === "active") {
      await archiveOtherActiveYears(pb, mosqueId);
    }

    const record = await pb.collection("academic_years").create({
      mosque_id: mosqueId,
      name: validated.name,
      start_date: validated.start_date,
      end_date: validated.end_date,
      status: validated.status,
    });

    await logAudit({
      mosqueId,
      userId,
      action: "academic_year.created",
      entityType: "academic_year",
      entityId: record.id,
      details: { name: validated.name },
    });

    return { success: true, data: mapRecord(record) };
  } catch (error) {
    console.error("[AcademicYears] Fehler beim Erstellen:", error);
    return { success: false, error: "Schuljahr konnte nicht erstellt werden" };
  }
}

/**
 * Schuljahr aktualisieren.
 */
export async function updateAcademicYear(
  yearId: string,
  mosqueId: string,
  userId: string,
  input: AcademicYearInput
): Promise<ActionResult<AcademicYear>> {
  try {
    const validated = academicYearSchema.parse(input);
    const pb = await getAdminPB();

    const existing = await pb.collection("academic_years").getOne(yearId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Schuljahr nicht gefunden" };
    }

    if (validated.status === "active") {
      await archiveOtherActiveYears(pb, mosqueId, yearId);
    }

    const record = await pb.collection("academic_years").update(yearId, {
      name: validated.name,
      start_date: validated.start_date,
      end_date: validated.end_date,
      status: validated.status,
    });

    await logAudit({
      mosqueId,
      userId,
      action: "academic_year.updated",
      entityType: "academic_year",
      entityId: yearId,
      details: { name: validated.name },
    });

    return { success: true, data: mapRecord(record) };
  } catch (error) {
    console.error("[AcademicYears] Fehler beim Aktualisieren:", error);
    return { success: false, error: "Schuljahr konnte nicht aktualisiert werden" };
  }
}

/**
 * Schuljahr archivieren.
 */
export async function archiveAcademicYear(
  yearId: string,
  mosqueId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();

    const existing = await pb.collection("academic_years").getOne(yearId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Schuljahr nicht gefunden" };
    }

    await pb.collection("academic_years").update(yearId, { status: "archived" });

    await logAudit({
      mosqueId,
      userId,
      action: "academic_year.archived",
      entityType: "academic_year",
      entityId: yearId,
      details: { name: existing.name },
    });

    return { success: true };
  } catch (error) {
    console.error("[AcademicYears] Fehler beim Archivieren:", error);
    return { success: false, error: "Schuljahr konnte nicht archiviert werden" };
  }
}

/**
 * Schuljahr aktivieren (archiviert alle anderen aktiven Jahre der Moschee).
 */
export async function activateAcademicYear(
  yearId: string,
  mosqueId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();

    const existing = await pb.collection("academic_years").getOne(yearId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Schuljahr nicht gefunden" };
    }

    await archiveOtherActiveYears(pb, mosqueId, yearId);
    await pb.collection("academic_years").update(yearId, { status: "active" });

    await logAudit({
      mosqueId,
      userId,
      action: "academic_year.activated",
      entityType: "academic_year",
      entityId: yearId,
      details: { name: existing.name },
    });

    return { success: true };
  } catch (error) {
    console.error("[AcademicYears] Fehler beim Aktivieren:", error);
    return { success: false, error: "Schuljahr konnte nicht aktiviert werden" };
  }
}
