"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { logAudit } from "@/lib/audit";
import type { RecordModel } from "pocketbase";
import type {
  MembershipFee,
  MembershipFeeConfig,
  MembershipInterval,
  User,
} from "@/types";
import {
  canTransition,
  deriveBulkPeriod,
  type MembershipFeeStatus,
  type TransitionSource,
} from "@/lib/membership-period";

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

type AdminPB = Awaited<ReturnType<typeof getAdminPB>>;

// PB-Record-IDs sind 15-stellig alphanumerisch. Guard gegen Filter-Injection
// (Werte gehen interpoliert in PB-Filter — IDs/Keys strikt prüfen).
function safeId(v: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(v)) throw new Error("Ungültige ID");
  return v;
}
function safePeriodKey(v: string): string {
  if (!/^[0-9]{4}(-(Q[1-4]|[0-1][0-9]))?$/.test(v))
    throw new Error("Ungültiger period_key");
  return v;
}

function mapConfig(r: RecordModel): MembershipFeeConfig {
  return {
    id: r.id,
    mosque_id: r.mosque_id || "",
    user_id: r.user_id || "",
    amount_cents: r.amount_cents || 0,
    interval: (r.interval as MembershipInterval) || "monthly",
    currency: r.currency || "EUR",
    active: r.active ?? true,
    exempt: r.exempt ?? false,
    exempt_until: r.exempt_until || "",
    version: r.version || 1,
    effective_from: r.effective_from || "",
    superseded_at: r.superseded_at || "",
    notes: r.notes || "",
    created_by: r.created_by || "",
    created: r.created || "",
    updated: r.updated || "",
  };
}

function mapFee(r: RecordModel): MembershipFee {
  return {
    id: r.id,
    mosque_id: r.mosque_id || "",
    user_id: r.user_id || "",
    membership_fee_config_id: r.membership_fee_config_id || "",
    recurring_subscription_id: r.recurring_subscription_id || "",
    period_key: r.period_key || "",
    period_start: r.period_start || "",
    period_end: r.period_end || "",
    period_bucket_id: r.period_bucket_id || "",
    amount_cents: r.amount_cents || 0,
    currency: r.currency || "EUR",
    interval: (r.interval as MembershipInterval) || "monthly",
    status: (r.status as MembershipFee["status"]) || "open",
    payment_method: (r.payment_method as MembershipFee["payment_method"]) || "",
    paid_at: r.paid_at || "",
    provider_ref: r.provider_ref || "",
    provider_invoice_status: r.provider_invoice_status || "",
    source: (r.source as MembershipFee["source"]) || "manual",
    waived_reason: r.waived_reason || "",
    waived_by: r.waived_by || "",
    waived_at: r.waived_at || "",
    billing_cycle_anchor: r.billing_cycle_anchor || "",
    cycle_index: r.cycle_index || 0,
    stripe_invoice_created: r.stripe_invoice_created || 0,
    ledger_version: r.ledger_version || 1,
    notes: r.notes || "",
    created_by: r.created_by || "",
    created: r.created || "",
    updated: r.updated || "",
  };
}

// --- Config-Helper (einzige Zugriffswege auf membership_fee_configs) ---

/** Aktuell gültige Config-Version (superseded_at == ""). Regel 20. */
export async function getActiveConfig(
  mosqueId: string,
  userId: string
): Promise<MembershipFeeConfig | null> {
  const pb = await getAdminPB();
  try {
    const r = await pb
      .collection("membership_fee_configs")
      .getFirstListItem(
        `mosque_id = "${safeId(mosqueId)}" && user_id = "${safeId(userId)}" && superseded_at = ""`
      );
    return mapConfig(r);
  } catch {
    return null;
  }
}

/** Config-Version, die zum gegebenen Zeitpunkt galt (Snapshot-Determinismus, Regel 14). */
export async function getConfigAtDate(
  mosqueId: string,
  userId: string,
  dateIso: string
): Promise<MembershipFeeConfig | null> {
  const pb = await getAdminPB();
  const list = await pb.collection("membership_fee_configs").getFullList({
    filter: `mosque_id = "${safeId(mosqueId)}" && user_id = "${safeId(userId)}"`,
    sort: "-version",
  });
  const t = new Date(dateIso).getTime();
  for (const r of list) {
    const c = mapConfig(r);
    const from = c.effective_from ? new Date(c.effective_from).getTime() : 0;
    const until = c.superseded_at ? new Date(c.superseded_at).getTime() : Infinity;
    if (from <= t && t < until) return c;
  }
  return null;
}

