"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { logAudit } from "@/lib/audit";
import { getMadrasaFeeSettings } from "@/lib/actions/settings";
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
    discount_applied_cents: record.discount_applied_cents || 0,
    sibling_rank: record.sibling_rank || 1,
    discount_type: (record.discount_type as "none" | "sibling" | "custom") || "none",
    discount_percent_applied: record.discount_percent_applied || 0,
    created: record.created || "",
    updated: record.updated || "",
    expand: record.expand
      ? { student_id: record.expand.student_id as Student | undefined }
      : undefined,
  };
}

/**
 * Ermittelt den Geschwister-Rang jedes Schülers innerhalb seiner Familie.
 * Rang 1 = erstes Kind (Vollpreis), 2 = zweites Kind, 3 = drittes Kind oder mehr.
 *
 * Algorithmus:
 * - Lädt alle parent_child_relations der Moschee in einem einzigen Query
 * - Bezieht Legacy-Felder (parent_id, father_user_id, mother_user_id) aus dem
 *   bereits vorhandenen students-Array (kein zusätzlicher DB-Call)
 * - Pro Schüler: minimaler Rang über alle Elterngruppen (bester Rabatt)
 *
 * @param pb      PocketBase Admin-Client
 * @param mosqueId  Mosque ID für Tenant-Isolation
 * @param students  Bereits geladene aktive Schüler
 * @returns Map studentId → siblingRank (1, 2 oder 3)
 */
