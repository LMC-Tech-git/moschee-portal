"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { logAudit } from "@/lib/audit";
import type { StudentFee, Student } from "@/types";
import type { RecordModel } from "pocketbase";
import Stripe from "stripe";

// --- Helpers ---

function mapRecordToFee(record: RecordModel): StudentFee {
  return {
    id: record.id,
    mosque_id: record.mosque_id || "",
    student_id: record.student_id || "",
    month_key: record.month_key || "",
    amount_cents: record.amount_cents || 0,
    status: record.status || "open",
    paid_at: record.paid_at || "",
    payment_method: record.payment_method || "",
    provider_ref: record.provider_ref || "",
    notes: record.notes || "",
    created_by: record.created_by || "",
    reminder_sent_at: record.reminder_sent_at || "",
    created: record.created || "",
    updated: record.updated || "",
    expand: record.expand
      ? { student_id: record.expand.student_id as Student | undefined }
      : undefined,
  };
}

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// --- Monatliche Gebühren-Übersicht (Admin) ---

export interface FeeOverviewRow {
  student: Student;
  fee: StudentFee | null;
}

/**
 * Lädt alle eingeschriebenen Schüler einer Moschee + deren Gebühren-Status für einen Monat.
 */
export async function getMonthlyFeeOverview(
  mosqueId: string,
  monthKey: string
): Promise<ActionResult<FeeOverviewRow[]>> {
  try {
    const pb = await getAdminPB();

    // 1. Alle aktiven Schüler der Moschee laden
    const studentsResult = await pb.collection("students").getFullList({
      filter: `mosque_id = "${mosqueId}" && status = "active"`,
      sort: "first_name,last_name",
    });

    const students = studentsResult as unknown as Student[];

    // 2. Alle Gebühren für diesen Monat laden
    const feesResult = await pb.collection("student_fees").getFullList({
      filter: `mosque_id = "${mosqueId}" && month_key = "${monthKey}"`,
    });
    const feesMap: Record<string, StudentFee> = {};
    feesResult.forEach((r) => {
      feesMap[r.student_id] = mapRecordToFee(r);
    });

    // 3. Kombinieren
    const rows: FeeOverviewRow[] = students.map((student) => ({
      student,
      fee: feesMap[student.id] || null,
    }));

    return { success: true, data: rows };
  } catch (error) {
    console.error("[StudentFees] getMonthlyFeeOverview:", error);
    return { success: false, error: "Gebühren-Übersicht konnte nicht geladen werden" };
  }
}

/**
 * Erstellt offene Gebühren-Records für alle aktiven Schüler eines Monats.
 * Überspringt Schüler, die bereits einen Record für diesen Monat haben.
 */
export async function createMonthlyFees(
  mosqueId: string,
  userId: string,
  monthKey: string,
  amountCents: number
): Promise<ActionResult<{ created: number; skipped: number }>> {
  try {
    const pb = await getAdminPB();

    // Alle aktiven Schüler laden
    const studentsResult = await pb.collection("students").getFullList({
      filter: `mosque_id = "${mosqueId}" && status = "active"`,
      fields: "id",
    });

    // Bestehende Records für diesen Monat laden
    const existingResult = await pb.collection("student_fees").getFullList({
      filter: `mosque_id = "${mosqueId}" && month_key = "${monthKey}"`,
      fields: "student_id",
    });
    const existingStudentIds = new Set(existingResult.map((r) => r.student_id));

    let created = 0;
    let skipped = 0;

    for (let i = 0; i < studentsResult.length; i++) {
      const student = studentsResult[i];
      if (existingStudentIds.has(student.id)) {
        skipped++;
        continue;
      }
      await pb.collection("student_fees").create({
        mosque_id: mosqueId,
        student_id: student.id,
        month_key: monthKey,
        amount_cents: amountCents,
        status: "open",
        created_by: userId,
      });
      created++;
    }

    await logAudit({
      mosqueId,
      userId,
      action: "student_fees.bulk_created",
      entityType: "student_fees",
      entityId: monthKey,
      details: { month_key: monthKey, created, skipped, amount_cents: amountCents },
    });

    return { success: true, data: { created, skipped } };
  } catch (error) {
    console.error("[StudentFees] createMonthlyFees:", error);
    return { success: false, error: "Gebühren konnten nicht erstellt werden" };
  }
}