/** Deterministische Snapshot-Quelle für ensureMembershipFeePeriod (Regel 14/29). */
export async function resolveMembershipFeeSnapshot(
  mosqueId: string,
  userId: string,
  periodStartIso: string
): Promise<{
  amount_cents: number;
  interval: MembershipInterval;
  currency: string;
  membership_fee_config_id: string;
} | null> {
  const cfg =
    (await getConfigAtDate(mosqueId, userId, periodStartIso)) ||
    (await getActiveConfig(mosqueId, userId));
  if (!cfg) return null;
  return {
    amount_cents: cfg.amount_cents,
    interval: cfg.interval,
    currency: cfg.currency || "EUR",
    membership_fee_config_id: cfg.id,
  };
}

/** Aktiv-befreit wenn exempt && (exempt_until leer || in Zukunft). */
function isExemptNow(c: MembershipFeeConfig): boolean {
  if (!c.exempt) return false;
  if (!c.exempt_until) return true;
  return new Date(c.exempt_until).getTime() >= Date.now();
}

async function hasActiveMembershipSub(
  pb: AdminPB,
  mosqueId: string,
  userId: string
): Promise<boolean> {
  try {
    const list = await pb.collection("recurring_subscriptions").getFullList({
      filter:
        `mosque_id = "${safeId(mosqueId)}" && user_id = "${safeId(userId)}" && ` +
        `subscription_type = "membership_fee" && ` +
        `(status = "active" || status = "pending" || status = "past_due" || status = "incomplete")`,
    });
    return list.length > 0;
  } catch {
    return false;
  }
}

// --- Zentrale Upsert-Funktion (Webhook + Admin-Bulk, eine Wahrheit) ---

export interface EnsurePeriodArgs {
  mosqueId: string;
  userId: string;
  periodBucketId: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  interval: MembershipInterval;
  billingCycleAnchor: string;
  cycleIndex: number;
  source: MembershipFee["source"];
  recurringSubscriptionId?: string;
}

/**
 * Idempotenter Upsert pro Periode. Race-/Idempotenz-Schutz NUR über
 * UNIQUE period_bucket_id (insert-and-catch-conflict). Regel 12/16/56.
 * Gibt IMMER den persistierten Ledger-Record zurück (Regel: Rückgabevertrag).
 */
export async function ensureMembershipFeePeriod(
  args: EnsurePeriodArgs
): Promise<MembershipFee | null> {
  if (!(new Date(args.periodStart).getTime() < new Date(args.periodEnd).getTime())) {
    throw new Error("period_start >= period_end (Regel 53)");
  }
  const pb = await getAdminPB();

  const existing = await findByBucket(pb, args.periodBucketId);
  // Regel 56: existiert Record mit status != void → nie neuer Record.
  if (existing && existing.status !== "void") return existing;

  const snap = await resolveMembershipFeeSnapshot(
    args.mosqueId,
    args.userId,
    args.periodStart
  );
  if (!snap) return existing; // keine Config → keine Forderung

  const payload = {
    mosque_id: args.mosqueId,
    user_id: args.userId,
    membership_fee_config_id: snap.membership_fee_config_id,
    recurring_subscription_id: args.recurringSubscriptionId || "",
    period_key: args.periodKey,
    period_start: args.periodStart,
    period_end: args.periodEnd,
    period_bucket_id: args.periodBucketId,
    amount_cents: snap.amount_cents,
    currency: snap.currency,
    interval: args.interval,
    status: "open",
    payment_method: "",
    source: args.source,
    billing_cycle_anchor: args.billingCycleAnchor,
    cycle_index: args.cycleIndex,
    ledger_version: 1,
  };

  try {
    const created = await pb.collection("membership_fees").create(payload);
    return mapFee(created);
  } catch {
    // Race: paralleler Insert hat den UNIQUE-Bucket bereits belegt → nachladen.
    const after = await findByBucket(pb, args.periodBucketId);
    return after;
  }
}

