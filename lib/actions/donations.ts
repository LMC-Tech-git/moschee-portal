"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { logAudit, safeAudit } from "@/lib/audit";
import { createIncome } from "@/lib/actions/finance-domain";
import { mapDonationToEUR } from "@/lib/constants";
import {
  assertDonationEditAllowed,
  donationToKontoChannel,
} from "@/lib/donations-finance-helpers";
import type { Donation } from "@/types";
import type { RecordModel } from "pocketbase";

/**
 * Sprint 2 — markDonationPaidAndEmit (Plan §13.1-5, F2).
 *
 * Zentraler Helper für ALLE Stellen wo `donations.status` auf `paid` gesetzt
 * wird (manueller mark-paid, Stripe-Webhook). Setzt status=paid, ruft dann
 * createIncome (Domain-Service). Bei createIncome-Fehler: KEIN Rollback der
 * Status-Änderung (Append-only; Drift-Sweeper holt fehlendes Event nach).
 *
 * Aufrufer geben `ctx:{webhook:true}` bei Stripe-Webhook, sonst ohne ctx.
 */
export async function markDonationPaidAndEmit(
  donationId: string,
  paidAt: string,
  options: {
    mosqueIdHint?: string;
    externalEventId?: string;
    ctx?: { backfill?: boolean; webhook?: boolean };
  } = {}
): Promise<{ eventUuid: string | null; duplicated: boolean; lockSet: boolean }> {
  const pb = await getAdminPB();
  const before = await pb.collection("donations").getOne(donationId);
  const mosqueId = options.mosqueIdHint || String(before.mosque_id || "");
  if (!mosqueId) throw new Error("markDonationPaidAndEmit: mosque_id fehlt");

  // Idempotent: wenn schon paid, nicht doppelt updaten
  if (before.status !== "paid") {
    await pb.collection("donations").update(donationId, {
      status: "paid",
      paid_at: paidAt,
    });
  }

  const betragCents =
    Number(before.amount_cents) ||
    Math.round(Number(before.amount || 0) * 100) ||
    0;
  if (betragCents < 1) {
    throw new Error(`markDonationPaidAndEmit: donation ${donationId} has betrag_cents < 1`);
  }

  const { kontoTyp, zahlungskanal } = donationToKontoChannel(before);

  try {
    return await createIncome({
      mosqueId,
      sourceCollection: "donations",
      sourceType: "donation",
      sourceId: donationId,
      externalEventId: options.externalEventId,
      betragCents,
      kategorie: mapDonationToEUR(String(before.category || "")),
      kontoTyp,
      zahlungskanal,
      occurredAt: paidAt,
      payload: {
        source_status: "paid",
        category: before.category || null,
        provider: String(before.provider || "manual"),
        payment_method: before.payment_method_detail
          ? String(before.payment_method_detail)
          : null,
      },
      ctx: options.ctx,
    });
  } catch (e) {
    // Append-only: donations bleibt paid; Sweeper fängt nach.
    await safeAudit({
      mosqueId,
      action: "finance.emit_failed",
      entityType: "donation",
      entityId: donationId,
      context: {
        error: String((e as Error)?.message || e),
        backfill: options.ctx?.backfill,
        webhook: options.ctx?.webhook,
      },
    });
    throw e;
  }
}

// --- Helpers ---

function mapRecord(r: RecordModel): Donation {
  return {
    id: r.id,
    mosque_id: r.mosque_id || "",
    campaign_id: r.campaign_id || "",
    donor_type: r.donor_type || "guest",
    user_id: r.user_id || "",
    donor_name: r.donor_name || "",
    donor_email: r.donor_email || "",
    amount: r.amount || 0,
    amount_cents: r.amount_cents || Math.round((r.amount || 0) * 100),
    currency: r.currency || "EUR",
    is_recurring: r.is_recurring || false,
    subscription_id: r.subscription_id || "",
    provider: r.provider || "manual",
    provider_ref: r.provider_ref || "",
    payment_method_detail: r.payment_method_detail || "",
    status: r.status || "pending",
    paid_at: r.paid_at || "",
    created: r.created || "",
    updated: r.updated || "",
  };
}

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DonationWithMeta extends Donation {
  campaign_title?: string;
  donor_display?: string; // donor_name || donor_email || "Anonym"
}

// --- Abfragen ---

