"use server";

import Stripe from "stripe";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { logAudit } from "@/lib/audit";
import { normalizeEmail } from "@/lib/normalize-email";
import type { RecurringSubscription } from "@/types";
import type { RecordModel } from "pocketbase";

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

function mapSub(r: RecordModel): RecurringSubscription {
  return {
    id: r.id,
    mosque_id: r.mosque_id || "",
    donor_type: r.donor_type || "guest",
    user_id: r.user_id || "",
    donor_name: r.donor_name || "",
    donor_email: r.donor_email || "",
    campaign_id: r.campaign_id || "",
    amount_cents: r.amount_cents || 0,
    currency: r.currency || "EUR",
    interval: r.interval || "monthly",
    provider: r.provider || "stripe",
    provider_subscription_id: r.provider_subscription_id || "",
    status: r.status || "pending",
    started_at: r.started_at || "",
    cancelled_at: r.cancelled_at || "",
    provider_ref: r.provider_ref || "",
    cancel_at_period_end: r.cancel_at_period_end || false,
    current_period_end: r.current_period_end || "",
    last_payment_status: r.last_payment_status || "",
    last_payment_at: r.last_payment_at || "",
    disabled_by_setting: r.disabled_by_setting || false,
    created: r.created || "",
    updated: r.updated || "",
  };
}

// =========================================
// Admin: Liste (paginiert)
// =========================================

export interface GetSubscriptionsOptions {
  status?: "all" | "active" | "cancelled" | "pending" | "abandoned";
  search?: string;
  page?: number;
  limit?: number;
}