async function findByBucket(
  pb: AdminPB,
  bucketId: string
): Promise<MembershipFee | null> {
  try {
    const r = await pb
      .collection("membership_fees")
      .getFirstListItem(`period_bucket_id = "${safeId(bucketId)}"`);
    return mapFee(r);
  } catch {
    return null;
  }
}

/** Status-Übergang mit Guard (Regel 13). Liefert aktualisierten Record oder null. */
export async function applyFeeTransition(args: {
  fee: MembershipFee;
  to: MembershipFeeStatus;
  source: TransitionSource;
  patch?: Record<string, unknown>;
}): Promise<MembershipFee | null> {
  if (!canTransition(args.fee.status, args.to, args.source)) return null;
  const pb = await getAdminPB();
  const r = await pb
    .collection("membership_fees")
    .update(args.fee.id, { status: args.to, ...(args.patch || {}) });
  return mapFee(r);
}

// --- Admin: Configs ---

export interface MembershipConfigRow {
  user: User;
  config: MembershipFeeConfig | null;
  hasActiveSub: boolean;
}

export async function getMembershipConfigs(
  mosqueId: string
): Promise<ActionResult<MembershipConfigRow[]>> {
  try {
    const pb = await getAdminPB();
    const users = await pb.collection("users").getFullList({
      filter: `mosque_id = "${safeId(mosqueId)}"`,
      sort: "last_name,first_name",
    });
    const configs = await pb.collection("membership_fee_configs").getFullList({
      filter: `mosque_id = "${safeId(mosqueId)}" && superseded_at = ""`,
    });
    const subs = await pb.collection("recurring_subscriptions").getFullList({
      filter:
        `mosque_id = "${safeId(mosqueId)}" && subscription_type = "membership_fee" && ` +
        `(status = "active" || status = "pending" || status = "past_due" || status = "incomplete")`,
    });
    const cfgByUser = new Map<string, MembershipFeeConfig>();
    configs.forEach((c) => cfgByUser.set(c.user_id, mapConfig(c)));
    const subUsers = new Set<string>();
    subs.forEach((s) => subUsers.add(s.user_id));

    const rows: MembershipConfigRow[] = users
      .filter((u) => u.role !== "super_admin")
      .map((u) => ({
        user: u as unknown as User,
        config: cfgByUser.get(u.id) || null,
        hasActiveSub: subUsers.has(u.id),
      }));
    return { success: true, data: rows };
  } catch (error) {
    console.error("[membership-fees] getMembershipConfigs:", error);
    return { success: false, error: "Konfigurationen konnten nicht geladen werden." };
  }
}