async function buildSiblingRankMap(
  pb: Awaited<ReturnType<typeof getAdminPB>>,
  mosqueId: string,
  students: RecordModel[]
): Promise<Map<string, number>> {
  // Map: parentId → [studentId, ...] sortiert nach student.created ASC
  const parentToStudents = new Map<string, string[]>();

  // 1. Legacy-Felder aus dem students-Array (kein extra DB-Call)
  students.forEach((s) => {
    const legacyParents: string[] = [];
    if (s.parent_id) legacyParents.push(s.parent_id);
    if (s.father_user_id) legacyParents.push(s.father_user_id);
    if (s.mother_user_id) legacyParents.push(s.mother_user_id);
    legacyParents.forEach((pid) => {
      if (!parentToStudents.has(pid)) parentToStudents.set(pid, []);
      const list = parentToStudents.get(pid)!;
      if (!list.includes(s.id)) list.push(s.id);
    });
  });

  // 2. Junction Table in einem einzigen Query laden
  const relations = await pb.collection("parent_child_relations").getFullList({
    filter: `mosque_id = "${mosqueId}"`,
    fields: "parent_user,student",
    sort: "created",
  });
  relations.forEach((r) => {
    if (!r.parent_user || !r.student) return;
    if (!parentToStudents.has(r.parent_user)) parentToStudents.set(r.parent_user, []);
    const list = parentToStudents.get(r.parent_user)!;
    if (!list.includes(r.student)) list.push(r.student);
  });

  // 3. Jede Elterngruppe nach student.created ASC sortieren
  // (Die student-Objekte sind bereits im students-Array vorhanden)
  const createdByStudentId = new Map<string, string>();
  students.forEach((s) => createdByStudentId.set(s.id, s.created || ""));

  parentToStudents.forEach((ids, parentId) => {
    ids.sort((a, b) => {
      const ca = createdByStudentId.get(a) || "";
      const cb = createdByStudentId.get(b) || "";
      return ca < cb ? -1 : ca > cb ? 1 : 0;
    });
    parentToStudents.set(parentId, ids);
  });

  // 4. Pro Schüler: minimalen Rang über alle Elterngruppen berechnen
  const rankMap = new Map<string, number>();
  students.forEach((s) => rankMap.set(s.id, 1)); // Default: Rang 1

  parentToStudents.forEach((ids) => {
    ids.forEach((studentId, index) => {
      const rank = index + 1; // 0-basierter Index → 1-basierter Rang
      const cappedRank = rank >= 3 ? 3 : rank;
      const currentRank = rankMap.get(studentId);
      // Nur überschreiben wenn der neue Rang HÖHER ist (schlechterer Rabatt)
      // → wir wollen den NIEDRIGSTEN (besten) Rang behalten, also nur wenn currentRank = 1 und rank > 1
      // Nein: wir wollen den höchsten Rang (2. Kind eines Elternteils bleibt Rang 2,
      // auch wenn es bei einem anderen Elternteil Rang 1 wäre → bester Rabatt = niedrigster Rang)
      if (currentRank === undefined || cappedRank < currentRank) {
        rankMap.set(studentId, cappedRank);
      }
    });
  });

  return rankMap;
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
 * Wendet Geschwister-Rabatt an, wenn in den Settings aktiviert.
 */
export async function createMonthlyFees(
  mosqueId: string,
  userId: string,
  monthKey: string,
  amountCents: number
): Promise<ActionResult<{ created: number; skipped: number; discounted: number }>> {
  try {
    const pb = await getAdminPB();

    // Settings laden (Geschwister-Rabatt)
    const settingsResult = await getMadrasaFeeSettings(mosqueId);
    // Expliziter === true Check — null/false/undefined → deaktiviert
    const siblingDiscountEnabled = settingsResult.data?.sibling_discount_enabled === true;
    const discount2nd = settingsResult.data?.sibling_discount_2nd_percent || 0;
    const discount3rd = settingsResult.data?.sibling_discount_3rd_percent || 0;

    // Alle aktiven Schüler laden (mit allen Feldern für Rang-Berechnung + custom_discount_percent)
    const studentsResult = await pb.collection("students").getFullList({
      filter: `mosque_id = "${mosqueId}" && status = "active"`,
      sort: "created",
    });

    // Geschwister-Rang-Map aufbauen (nur 1 extra Query)
    const rankMap = siblingDiscountEnabled
      ? await buildSiblingRankMap(pb, mosqueId, studentsResult)
      : new Map<string, number>();

    // Bestehende Records für diesen Monat laden
    const existingResult = await pb.collection("student_fees").getFullList({
      filter: `mosque_id = "${mosqueId}" && month_key = "${monthKey}"`,
      fields: "student_id",
    });
    const existingStudentIds = new Set(existingResult.map((r) => r.student_id));

    let created = 0;
    let skipped = 0;
    let discounted = 0;

    for (let i = 0; i < studentsResult.length; i++) {
      const student = studentsResult[i];
      if (existingStudentIds.has(student.id)) {
        skipped++;
        continue;
      }

      // Geschwister-Rabatt (Prozentsatz)
      const rank = rankMap.get(student.id) || 1;
      const siblingPct = siblingDiscountEnabled
        ? rank === 2 ? discount2nd : rank >= 3 ? discount3rd : 0
        : 0;

      // Individueller Rabatt vom Schüler-Record
      const customPct: number = student.custom_discount_percent || 0;

      // Bester Rabatt gewinnt
      const effectivePct = Math.max(siblingPct, customPct);
      const finalAmount = effectivePct > 0
        ? Math.round(amountCents * (1 - effectivePct / 100))
        : amountCents;
      const discountApplied = amountCents - finalAmount;

      // Welcher Mechanismus hat gewonnen?
      const discountType: "none" | "sibling" | "custom" =
        effectivePct === 0 ? "none"
        : customPct >= siblingPct && customPct > 0 ? "custom"
        : "sibling";

      await pb.collection("student_fees").create({
        mosque_id: mosqueId,
        student_id: student.id,
        month_key: monthKey,
        amount_cents: finalAmount,
        status: "open",
        created_by: userId,
        discount_applied_cents: discountApplied,
        sibling_rank: rank,
        discount_type: discountType,
        discount_percent_applied: effectivePct,
      });
      created++;
      if (discountApplied > 0) discounted++;
    }

    await logAudit({
      mosqueId,
      userId,
      action: "student_fees.bulk_created",
      entityType: "student_fees",
      entityId: monthKey,
      details: { month_key: monthKey, created, skipped, amount_cents: amountCents, discounted },
    });

    return { success: true, data: { created, skipped, discounted } };
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

    let studentName = "";
    try {
      const student = await pb.collection("students").getOne(existing.student_id, { fields: "first_name,last_name" });
      studentName = `${student.first_name} ${student.last_name}`.trim();
    } catch { /* ignore */ }

    await logAudit({
      mosqueId,
      userId,
      action: "student_fee.marked_paid",
      entityType: "student_fees",
      entityId: feeId,
      details: { student_name: studentName, payment_method: paymentMethod, month_key: existing.month_key },
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

    let studentName = "";
    try {
      const student = await pb.collection("students").getOne(existing.student_id, { fields: "first_name,last_name" });
      studentName = `${student.first_name} ${student.last_name}`.trim();
    } catch { /* ignore */ }

    await logAudit({
      mosqueId,
      userId,
      action: "student_fee.waived",
      entityType: "student_fees",
      entityId: feeId,
      details: { student_name: studentName, month_key: existing.month_key },
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
 * Lädt alle aktiven Kinder eines Elternteils — kombiniert Legacy-Felder
 * (parent_id, father_user_id, mother_user_id) mit der junction table.
 */
async function loadActiveChildrenForParent(
  pb: Awaited<ReturnType<typeof getAdminPB>>,
  mosqueId: string,
  parentUserId: string
): Promise<Student[]> {
  // 1. Legacy-Felder
  const legacyRecords = await pb.collection("students").getFullList({
    filter: `mosque_id = "${mosqueId}" && status = "active" && (parent_id = "${parentUserId}" || father_user_id = "${parentUserId}" || mother_user_id = "${parentUserId}")`,
    sort: "first_name,last_name",
  });
  const all: Student[] = legacyRecords as unknown as Student[];

  // 2. Junction Table parent_child_relations
  let page = 1;
  while (true) {
    const res = await pb.collection("parent_child_relations").getList(page, 200, {
      filter: `mosque_id = "${mosqueId}" && parent_user = "${parentUserId}"`,
      expand: "student",
    });
    for (const r of res.items) {
      if (!r.expand?.student) continue;
      const s = r.expand.student as unknown as Student;
      if (s.status === "active") all.push(s);
    }
    if (res.page >= res.totalPages) break;
    page++;
  }

  // 3. Deduplizieren
  const seen = new Set<string>();
  return all.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
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

    // Kinder des Elternteils laden (Legacy + Junction Table)
    const studentsResult = await loadActiveChildrenForParent(pb, mosqueId, parentUserId);

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

    // E-Mail des Elternteils laden (für Stripe-Prefill)
    let parentEmail: string | undefined;
    try {
      const parentRecord = await pb.collection("users").getOne(parentUserId, { fields: "email" });
      parentEmail = parentRecord.email || undefined;
    } catch {}

    // Stripe Checkout Session erstellen
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "sepa_debit"],
      customer_email: parentEmail,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Madrasa-Gebühr ${fee.month_key}`,
              description: `Schüler: ${studentName} · Moschee.App erhebt keine Provision.`,
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
        original_amount_cents: String(fee.amount_cents),
        cover_fees: "false",
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
 * Berechnet eine Liste von Monat-Keys ab einem Startmonat.
 * z.B. getMonthRange("2026-03", 3) → ["2026-03", "2026-04", "2026-05"]
 */
function getMonthRange(startKey: string, count: number): string[] {
  const [y, m] = startKey.split("-").map(Number);
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(y, m - 1 + i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

/**
 * Mehrmonatige Vorauszahlung für alle Kinder eines Elternteils.
 * Erstellt fehlende student_fees-Records und startet einen Stripe-Checkout.
 */
export async function createMultiMonthFeeCheckout(
  mosqueId: string,
  parentUserId: string,
  startMonthKey: string,
  months: number,
  baseUrl: string
): Promise<ActionResult<{ checkout_url: string }>> {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return { success: false, error: "Stripe nicht konfiguriert" };

    const pb = await getAdminPB();

    // Standardbetrag aus Settings laden
    const settingsResult = await getMadrasaFeeSettings(mosqueId);
    const defaultAmountCents =
      settingsResult.success && settingsResult.data?.madrasa_default_fee_cents
        ? settingsResult.data.madrasa_default_fee_cents
        : 1000;

    // Aktive Kinder laden (Legacy + Junction Table)
    const students = await loadActiveChildrenForParent(pb, mosqueId, parentUserId);

    if (students.length === 0) {
      return { success: false, error: "Keine aktiven Kinder gefunden" };
    }

    const monthKeys = getMonthRange(startMonthKey, months);
    let totalCents = 0;

    // Für jedes Kind × Monat: Record sicherstellen
    for (const student of students) {
      for (const monthKey of monthKeys) {
        const existing = await pb.collection("student_fees").getFullList({
          filter: `mosque_id = "${mosqueId}" && student_id = "${student.id}" && month_key = "${monthKey}"`,
        });
        if (existing.length === 0) {
          await pb.collection("student_fees").create({
            mosque_id: mosqueId,
            student_id: student.id,
            month_key: monthKey,
            amount_cents: defaultAmountCents,
            status: "open",
            created_by: parentUserId,
          });
          totalCents += defaultAmountCents;
        } else {
          const fee = existing[0];
          if (fee.status === "open") {
            totalCents += fee.amount_cents || defaultAmountCents;
          }
        }
      }
    }

    if (totalCents <= 0) {
      return { success: false, error: "Alle Gebühren für diesen Zeitraum sind bereits bezahlt" };
    }

    // E-Mail des Elternteils
    let parentEmail: string | undefined;
    try {
      const parent = await pb.collection("users").getOne(parentUserId, { fields: "email" });
      parentEmail = parent.email || undefined;
    } catch { /* ignore */ }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "sepa_debit"],
      customer_email: parentEmail,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Madrasa-Gebühren ${months === 1 ? monthKeys[0] : `${monthKeys[0]} – ${monthKeys[monthKeys.length - 1]}`}`,
              description: `${students.length} Schüler × ${months} Monate · Moschee.App erhebt keine Provision.`,
            },
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        mosque_id: mosqueId,
        payment_type: "fee_multi",
        parent_user_id: parentUserId,
        start_month_key: startMonthKey,
        months: months.toString(),
        original_amount_cents: String(totalCents),
        cover_fees: "false",
      },
      success_url: `${baseUrl}/member/profile?fees_success=true`,
      cancel_url: `${baseUrl}/member/profile`,
    });

    return { success: true, data: { checkout_url: session.url || "" } };
  } catch (error) {
    console.error("[StudentFees] createMultiMonthFeeCheckout:", error);
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