export interface GetDonationsOptions {
  status?: "all" | "paid" | "pending" | "created" | "failed" | "refunded" | "cancelled" | "disputed";
  campaign_id?: string;
  provider?: "all" | "stripe" | "sepa" | "paypal_link" | "external" | "manual";
  search?: string; // donor_name oder donor_email
  is_recurring?: "all" | "yes" | "no";
  orderBy?: "paid_at" | "donor_name" | "amount_cents";
  orderDirection?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface DonationsPage {
  items: DonationWithMeta[];
  totalItems: number;
  totalPages: number;
  page: number;
  /** Gesamtbetrag der gefilterten bezahlten Spenden in Cents */
  totalPaidCents: number;
}

/**
 * Alle Spenden einer Moschee laden (Admin, paginiert + filterbar).
 */
export async function getDonationsByMosque(
  mosqueId: string,
  options: GetDonationsOptions = {}
): Promise<ActionResult<DonationsPage>> {
  try {
    const pb = await getAdminPB();
    const page = options.page || 1;
    const limit = options.limit || 25;

    const filters: string[] = [`mosque_id = "${mosqueId}"`];
    if (options.status && options.status !== "all") {
      filters.push(`status = "${options.status}"`);
    }
    if (options.campaign_id) {
      filters.push(`campaign_id = "${options.campaign_id}"`);
    }
    if (options.provider && options.provider !== "all") {
      filters.push(`provider = "${options.provider}"`);
    }
    if (options.search?.trim()) {
      const q = options.search.trim().replace(/"/g, '\\"');
      filters.push(`(donor_name ~ "${q}" || donor_email ~ "${q}")`);
    }
    if (options.is_recurring === "yes") {
      filters.push(`is_recurring = true`);
    } else if (options.is_recurring === "no") {
      filters.push(`is_recurring = false`);
    }

    const sortField = options.orderBy ?? "paid_at";
    const sortDir = options.orderDirection === "asc" ? "" : "-";
    const sort = `${sortDir}${sortField}`;

    const records = await pb.collection("donations").getList(page, limit, {
      filter: filters.join(" && "),
      sort,
      expand: "campaign_id",
    });

    // Kampagnennamen aus expand holen
    const items: DonationWithMeta[] = records.items.map((r) => {
      const donation = mapRecord(r);
      return {
        ...donation,
        campaign_title: r.expand?.campaign_id?.title || "",
        donor_display:
          donation.donor_name ||
          donation.donor_email ||
          "Anonym",
      };
    });

    // Gesamtbetrag der bezahlten Spenden (im aktuellen Filter)
    let totalPaidCents = 0;
    try {
      const paidFilter = [...filters];
      if (!paidFilter.some((f) => f.includes("status ="))) {
        paidFilter.push(`status = "paid"`);
      }
      const allPaid = await pb.collection("donations").getFullList({
        filter: paidFilter.join(" && "),
        fields: "amount_cents,amount",
      });
      totalPaidCents = allPaid.reduce(
        (sum, r) => sum + (r.amount_cents || Math.round((r.amount || 0) * 100)),
        0
      );
    } catch {
      // Summe nicht verfügbar → ignorieren
    }

    return {
      success: true,
      data: {
        items,
        totalItems: records.totalItems,
        totalPages: records.totalPages,
        page: records.page,
        totalPaidCents,
      },
    };
  } catch (error) {
    console.error("[Donations] Fehler beim Laden:", error);
    return { success: false, error: "Spenden konnten nicht geladen werden" };
  }
}

/**
 * Spenden-KPIs für das Admin-Dashboard.
 */
export interface DonationKPIs {
  totalPaidCents: number;       // Gesamt bezahlt (all-time)
  thisMonthCents: number;       // Diesen Monat bezahlt
  donorCount: number;           // Anzahl einzigartiger Spender (paid)
  pendingCount: number;         // Offene Zahlungen
  pendingCents: number;         // Offener Betrag
}

export async function getDonationKPIs(
  mosqueId: string
): Promise<ActionResult<DonationKPIs>> {
  try {
    const pb = await getAdminPB();
    const base = `mosque_id = "${mosqueId}"`;

    // Alle bezahlten Spenden
    const paid = await pb.collection("donations").getFullList({
      filter: `${base} && status = "paid"`,
      fields: "amount_cents,amount,donor_email,paid_at",
    });

    const totalPaidCents = paid.reduce(
      (sum, r) => sum + (r.amount_cents || Math.round((r.amount || 0) * 100)),
      0
    );

    const uniqueDonors = new Set(paid.map((r) => r.donor_email || r.id));

    // Diesen Monat
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thisMonthCents = paid
      .filter((r) => r.paid_at >= firstOfMonth)
      .reduce(
        (sum, r) => sum + (r.amount_cents || Math.round((r.amount || 0) * 100)),
        0
      );

    // Offene Zahlungen
    const pending = await pb.collection("donations").getFullList({
      filter: `${base} && (status = "pending" || status = "created")`,
      fields: "amount_cents,amount",
    });
    const pendingCents = pending.reduce(
      (sum, r) => sum + (r.amount_cents || Math.round((r.amount || 0) * 100)),
      0
    );

    return {
      success: true,
      data: {
        totalPaidCents,
        thisMonthCents,
        donorCount: uniqueDonors.size,
        pendingCount: pending.length,
        pendingCents,
      },
    };
  } catch (error) {
    console.error("[Donations] KPI-Fehler:", error);
    return { success: false, error: "KPIs konnten nicht geladen werden" };
  }
}

// --- Schreiben ---

/**
 * Status einer Spende ändern (z.B. pending → paid für Banküberweisung).
 */
export async function updateDonationStatus(
  donationId: string,
  mosqueId: string,
  adminUserId: string,
  newStatus: "paid" | "failed" | "refunded" | "cancelled"
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();

    const record = await pb.collection("donations").getOne(donationId);
    if (record.mosque_id !== mosqueId) {
      return { success: false, error: "Spende nicht gefunden" };
    }

    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === "paid" && !record.paid_at) {
      updateData.paid_at = new Date().toISOString();
    }

    // F4: Lock-Allowlist-Guard. Status-Wechsel ist finanzwirksam → blockiert
    // sobald is_financially_locked=true. Ausnahme: paid → refunded läuft via
    // Refund-Pfad (Sprint 5), nicht via diese Funktion.
    assertDonationEditAllowed(record, updateData);

    await pb.collection("donations").update(donationId, updateData);

    // Sprint 2 (F2): Wenn auf "paid" gewechselt → income_received-Event emittieren.
    // Bei Fehler: status bleibt paid (Sweeper holt nach).
    if (newStatus === "paid") {
      const paidAt = (updateData.paid_at as string) || record.paid_at || new Date().toISOString();
      try {
        await markDonationPaidAndEmit(donationId, paidAt, { mosqueIdHint: mosqueId });
      } catch (e) {
        console.error("[Donations] mark-paid emit fehlgeschlagen (Sweeper holt nach):", e);
      }
    }

    await logAudit({
      mosqueId,
      userId: adminUserId,
      action: "donation.status_changed",
      entityType: "donation",
      entityId: donationId,
      details: {
        old_status: record.status,
        new_status: newStatus,
        amount_cents: record.amount_cents,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[Donations] Status-Fehler:", error);
    return { success: false, error: "Status konnte nicht geändert werden" };
  }
}

/**
 * Manuelle Spende erfassen (Bar, Überweisung, Sonstiges).
 */
export async function createManualDonation(
  mosqueId: string,
  adminUserId: string,
  data: {
    donor_name: string;
    donor_email?: string;
    amount_cents: number;
    campaign_id?: string;
    notes?: string;
    paid_at?: string; // ISO-String, default jetzt
    payment_method?: "bar" | "ueberweisung" | "sonstige";
  }
): Promise<ActionResult<Donation>> {
  try {
    if (!data.amount_cents || data.amount_cents < 1) {
      return { success: false, error: "Betrag muss mindestens 0,01 € sein" };
    }

    const pb = await getAdminPB();

    const record = await pb.collection("donations").create({
      mosque_id: mosqueId,
      campaign_id: data.campaign_id || "",
      donor_type: "guest",
      donor_name: data.donor_name || "",
      donor_email: data.donor_email || "",
      amount: data.amount_cents / 100,
      amount_cents: data.amount_cents,
      currency: "EUR",
      is_recurring: false,
      provider: "manual",
      provider_ref: data.notes || "",
      // Steuert Finance-Kanal-Mapping (donationToKontoChannel): bar→cash/bar,
      // ueberweisung→bank/ueberweisung, sonst→bank/sonstige. Default Überweisung.
      payment_method_detail: data.payment_method || "ueberweisung",
      status: "paid",
      paid_at: data.paid_at || new Date().toISOString(),
    });

    await logAudit({
      mosqueId,
      userId: adminUserId,
      action: "donation.created",
      entityType: "donation",
      entityId: record.id,
      details: {
        amount_cents: data.amount_cents,
        provider: "manual",
        donor_name: data.donor_name,
        campaign_id: data.campaign_id || null,
      },
    });

    // Sprint 2 (F2): Manuelle Spende ist direkt paid → income_received-Event emittieren.
    // Fehler hier nicht zurückrollen (Append-only; Sweeper holt nach).
    try {
      await markDonationPaidAndEmit(
        record.id,
        record.paid_at || data.paid_at || new Date().toISOString(),
        { mosqueIdHint: mosqueId }
      );
    } catch (e) {
      console.error("[Donations] manual-create emit fehlgeschlagen (Sweeper holt nach):", e);
    }

    return { success: true, data: mapRecord(record) };
  } catch (error) {
    console.error("[Donations] Erstellungsfehler:", error);
    return { success: false, error: "Spende konnte nicht erfasst werden" };
  }
}

// --- Chart / KPI Data ---

export async function getDonationChartData(mosqueId: string): Promise<{
  byMonth: { month: string; amountCents: number }[];
  byProvider: { provider: string; amountCents: number; count: number }[];
}> {
  try {
    const pb = await getAdminPB();
    const records = await pb.collection("donations").getFullList({
      filter: `mosque_id = "${mosqueId}" && status = "paid"`,
      fields: "id,created,paid_at,amount_cents,amount,provider",
    });

    const monthMap = new Map<string, number>();
    const providerMap = new Map<string, { amountCents: number; count: number }>();

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 11);
    cutoff.setDate(1);
    cutoff.setHours(0, 0, 0, 0);

    records.forEach((r) => {
      const cents = r.amount_cents || Math.round((r.amount || 0) * 100);
      const d = new Date(r.paid_at || r.created);

      if (d >= cutoff) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthMap.set(key, (monthMap.get(key) || 0) + cents);
      }

      const p = r.provider || "manual";
      const existing = providerMap.get(p) || { amountCents: 0, count: 0 };
      providerMap.set(p, { amountCents: existing.amountCents + cents, count: existing.count + 1 });
    });

    const byMonth: { month: string; amountCents: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      d.setDate(1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonth.push({ month: key, amountCents: monthMap.get(key) || 0 });
    }

    const byProvider = Array.from(providerMap.entries()).map(([provider, v]) => ({
      provider,
      ...v,
    }));

    return { byMonth, byProvider };
  } catch (error) {
    console.error("[Donations] getDonationChartData Fehler:", error);
    return { byMonth: [], byProvider: [] };
  }
}

// --- PayPal Intent Tracking (fire-and-forget) ---

/**
 * Erfasst einen PayPal-Weiterleitungsversuch in der DB.
 * Wird fire-and-forget aufgerufen — Fehler blockieren niemals den Redirect.
 * Status: "external" | Provider: "paypal_link"
 */
export async function recordPaypalIntent(data: {
  mosqueId: string;
  amountCents: number;
  currency?: string;
  donorName?: string;
  donorEmail?: string;
  donorType: "guest" | "member";
  userId?: string;
  campaignId?: string;
}): Promise<void> {
  // Guard: kein Tracking bei ungültigem Betrag
  if (!data.amountCents || data.amountCents < 100) return;

  try {
    const pb = await getAdminPB();
    const amount = Number((data.amountCents / 100).toFixed(2));

    await pb.collection("donations").create({
      mosque_id: data.mosqueId,
      campaign_id: data.campaignId || "",
      donor_type: data.donorType,
      user_id: data.userId || "",
      donor_name: data.donorName || "",
      donor_email: data.donorEmail || "",
      amount,
      amount_cents: data.amountCents,
      gross_amount_cents: data.amountCents,
      fee_covered: false,
      estimated_fee_cents: 0,
      currency: data.currency ?? "EUR",
      status: "external",
      provider: "paypal_link",
    });
  } catch (error) {
    // Nur loggen — niemals werfen (fire-and-forget)
    console.error("[PayPal Intent] Tracking fehlgeschlagen:", error);
  }
}