export async function upsertMembershipConfig(
  mosqueId: string,
  actorUserId: string,
  userId: string,
  data: {
    amount_cents: number;
    interval: MembershipInterval;
    currency?: string;
    active: boolean;
    exempt: boolean;
    exempt_until?: string;
    notes?: string;
  }
): Promise<ActionResult<MembershipFeeConfig>> {
  try {
    if (data.amount_cents < 100)
      return { success: false, error: "Mindestbetrag 1,00 €." };
    const pb = await getAdminPB();
    const currency = data.currency || "EUR";

    // bis zu 2 Versuche: bei UNIQUE(version)-Konflikt neu laden + retry (Regel 40/52)
    for (let attempt = 0; attempt < 2; attempt++) {
      const current = await getActiveConfig(mosqueId, userId);

      // Regel 32: aktive Sub sperrt amount/interval/currency
      if (current) {
        const wantsCritical =
          current.amount_cents !== data.amount_cents ||
          current.interval !== data.interval ||
          (current.currency || "EUR") !== currency;
        if (wantsCritical && (await hasActiveMembershipSub(pb, mosqueId, userId))) {
          return {
            success: false,
            error:
              "Betrag/Intervall/Währung sind gesperrt, solange eine aktive automatische Abbuchung besteht. Bitte zuerst kündigen.",
          };
        }
      }

      const now = new Date().toISOString();
      const nextVersion = current ? current.version + 1 : 1;

      // Regel 42: Overlap-Validierung (effective_from des Neuen == now,
      // bisherige aktuelle Version wird mit superseded_at=now geschlossen → kein Overlap).
      try {
        if (current) {
          await pb
            .collection("membership_fee_configs")
            .update(current.id, { superseded_at: now });
        }
        const rec = await pb.collection("membership_fee_configs").create({
          mosque_id: mosqueId,
          user_id: userId,
          amount_cents: data.amount_cents,
          interval: data.interval,
          currency,
          active: data.active,
          exempt: data.exempt,
          exempt_until: data.exempt_until || "",
          version: nextVersion,
          effective_from: now,
          superseded_at: "",
          notes: data.notes || "",
          created_by: actorUserId,
        });
        await logAudit({
          mosqueId,
          userId: actorUserId,
          action: "membership_config.updated",
          entityType: "membership_config",
          entityId: rec.id,
          before: current ? { version: current.version, amount_cents: current.amount_cents } : undefined,
          after: { version: nextVersion, amount_cents: data.amount_cents, interval: data.interval },
        });
        return { success: true, data: mapConfig(rec) };
      } catch (e) {
        if (attempt === 1) throw e;
        // Konflikt → nächster Versuch lädt aktuelle Version neu
      }
    }
    return { success: false, error: "Konfiguration konnte nicht gespeichert werden." };
  } catch (error) {
    console.error("[membership-fees] upsertMembershipConfig:", error);
    return { success: false, error: "Konfiguration konnte nicht gespeichert werden." };
  }
}

// --- Admin: Perioden-Übersicht + Bulk ---

export interface MembershipFeeOverviewRow {
  user: User;
  fee: MembershipFee | null;
  config: MembershipFeeConfig | null;
  hasActiveSub: boolean;
}

export async function getMembershipFeeOverview(
  mosqueId: string,
  periodKey: string
): Promise<ActionResult<MembershipFeeOverviewRow[]>> {
  try {
    safePeriodKey(periodKey);
    const pb = await getAdminPB();
    const users = await pb.collection("users").getFullList({
      filter: `mosque_id = "${safeId(mosqueId)}"`,
      sort: "last_name,first_name",
    });
    const fees = await pb.collection("membership_fees").getFullList({
      filter: `mosque_id = "${safeId(mosqueId)}" && period_key = "${periodKey}"`,
    });
    const configs = await pb.collection("membership_fee_configs").getFullList({
      filter: `mosque_id = "${safeId(mosqueId)}" && superseded_at = ""`,
    });
    const subs = await pb.collection("recurring_subscriptions").getFullList({
      filter:
        `mosque_id = "${safeId(mosqueId)}" && subscription_type = "membership_fee" && ` +
        `(status = "active" || status = "pending" || status = "past_due" || status = "incomplete")`,
    });
    const feeByUser = new Map<string, MembershipFee>();
    fees.forEach((f) => feeByUser.set(f.user_id, mapFee(f)));
    const cfgByUser = new Map<string, MembershipFeeConfig>();
    configs.forEach((c) => cfgByUser.set(c.user_id, mapConfig(c)));
    const subUsers = new Set<string>();
    subs.forEach((s) => subUsers.add(s.user_id));

    const rows: MembershipFeeOverviewRow[] = users
      .filter((u) => u.role !== "super_admin")
      .filter((u) => cfgByUser.has(u.id) || feeByUser.has(u.id))
      .map((u) => ({
        user: u as unknown as User,
        fee: feeByUser.get(u.id) || null,
        config: cfgByUser.get(u.id) || null,
        hasActiveSub: subUsers.has(u.id),
      }));
    return { success: true, data: rows };
  } catch (error) {
    console.error("[membership-fees] getMembershipFeeOverview:", error);
    return { success: false, error: "Übersicht konnte nicht geladen werden." };
  }
}

function refDateForPeriodKey(periodKey: string): Date {
  // YYYY | YYYY-Qn | YYYY-MM → erstes gültiges Datum innerhalb der Periode
  const y = parseInt(periodKey.slice(0, 4), 10);
  if (periodKey.length === 4) return new Date(Date.UTC(y, 0, 1));
  if (periodKey[5] === "Q") {
    const q = parseInt(periodKey[6], 10);
    return new Date(Date.UTC(y, (q - 1) * 3, 1));
  }
  const m = parseInt(periodKey.slice(5, 7), 10);
  return new Date(Date.UTC(y, m - 1, 1));
}

