import { createHash } from "crypto";

/**
 * Zentrale, reine Period-/Status-Logik für Mitgliedsbeiträge.
 *
 * EINZIGE Quelle für `period_key`, `period_bucket_id` und Status-Übergänge.
 * Keine DB-Zugriffe, keine Side-Effects — vollständig deterministisch + testbar.
 *
 * Regeln (siehe Plan): period_key ist NUR ein UI/Grouping-Label,
 * `period_bucket_id` ist die autoritative Idempotenz-Schicht.
 * `period_end` ist EXKLUSIV (Stripe-Semantik): gültig `>= start AND < end`.
 */

export type MembershipInterval = "monthly" | "quarterly" | "yearly";

export type MembershipFeeStatus =
  | "open"
  | "pending"
  | "paid"
  | "failed"
  | "waived"
  | "void";

export type TransitionSource =
  | "stripe_webhook"
  | "manual"
  | "admin_bulk"
  | "reconcile";

export interface DerivedPeriod {
  period_key: string;
  period_start: string; // ISO, UTC-Mitternacht (canonical)
  period_end: string; // ISO, EXKLUSIV
  period_bucket_id: string;
  cycle_index: number;
  billing_cycle_anchor: string; // ISO, UTC-Mitternacht
  interval: MembershipInterval;
}

/** UTC-Mitternacht des Tages (kein Implizit, DST-/TZ-sicher). */
export function normalizeToUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Stabiler UTC-Tag als ISO `YYYY-MM-DD`. Einzige Ableitungsstelle (Regel 48). */
export function normalizedPeriodStartIso(d: Date): string {
  return normalizeToUtcMidnight(d).toISOString().slice(0, 10);
}

/** scope = recurring_subscription_id (Auto-Zahler) | `manual:<interval>` (Bulk). */
export function bucketScope(
  recurringSubscriptionId: string | null | undefined,
  interval: MembershipInterval
): string {
  return recurringSubscriptionId
    ? recurringSubscriptionId
    : `manual:${interval}`;
}

/** sha256(mosque_id + user_id + scope + normalized_period_start_iso). Regel 35/48. */
export function periodBucketId(args: {
  mosqueId: string;
  userId: string;
  scope: string;
  periodStart: Date;
}): string {
  const iso = normalizedPeriodStartIso(args.periodStart);
  return createHash("sha256")
    .update(`${args.mosqueId}|${args.userId}|${args.scope}|${iso}`)
    .digest("hex");
}

/** UI/Grouping-Label. NIE für Stripe-Matching/Idempotenz verwenden. */
export function periodKeyLabel(
  interval: MembershipInterval,
  periodStart: Date
): string {
  const y = periodStart.getUTCFullYear();
  const m = periodStart.getUTCMonth(); // 0..11
  if (interval === "yearly") return String(y);
  if (interval === "quarterly") return `${y}-Q${Math.floor(m / 3) + 1}`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Schrittweite in Monaten je Intervall. */
function intervalMonths(interval: MembershipInterval): number {
  if (interval === "yearly") return 12;
  if (interval === "quarterly") return 3;
  return 1;
}

/** Zyklus-Index seit Anchor (ganzzahlig, >= 0). */
function cycleIndexBetween(
  anchor: Date,
  periodStart: Date,
  interval: MembershipInterval
): number {
  const monthsDiff =
    (periodStart.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    (periodStart.getUTCMonth() - anchor.getUTCMonth());
  const step = intervalMonths(interval);
  return Math.max(0, Math.round(monthsDiff / step));
}

/**
 * STRIPE-PFAD: Periode aus der bereits von Stripe gelieferten Subscription-Line.
 * Macht KEINE eigene Monats-/Quartalsarithmetik (Regel 23) — formatiert nur.
 * `lineStartUnix`/`lineEndUnix` = `invoice.lines.data[].period.start/end`.
 */
export function deriveStripePeriod(args: {
  interval: MembershipInterval;
  lineStartUnix: number;
  lineEndUnix: number;
  billingCycleAnchorUnix: number;
  mosqueId: string;
  userId: string;
  scope: string;
}): DerivedPeriod {
  const periodStart = normalizeToUtcMidnight(new Date(args.lineStartUnix * 1000));
  const periodEnd = new Date(args.lineEndUnix * 1000); // exklusiv, roh belassen
  const anchor = normalizeToUtcMidnight(
    new Date(args.billingCycleAnchorUnix * 1000)
  );
  if (!(periodStart.getTime() < periodEnd.getTime())) {
    throw new Error(
      `Ungültige Periode: period_start (${periodStart.toISOString()}) >= period_end (${periodEnd.toISOString()})`
    );
  }
  return {
    period_key: periodKeyLabel(args.interval, periodStart),
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    period_bucket_id: periodBucketId({
      mosqueId: args.mosqueId,
      userId: args.userId,
      scope: args.scope,
      periodStart,
    }),
    cycle_index: cycleIndexBetween(anchor, periodStart, args.interval),
    billing_cycle_anchor: anchor.toISOString(),
    interval: args.interval,
  };
}

/**
 * ADMIN-BULK-PFAD (manuelle Zahler): deterministische UTC-Kalenderarithmetik
 * erlaubt, da hier keine Stripe-Wahrheit existiert (Regel 22/23).
 * `ref` = beliebiges Datum innerhalb der Zielperiode.
 */
export function deriveBulkPeriod(args: {
  interval: MembershipInterval;
  ref: Date;
  mosqueId: string;
  userId: string;
}): DerivedPeriod {
  const y = args.ref.getUTCFullYear();
  const m = args.ref.getUTCMonth();
  let startMonth: number;
  if (args.interval === "yearly") startMonth = 0;
  else if (args.interval === "quarterly") startMonth = Math.floor(m / 3) * 3;
  else startMonth = m;
  const periodStart = new Date(Date.UTC(y, startMonth, 1));
  const periodEnd = new Date(
    Date.UTC(y, startMonth + intervalMonths(args.interval), 1)
  );
  const scope = bucketScope(null, args.interval);
  return {
    period_key: periodKeyLabel(args.interval, periodStart),
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    period_bucket_id: periodBucketId({
      mosqueId: args.mosqueId,
      userId: args.userId,
      scope,
      periodStart,
    }),
    cycle_index: 0,
    billing_cycle_anchor: periodStart.toISOString(),
    interval: args.interval,
  };
}

/**
 * Status-Transition-Guard (Regel 13). Reine Funktion, einzige Quelle.
 * Liefert true wenn `to` den Wert `from` überschreiben DARF.
 * Gleicher Status (`from === to`) → false (Caller behandelt als No-op).
 * `→ pending` nur aus `open` (finalized-Retry darf nichts zurücksetzen).
 */
export function canTransition(
  from: MembershipFeeStatus,
  to: MembershipFeeStatus,
  _source: TransitionSource
): boolean {
  if (from === to) return false;
  const matrix: Record<MembershipFeeStatus, MembershipFeeStatus[]> = {
    open: ["pending", "paid", "failed", "waived", "void"],
    pending: ["paid", "failed", "waived", "void"],
    failed: ["paid", "waived", "void"],
    paid: ["waived", "void"],
    waived: [],
    void: [],
  };
  return matrix[from]?.includes(to) ?? false;
}