/**
 * Markiert eine Gebühr als manuell bezahlt (bar oder überweisung).
 */
export async function markFeePaid(
  mosqueId: string,
  userId: string,
  feeId: string,
  paymentMethod: "cash" | "transfer",
  notes: string
): Promise<ActionResult<StudentFee>> {
  try {
    const pb = await getAdminPB();

    const existing = await pb.collection("student_fees").getOne(feeId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Gebühr nicht gefunden" };
    }

    const record = await pb.collection("student_fees").update(feeId, {
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_method: paymentMethod,
      notes: notes || existing.notes,
      created_by: userId,
    });

    await logAudit({
      mosqueId,
      userId,
      action: "student_fee.marked_paid",
      entityType: "student_fees",
      entityId: feeId,
      details: { payment_method: paymentMethod, month_key: existing.month_key },
    });

    return { success: true, data: mapRecordToFee(record) };
  } catch (error) {
    console.error("[StudentFees] markFeePaid:", error);
    return { success: false, error: "Gebühr konnte nicht als bezahlt markiert werden" };
  }
}

/**
 * Erlässt eine Gebühr.
 */
export async function markFeeWaived(
  mosqueId: string,
  userId: string,
  feeId: string,
  notes: string
): Promise<ActionResult<StudentFee>> {
  try {
    const pb = await getAdminPB();

    const existing = await pb.collection("student_fees").getOne(feeId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Gebühr nicht gefunden" };
    }

    const record = await pb.collection("student_fees").update(feeId, {
      status: "waived",
      payment_method: "waived",
      paid_at: new Date().toISOString(),
      notes: notes || existing.notes,
      created_by: userId,
    });

    await logAudit({
      mosqueId,
      userId,
      action: "student_fee.waived",
      entityType: "student_fees",
      entityId: feeId,
      details: { month_key: existing.month_key },
    });

    return { success: true, data: mapRecordToFee(record) };
  } catch (error) {
    console.error("[StudentFees] markFeeWaived:", error);
    return { success: false, error: "Gebühr konnte nicht erlassen werden" };
  }
}

/**
 * Erstellt einen einzelnen Fee-Record falls noch nicht vorhanden (lazy creation).
 */
export async function getOrCreateFee(
  mosqueId: string,
  studentId: string,
  monthKey: string,
  amountCents: number,
  createdBy: string
): Promise<ActionResult<StudentFee>> {
  try {
    const pb = await getAdminPB();

    try {
      const existing = await pb.collection("student_fees").getFirstListItem(
        `mosque_id = "${mosqueId}" && student_id = "${studentId}" && month_key = "${monthKey}"`
      );
      return { success: true, data: mapRecordToFee(existing) };
    } catch {
      // Noch kein Record → erstellen
    }

    const record = await pb.collection("student_fees").create({
      mosque_id: mosqueId,
      student_id: studentId,
      month_key: monthKey,
      amount_cents: amountCents,
      status: "open",
      created_by: createdBy,
    });

    return { success: true, data: mapRecordToFee(record) };
  } catch (error) {
    console.error("[StudentFees] getOrCreateFee:", error);
    return { success: false, error: "Gebühr konnte nicht erstellt werden" };
  }
}

/**
 * Eltern-Ansicht: Eigene Kinder + deren Gebühren-Status für einen Monat.
 */