export async function createPeriodFees(
  mosqueId: string,
  actorUserId: string,
  periodKey: string
): Promise<ActionResult<{ created: number; skipped: number }>> {
  try {
    safePeriodKey(periodKey);
    const pb = await getAdminPB();
    const configs = await pb.collection("membership_fee_configs").getFullList({
      filter: `mosque_id = "${safeId(mosqueId)}" && superseded_at = "" && active = true`,
    });
    const ref = refDateForPeriodKey(periodKey);
    let created = 0;
    let skipped = 0;
    const skippedAuto: string[] = [];

    for (const cr of configs) {
      const cfg = mapConfig(cr);
      if (isExemptNow(cfg)) {
        skipped++;
        continue;
      }
      // Regel 22: Auto-Zahler überspringen (deren Perioden nur aus Stripe)
      if (await hasActiveMembershipSub(pb, mosqueId, cfg.user_id)) {
        skipped++;
        skippedAuto.push(cfg.user_id);
        continue;
      }
      const period = deriveBulkPeriod({
        interval: cfg.interval,
        ref,
        mosqueId,
        userId: cfg.user_id,
      });
      // Regel 44: keine rückwirkenden Forderungen vor effective_from
      if (
        cfg.effective_from &&
        new Date(period.period_start).getTime() <
          new Date(cfg.effective_from).getTime()
      ) {
        skipped++;
        continue;
      }
      const fee = await ensureMembershipFeePeriod({
        mosqueId,
        userId: cfg.user_id,
        periodBucketId: period.period_bucket_id,
        periodKey: period.period_key,
        periodStart: period.period_start,
        periodEnd: period.period_end,
        interval: period.interval,
        billingCycleAnchor: period.billing_cycle_anchor,
        cycleIndex: period.cycle_index,
        source: "admin_bulk",
      });
      if (fee) created++;
    }

    await logAudit({
      mosqueId,
      userId: actorUserId,
      action: "membership_fee.bulk_created",
      entityType: "membership_fees",
      entityId: periodKey,
      details: { period_key: periodKey, created, skipped },
    });
    if (skippedAuto.length > 0) {
      await logAudit({
        mosqueId,
        userId: actorUserId,
        action: "membership_fee.bulk_skipped_auto_subscription",
        entityType: "membership_fees",
        entityId: periodKey,
        details: { period_key: periodKey, user_ids: skippedAuto },
      });
    }
    return { success: true, data: { created, skipped } };
  } catch (error) {
    console.error("[membership-fees] createPeriodFees:", error);
    return { success: false, error: "Beiträge konnten nicht erstellt werden." };
  }
}

/** Manuelle Periode anlegen falls noch nicht existent (Regel 49). */
async function ensureManualPeriod(
  mosqueId: string,
  userId: string,
  periodKey: string
): Promise<MembershipFee | null> {
  const cfg = await getActiveConfig(mosqueId, userId);
  if (!cfg) return null;
  const period = deriveBulkPeriod({
    interval: cfg.interval,
    ref: refDateForPeriodKey(periodKey),
    mosqueId,
    userId,
  });
  return ensureMembershipFeePeriod({
    mosqueId,
    userId,
    periodBucketId: period.period_bucket_id,
    periodKey: period.period_key,
    periodStart: period.period_start,
    periodEnd: period.period_end,
    interval: period.interval,
    billingCycleAnchor: period.billing_cycle_anchor,
    cycleIndex: period.cycle_index,
    source: "manual",
  });
}