export async function getRecurringSubscriptionsByMosque(
  mosqueId: string,
  options: GetSubscriptionsOptions = {}
): Promise<ActionResult<{ items: RecurringSubscription[]; totalItems: number; totalPages: number; page: number }>> {
  try {
    const pb = await getAdminPB();
    const page = options.page || 1;
    const limit = options.limit || 25;

    const filters: string[] = [`mosque_id = "${mosqueId}"`];
    if (options.status && options.status !== "all") {
      filters.push(`status = "${options.status}"`);
    }
    if (options.search?.trim()) {
      const q = options.search.trim().replace(/"/g, '\\"');
      filters.push(`(donor_email ~ "${q}" || donor_name ~ "${q}")`);
    }

    const res = await pb.collection("recurring_subscriptions").getList(page, limit, {
      filter: filters.join(" && "),
      sort: "-created",
    });

    return {
      success: true,
      data: {
        items: res.items.map(mapSub),
        totalItems: res.totalItems,
        totalPages: res.totalPages,
        page: res.page,
      },
    };
  } catch (error) {
    console.error("[recurring-donations] getRecurringSubscriptionsByMosque:", error);
    return { success: false, error: "Daueraufträge konnten nicht geladen werden." };
  }
}

// =========================================
// KPIs
// =========================================

export interface RecurringKPIs {
  activeCount: number;
  mrrCents: number;
  mrrHealthyCents: number;
  failedCount: number;
  cancelledCount: number;
}

export async function getRecurringKPIs(mosqueId: string): Promise<ActionResult<RecurringKPIs>> {
  try {
    const pb = await getAdminPB();
    const f = `mosque_id = "${mosqueId}"`;

    const active = await pb.collection("recurring_subscriptions").getFullList({
      filter: `${f} && status = "active"`,
      fields: "amount_cents,last_payment_status",
    });
    const cancelled = await pb.collection("recurring_subscriptions").getList(1, 1, {
      filter: `${f} && status = "cancelled"`,
      fields: "id",
    });

    let mrrCents = 0;
    let mrrHealthyCents = 0;
    let failedCount = 0;
    active.forEach((s) => {
      const c = s.amount_cents || 0;
      mrrCents += c;
      if (s.last_payment_status === "failed") {
        failedCount++;
      } else {
        mrrHealthyCents += c;
      }
    });

    return {
      success: true,
      data: {
        activeCount: active.length,
        mrrCents,
        mrrHealthyCents,
        failedCount,
        cancelledCount: cancelled.totalItems,
      },
    };
  } catch (error) {
    console.error("[recurring-donations] getRecurringKPIs:", error);
    return { success: false, error: "KPIs konnten nicht geladen werden." };
  }
}

// =========================================
// Member: Meine Subscriptions
// =========================================

export async function getMySubscriptions(
  userId: string,
  mosqueId: string
): Promise<ActionResult<RecurringSubscription[]>> {
  try {
    const pb = await getAdminPB();
    const res = await pb.collection("recurring_subscriptions").getFullList({
      filter: `mosque_id = "${mosqueId}" && user_id = "${userId}"`,
      sort: "-created",
    });
    return { success: true, data: res.map(mapSub) };
  } catch (error) {
    console.error("[recurring-donations] getMySubscriptions:", error);
    return { success: false, error: "Daueraufträge konnten nicht geladen werden." };
  }
}

// =========================================
// Cancel (Member OR Admin) — Periodenende
// =========================================

async function cancelInternal(
  subscriptionId: string,
  mosqueId: string,
  actorUserId: string,
  actorRole: "admin" | "member",
  immediate: boolean
): Promise<ActionResult> {
  const pb = await getAdminPB();
  let sub;
  try {
    sub = await pb.collection("recurring_subscriptions").getOne(subscriptionId);
  } catch {
    return { success: false, error: "Dauerauftrag nicht gefunden." };
  }

  if (sub.mosque_id !== mosqueId) {
    return { success: false, error: "Zugriff verweigert." };
  }
  if (actorRole !== "admin" && sub.user_id !== actorUserId) {
    return { success: false, error: "Zugriff verweigert." };
  }
  if (sub.status === "cancelled") {
    return { success: true };
  }
  if (!immediate && sub.cancel_at_period_end) {
    return { success: true };
  }
  if (!sub.provider_subscription_id) {
    return { success: false, error: "Keine Stripe-Subscription verknüpft." };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return { success: false, error: "Stripe nicht konfiguriert." };
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

  try {
    if (immediate) {
      await stripe.subscriptions.cancel(sub.provider_subscription_id);
      await pb.collection("recurring_subscriptions").update(subscriptionId, {
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      });
    } else {
      await stripe.subscriptions.update(sub.provider_subscription_id, {
        cancel_at_period_end: true,
      });
      await pb.collection("recurring_subscriptions").update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }
  } catch (e) {
    console.error("[recurring-donations] stripe cancel:", e);
    return { success: false, error: "Kündigung fehlgeschlagen." };
  }

  await logAudit({
    mosqueId,
    userId: actorUserId,
    action: "donation_subscription.cancelled",
    entityType: "recurring_subscription",
    entityId: subscriptionId,
    after: {
      actor_role: actorRole,
      reason: immediate ? "immediate" : "period_end",
      current_period_end: sub.current_period_end,
    },
  });

  return { success: true };
}

export async function cancelRecurringSubscription(
  subscriptionId: string,
  mosqueId: string,
  actorUserId: string,
  actorRole: "admin" | "member"
): Promise<ActionResult> {
  return cancelInternal(subscriptionId, mosqueId, actorUserId, actorRole, false);
}

export async function cancelRecurringSubscriptionImmediately(
  subscriptionId: string,
  mosqueId: string,
  actorUserId: string,
  actorRole: "admin" | "member"
): Promise<ActionResult> {
  return cancelInternal(subscriptionId, mosqueId, actorUserId, actorRole, true);
}

// =========================================
// Spender-Übersicht
// =========================================

export interface DonorOverviewRow {
  key: string;
  donor_type: "member" | "guest";
  user_id?: string;
  donor_email: string;
  donor_name: string;
  total_cents: number;
  donation_count: number;
  last_paid_at: string;
  active_subscription_id?: string;
  active_subscription_amount_cents: number;
  active_subscription_last_payment_status?: "paid" | "failed" | "pending" | "";
}

export interface DonorOverviewKPIs {
  totalDonors: number;
  totalCents: number;
  activeSubscriptions: number;
  mrrCents: number;
}

export interface DonorOverview {
  rows: DonorOverviewRow[];
  kpis: DonorOverviewKPIs;
}

export interface DonorOverviewOptions {
  year?: number | "all";
  month?: number | "all"; // 1-12
}

function computeRange(opts: DonorOverviewOptions): { start?: string; end?: string } {
  if (opts.year === "all" || opts.year == null) return {};
  const y = opts.year;
  if (opts.month === "all" || opts.month == null) {
    return {
      start: new Date(Date.UTC(y, 0, 1)).toISOString(),
      end: new Date(Date.UTC(y, 11, 31, 23, 59, 59)).toISOString(),
    };
  }
  const m = opts.month - 1;
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59));
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function getDonorOverview(
  mosqueId: string,
  opts: DonorOverviewOptions
): Promise<ActionResult<DonorOverview>> {
  try {
    const pb = await getAdminPB();
    const { start, end } = computeRange(opts);

    const filters: string[] = [`mosque_id = "${mosqueId}"`, `status = "paid"`];
    if (start) filters.push(`paid_at >= "${start}"`);
    if (end) filters.push(`paid_at <= "${end}"`);

    const donations = await pb.collection("donations").getFullList({
      filter: filters.join(" && "),
      sort: "-paid_at",
      batch: 500,
      fields: "user_id,donor_type,donor_email,donor_name,amount_cents,amount,paid_at",
    });

    const rowsMap = new Map<string, DonorOverviewRow>();
    donations.forEach((d) => {
      const email = normalizeEmail(d.donor_email);
      const key = d.user_id ? `member:${d.user_id}` : `guest:${email}`;
      const cents = d.amount_cents || Math.round((d.amount || 0) * 100);
      const existing = rowsMap.get(key);
      if (existing) {
        existing.total_cents += cents;
        existing.donation_count++;
        if (d.paid_at > existing.last_paid_at) existing.last_paid_at = d.paid_at;
        if (!existing.donor_name && d.donor_name) existing.donor_name = d.donor_name;
      } else {
        rowsMap.set(key, {
          key,
          donor_type: d.donor_type || "guest",
          user_id: d.user_id || undefined,
          donor_email: d.donor_email || "",
          donor_name: d.donor_name || "",
          total_cents: cents,
          donation_count: 1,
          last_paid_at: d.paid_at || "",
          active_subscription_amount_cents: 0,
        });
      }
    });

    // Aktive Subs joinen
    const activeSubs = await pb.collection("recurring_subscriptions").getFullList({
      filter: `mosque_id = "${mosqueId}" && status = "active"`,
      fields: "id,user_id,donor_email,amount_cents,last_payment_status",
    });

    let activeSubCount = 0;
    let mrrCents = 0;
    activeSubs.forEach((s) => {
      activeSubCount++;
      mrrCents += s.amount_cents || 0;
      const email = normalizeEmail(s.donor_email);
      const key = s.user_id ? `member:${s.user_id}` : `guest:${email}`;
      const row = rowsMap.get(key);
      if (row) {
        row.active_subscription_id = s.id;
        row.active_subscription_amount_cents = s.amount_cents || 0;
        row.active_subscription_last_payment_status = s.last_payment_status || "";
      } else {
        // Sub ohne Historie im Zeitraum → Row mit 0 anlegen
        rowsMap.set(key, {
          key,
          donor_type: s.user_id ? "member" : "guest",
          user_id: s.user_id || undefined,
          donor_email: s.donor_email || "",
          donor_name: "",
          total_cents: 0,
          donation_count: 0,
          last_paid_at: "",
          active_subscription_id: s.id,
          active_subscription_amount_cents: s.amount_cents || 0,
          active_subscription_last_payment_status: s.last_payment_status || "",
        });
      }
    });

    const rows = Array.from(rowsMap.values()).sort((a, b) => b.total_cents - a.total_cents);
    const totalCents = rows.reduce((s, r) => s + r.total_cents, 0);

    return {
      success: true,
      data: {
        rows,
        kpis: {
          totalDonors: rows.filter((r) => r.donation_count > 0).length,
          totalCents,
          activeSubscriptions: activeSubCount,
          mrrCents,
        },
      },
    };
  } catch (error) {
    console.error("[recurring-donations] getDonorOverview:", error);
    return { success: false, error: "Spender-Übersicht konnte nicht geladen werden." };
  }
}

// =========================================
// Cleanup verwaister pending-Subs
// =========================================

export async function cleanupAbandonedPendingSubscriptions(
  olderThanHours = 24
): Promise<ActionResult<{ deleted: number; synced: number }>> {
  try {
    const pb = await getAdminPB();
    const cutoff = new Date(Date.now() - olderThanHours * 3600 * 1000).toISOString();

    const pending = await pb.collection("recurring_subscriptions").getFullList({
      filter: `status = "pending" && created < "${cutoff}"`,
    });

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2024-06-20" }) : null;

    let abandoned = 0;
    let synced = 0;
    for (const sub of pending) {
      if (sub.provider_ref && stripe) {
        // provider_ref = checkout session ID → Stripe-Check
        try {
          const session = await stripe.checkout.sessions.retrieve(sub.provider_ref);
          if (session.status === "complete" || session.status === "open") {
            // Session noch aktiv oder bereits abgeschlossen → webhook kommt noch / schon verarbeitet
            synced++;
            continue;
          }
          // Session expired/cancelled → abandoned
        } catch {
          // Session unbekannt → abandoned
        }
      } else if (sub.provider_subscription_id && stripe) {
        // Fallback: direkt Subscription prüfen
        try {
          const stripeSub = await stripe.subscriptions.retrieve(sub.provider_subscription_id);
          await pb.collection("recurring_subscriptions").update(sub.id, {
            status: stripeSub.status === "active" ? "active" : sub.status,
            current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
          });
          synced++;
          continue;
        } catch {
          // unbekannt → abandoned
        }
      }
      // Nicht löschen — als abandoned markieren (kein Datenverlust)
      await pb.collection("recurring_subscriptions").update(sub.id, {
        status: "abandoned",
      });
      abandoned++;
    }

    return { success: true, data: { deleted: abandoned, synced } };
  } catch (error) {
    console.error("[recurring-donations] cleanupAbandonedPendingSubscriptions:", error);
    return { success: false, error: "Cleanup fehlgeschlagen." };
  }
}

// =========================================
// CSV-Export: Spender-Übersicht
// =========================================

function csvEscape(v: string | number | undefined | null): string {
  const s = v == null ? "" : String(v);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function exportDonorOverviewCSV(
  mosqueId: string,
  opts: DonorOverviewOptions
): Promise<ActionResult<{ filename: string; content: string }>> {
  const overview = await getDonorOverview(mosqueId, opts);
  if (!overview.success || !overview.data) {
    return { success: false, error: overview.error };
  }

  const header = [
    "Name",
    "Email",
    "Typ",
    "Total EUR (Zeitraum)",
    "# Spenden (Zeitraum)",
    "Letzte Spende",
    "Dauerauftrag EUR/Monat",
    "Subscription-Status",
  ];
  const lines = [header.join(",")];
  overview.data.rows.forEach((r) => {
    lines.push(
      [
        csvEscape(r.donor_name),
        csvEscape(r.donor_email),
        csvEscape(r.donor_type),
        csvEscape((r.total_cents / 100).toFixed(2)),
        csvEscape(r.donation_count),
        csvEscape(r.last_paid_at),
        csvEscape(r.active_subscription_amount_cents ? (r.active_subscription_amount_cents / 100).toFixed(2) : ""),
        csvEscape(r.active_subscription_last_payment_status || ""),
      ].join(",")
    );
  });

  const year = opts.year === "all" || opts.year == null ? "all" : opts.year;
  const month = opts.month === "all" || opts.month == null ? "all" : String(opts.month).padStart(2, "0");
  const filename = `spender-${year}-${month}.csv`;
  // UTF-8 BOM für Excel
  return { success: true, data: { filename, content: "\uFEFF" + lines.join("\n") } };
}

// =========================================
// CSV-Export: Spenden-Transaktionen
// =========================================

export async function exportDonationsCSV(
  mosqueId: string,
  opts: DonorOverviewOptions & { is_recurring?: "all" | "yes" | "no" }
): Promise<ActionResult<{ filename: string; content: string }>> {
  try {
    const pb = await getAdminPB();
    const { start, end } = computeRange(opts);

    const filters: string[] = [`mosque_id = "${mosqueId}"`];
    if (start) filters.push(`paid_at >= "${start}"`);
    if (end) filters.push(`paid_at <= "${end}"`);
    if (opts.is_recurring === "yes") filters.push(`is_recurring = true`);
    else if (opts.is_recurring === "no") filters.push(`is_recurring = false`);

    const rows = await pb.collection("donations").getFullList({
      filter: filters.join(" && "),
      sort: "-created",
      batch: 500,
      expand: "campaign_id",
    });

    const header = [
      "Erstellt",
      "Bezahlt am",
      "Spender",
      "Email",
      "Betrag EUR",
      "Quelle",
      "Kampagne",
      "Provider",
      "Status",
      "Provider-Ref",
    ];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      lines.push(
        [
          csvEscape(r.created),
          csvEscape(r.paid_at),
          csvEscape(r.donor_name),
          csvEscape(r.donor_email),
          csvEscape(((r.amount_cents || Math.round((r.amount || 0) * 100)) / 100).toFixed(2)),
          csvEscape(r.is_recurring ? "Abo" : "einmalig"),
          csvEscape(r.expand?.campaign_id?.title || ""),
          csvEscape(r.provider),
          csvEscape(r.status),
          csvEscape(r.provider_ref),
        ].join(",")
      );
    });

    const year = opts.year === "all" || opts.year == null ? "all" : opts.year;
    const month = opts.month === "all" || opts.month == null ? "all" : String(opts.month).padStart(2, "0");
    return {
      success: true,
      data: { filename: `spenden-${year}-${month}.csv`, content: "\uFEFF" + lines.join("\n") },
    };
  } catch (error) {
    console.error("[recurring-donations] exportDonationsCSV:", error);
    return { success: false, error: "Export fehlgeschlagen." };
  }
}