export async function getParentFeeOverview(
  mosqueId: string,
  parentUserId: string,
  monthKey: string
): Promise<ActionResult<FeeOverviewRow[]>> {
  try {
    const pb = await getAdminPB();

    // Kinder des Elternteils laden
    const studentsResult = await pb.collection("students").getFullList({
      filter: `mosque_id = "${mosqueId}" && parent_id = "${parentUserId}" && status = "active"`,
      sort: "first_name,last_name",
    });

    if (studentsResult.length === 0) {
      return { success: true, data: [] };
    }

    const students = studentsResult as unknown as Student[];
    const studentIds = students.map((s) => s.id);

    // Gebühren für diese Kinder laden
    const filterParts = studentIds.map((id) => `student_id = "${id}"`).join(" || ");
    const feesResult = await pb.collection("student_fees").getFullList({
      filter: `mosque_id = "${mosqueId}" && month_key = "${monthKey}" && (${filterParts})`,
    });
    const feesMap: Record<string, StudentFee> = {};
    feesResult.forEach((r) => {
      feesMap[r.student_id] = mapRecordToFee(r);
    });

    const rows: FeeOverviewRow[] = students.map((student) => ({
      student,
      fee: feesMap[student.id] || null,
    }));

    return { success: true, data: rows };
  } catch (error) {
    console.error("[StudentFees] getParentFeeOverview:", error);
    return { success: false, error: "Gebühren konnten nicht geladen werden" };
  }
}

/**
 * Erstellt einen Stripe Checkout für eine Gebühr (Eltern-Zahlung).
 */
export async function createFeeStripeCheckout(
  mosqueId: string,
  parentUserId: string,
  feeId: string,
  slug: string,
  baseUrl: string
): Promise<ActionResult<{ checkout_url: string }>> {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return { success: false, error: "Stripe nicht konfiguriert" };
    }

    const pb = await getAdminPB();

    // Fee laden + Tenant-Check
    const feeRecord = await pb.collection("student_fees").getOne(feeId, {
      expand: "student_id",
    });
    if (feeRecord.mosque_id !== mosqueId) {
      return { success: false, error: "Gebühr nicht gefunden" };
    }
    if (feeRecord.status !== "open") {
      return { success: false, error: "Gebühr ist bereits bezahlt oder erlassen" };
    }

    const fee = mapRecordToFee(feeRecord);
    const studentName = feeRecord.expand?.student_id
      ? `${(feeRecord.expand.student_id as Record<string, string>).first_name} ${(feeRecord.expand.student_id as Record<string, string>).last_name}`
      : "Schüler";

    // Stripe Checkout Session erstellen
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Madrasa-Gebühr ${fee.month_key}`,
              description: `Schüler: ${studentName}`,
            },
            unit_amount: fee.amount_cents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        mosque_id: mosqueId,
        fee_id: feeId,
        payment_type: "fee",
        parent_user_id: parentUserId,
      },
      success_url: `${baseUrl}/member/profile?fees_success=true`,
      cancel_url: `${baseUrl}/member/profile`,
    });

    // Fee auf "pending" setzen + provider_ref speichern
    await pb.collection("student_fees").update(feeId, {
      provider_ref: session.id,
    });

    return { success: true, data: { checkout_url: session.url || "" } };
  } catch (error) {
    console.error("[StudentFees] createFeeStripeCheckout:", error);
    return { success: false, error: "Zahlung konnte nicht gestartet werden" };
  }
}

/**
 * Einzelne Gebühr laden (für Webhook etc.).
 */
export async function getStudentFeeById(
  feeId: string,
  mosqueId: string
): Promise<ActionResult<StudentFee>> {
  try {
    const pb = await getAdminPB();
    const record = await pb.collection("student_fees").getOne(feeId);
    if (record.mosque_id !== mosqueId) {
      return { success: false, error: "Gebühr nicht gefunden" };
    }
    return { success: true, data: mapRecordToFee(record) };
  } catch (error) {
    console.error("[StudentFees] getStudentFeeById:", error);
    return { success: false, error: "Gebühr konnte nicht geladen werden" };
  }
}