export async function markMembershipFeePaid(
  mosqueId: string,
  actorUserId: string,
  ref: { feeId: string } | { userId: string; periodKey: string },
  method: "cash" | "transfer",
  notes?: string
): Promise<ActionResult<MembershipFee>> {
  try {
    const pb = await getAdminPB();
    let fee: MembershipFee | null = null;
    if ("feeId" in ref) {
      const r = await pb.collection("membership_fees").getOne(safeId(ref.feeId));
      fee = mapFee(r);
    } else {
      safePeriodKey(ref.periodKey);
      fee = await ensureManualPeriod(mosqueId, ref.userId, ref.periodKey);
    }
    if (!fee || fee.mosque_id !== mosqueId)
      return { success: false, error: "Beitrag nicht gefunden." };
    const updated = await applyFeeTransition({
      fee,
      to: "paid",
      source: "manual",
      patch: {
        payment_method: method,
        paid_at: new Date().toISOString(),
        notes: notes || fee.notes,
      },
    });
    if (!updated)
      return { success: false, error: "Statuswechsel nicht erlaubt." };
    await logAudit({
      mosqueId,
      userId: actorUserId,
      action: "membership_fee.marked_paid",
      entityType: "membership_fees",
      entityId: updated.id,
      details: { method, period_key: updated.period_key },
    });
    return { success: true, data: updated };
  } catch (error) {
    console.error("[membership-fees] markMembershipFeePaid:", error);
    return { success: false, error: "Beitrag konnte nicht verbucht werden." };
  }
}

export async function markMembershipFeeWaived(
  mosqueId: string,
  actorUserId: string,
  ref: { feeId: string } | { userId: string; periodKey: string },
  reason: string
): Promise<ActionResult<MembershipFee>> {
  try {
    if (!reason || !reason.trim())
      return { success: false, error: "Erlass-Grund ist Pflicht." };
    const pb = await getAdminPB();
    let fee: MembershipFee | null = null;
    if ("feeId" in ref) {
      const r = await pb.collection("membership_fees").getOne(safeId(ref.feeId));
      fee = mapFee(r);
    } else {
      safePeriodKey(ref.periodKey);
      fee = await ensureManualPeriod(mosqueId, ref.userId, ref.periodKey);
    }
    if (!fee || fee.mosque_id !== mosqueId)
      return { success: false, error: "Beitrag nicht gefunden." };
    const updated = await applyFeeTransition({
      fee,
      to: "waived",
      source: "manual",
      patch: {
        payment_method: "waived",
        waived_reason: reason.trim(),
        waived_by: actorUserId,
        waived_at: new Date().toISOString(),
      },
    });
    if (!updated)
      return { success: false, error: "Statuswechsel nicht erlaubt." };
    await logAudit({
      mosqueId,
      userId: actorUserId,
      action: "membership_fee.waived",
      entityType: "membership_fees",
      entityId: updated.id,
      details: { reason: reason.trim(), period_key: updated.period_key },
    });
    return { success: true, data: updated };
  } catch (error) {
    console.error("[membership-fees] markMembershipFeeWaived:", error);
    return { success: false, error: "Beitrag konnte nicht erlassen werden." };
  }
}

// --- Member-Sicht ---

export interface MyMembershipFeeData {
  config: MembershipFeeConfig | null;
  fees: MembershipFee[];
  hasActiveSub: boolean;
  activeSubId: string | null;
}

export async function getMyMembershipFee(
  mosqueId: string,
  userId: string
): Promise<ActionResult<MyMembershipFeeData>> {
  try {
    const pb = await getAdminPB();
    const config = await getActiveConfig(mosqueId, userId);
    const feeRecords = await pb.collection("membership_fees").getFullList({
      filter: `mosque_id = "${safeId(mosqueId)}" && user_id = "${safeId(userId)}"`,
      sort: "-period_start",
    });
    let activeSubId: string | null = null;
    try {
      const sub = await pb
        .collection("recurring_subscriptions")
        .getFirstListItem(
          `mosque_id = "${safeId(mosqueId)}" && user_id = "${safeId(userId)}" && ` +
            `subscription_type = "membership_fee" && ` +
            `(status = "active" || status = "pending" || status = "past_due" || status = "incomplete")`
        );
      activeSubId = sub.id;
    } catch {
      activeSubId = null;
    }
    return {
      success: true,
      data: {
        config,
        fees: feeRecords.map(mapFee),
        hasActiveSub: !!activeSubId,
        activeSubId,
      },
    };
  } catch (error) {
    console.error("[membership-fees] getMyMembershipFee:", error);
    return { success: false, error: "Mitgliedsbeitrag konnte nicht geladen werden." };
  }
}
