import type Stripe from "stripe";
import type { RecordModel } from "pocketbase";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { logAudit } from "@/lib/audit";
import { ensureMembershipFeePeriod } from "@/lib/actions/membership-fees";
import {
  canTransition,
  deriveStripePeriod,
  bucketScope,
  type MembershipInterval,
  type MembershipFeeStatus,
} from "@/lib/membership-period";

type AdminPB = Awaited<ReturnType<typeof getAdminPB>>;

/**
 * Webhook-Helfer für automatischen Mitgliedsbeitrags-Einzug.
 * Alle Membership-spezifischen Stripe-Branches gebündelt — der große
 * webhook/route.ts ruft nur diese Funktionen + `break`.
 */

/** Subscription-Line robust selektieren (Regel 17/41). Proration ignoriert. */
function resolveSubLine(
  invoice: Stripe.Invoice,
  subId: string,
  subItemId: string
): Stripe.InvoiceLineItem | null {
  const lines = invoice.lines?.data || [];
  const isSub = (l: Stripe.InvoiceLineItem) =>
    (l as unknown as { type?: string }).type === "subscription" &&
    l.proration !== true;
  const matchItem = (l: Stripe.InvoiceLineItem) => {
    if (!subItemId) return true;
    const det =
      (l as unknown as {
        parent?: { subscription_item_details?: { subscription_item?: string } };
      }).parent?.subscription_item_details?.subscription_item;
    return det ? det === subItemId : true;
  };
  const bySub = (l: Stripe.InvoiceLineItem) => {
    const s = (l as unknown as { subscription?: string }).subscription;
    return s ? s === subId : true;
  };
  return (
    lines.find((l) => isSub(l) && bySub(l) && matchItem(l)) ||
    lines.find((l) => isSub(l)) ||
    null
  );
}

async function logReconcileError(
  pb: AdminPB,
  mosqueId: string,
  ev: Stripe.Event,
  invoiceId: string,
  reason: string
) {
  try {
    await pb.collection("membership_reconcile_errors").create({
      mosque_id: mosqueId,
      stripe_event_id: ev.id,
      invoice_id: invoiceId,
      reason,
      payload_excerpt: JSON.stringify(ev.data.object).slice(0, 3900),
      retry_count: 0,
    });
  } catch (e) {
    console.error("[membership-webhook] logReconcileError:", e);
  }
}

/** checkout.session.completed → Sub aktivieren + Item-ID/Generation festhalten. */
export async function handleMembershipCheckoutCompleted(args: {
  pb: AdminPB;
  stripeSub: Stripe.Subscription;
  pbSubId: string;
  mosqueId: string;
  membershipEnabled: boolean;
}): Promise<void> {
  const { pb, stripeSub, pbSubId, mosqueId, membershipEnabled } = args;
  const itemId = stripeSub.items?.data?.[0]?.id || "";
  await pb.collection("recurring_subscriptions").update(pbSubId, {
    provider_subscription_id: stripeSub.id,
    stripe_subscription_item_id: itemId,
    started_at: new Date().toISOString(),
    current_period_end: new Date(
      stripeSub.current_period_end * 1000
    ).toISOString(),
    status: "active",
    ...(membershipEnabled ? {} : { disabled_by_setting: true }),
  });
  logAudit({
    mosqueId,
    action: "membership_subscription.created",
    entityType: "recurring_subscription",
    entityId: pbSubId,
    details: { stripe_sub_id: stripeSub.id },
  });
}

interface SubRec {
  id: string;
  mosque_id: string;
  user_id: string;
  interval: MembershipInterval;
  stripe_subscription_item_id: string;
}

function asSub(r: RecordModel): SubRec {
  return {
    id: r.id,
    mosque_id: r.mosque_id || "",
    user_id: r.user_id || "",
    interval: (r.interval as MembershipInterval) || "monthly",
    stripe_subscription_item_id: r.stripe_subscription_item_id || "",
  };
}

async function findFeeByProviderRef(
  pb: AdminPB,
  invoiceId: string
): Promise<RecordModel | null> {
  try {
    return await pb
      .collection("membership_fees")
      .getFirstListItem(`provider_ref = "${invoiceId}"`);
  } catch {
    return null;
  }
}

/** Gemeinsame Ableitung: Periode aus der Subscription-Line. */
function deriveFromInvoice(
  invoice: Stripe.Invoice,
  sub: SubRec
): ReturnType<typeof deriveStripePeriod> | null {
  const subId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id || "";
  const line = resolveSubLine(invoice, subId, sub.stripe_subscription_item_id);
  if (!line || !line.period) return null;
  const scope = bucketScope(sub.id, sub.interval);
  return deriveStripePeriod({
    interval: sub.interval,
    lineStartUnix: line.period.start,
    lineEndUnix: line.period.end,
    billingCycleAnchorUnix: line.period.start,
    mosqueId: sub.mosque_id,
    userId: sub.user_id,
    scope,
  });
}

async function auditTransitionIgnored(
  mosqueId: string,
  feeId: string,
  from: string,
  to: string,
  evId: string,
  invoiceId: string
) {
  logAudit({
    mosqueId,
    action: "membership_fee.transition_ignored",
    entityType: "membership_fees",
    entityId: feeId,
    details: { from, attempted_to: to, stripe_event_id: evId, invoice_id: invoiceId },
  });
}

/** invoice.finalized → Periode als pending ensuren (Forderungslogik, Regel 27). */
export async function handleMembershipInvoiceFinalized(args: {
  pb: AdminPB;
  ev: Stripe.Event;
  invoice: Stripe.Invoice;
  pbSub: RecordModel;
}): Promise<void> {
  const sub = asSub(args.pbSub);
  const p = deriveFromInvoice(args.invoice, sub);
  if (!p) {
    await logReconcileError(
      args.pb,
      sub.mosque_id,
      args.ev,
      args.invoice.id,
      "invoice.finalized: keine Subscription-Line"
    );
    return;
  }
  const fee = await ensureMembershipFeePeriod({
    mosqueId: sub.mosque_id,
    userId: sub.user_id,
    periodBucketId: p.period_bucket_id,
    periodKey: p.period_key,
    periodStart: p.period_start,
    periodEnd: p.period_end,
    interval: p.interval,
    billingCycleAnchor: p.billing_cycle_anchor,
    cycleIndex: p.cycle_index,
    source: "stripe_webhook",
    recurringSubscriptionId: sub.id,
  });
  if (!fee) return;
  const from = fee.status as MembershipFeeStatus;
  if (!canTransition(from, "pending", "stripe_webhook")) {
    if (from !== "pending")
      await auditTransitionIgnored(
        sub.mosque_id,
        fee.id,
        from,
        "pending",
        args.ev.id,
        args.invoice.id
      );
    return;
  }
  await args.pb.collection("membership_fees").update(fee.id, {
    status: "pending",
    provider_ref: fee.provider_ref || args.invoice.id,
    provider_invoice_status: "open",
    stripe_invoice_created: args.invoice.created,
  });
}

/** invoice.paid → Periode auf paid (createIfMissing, Regel 38/39). */
export async function handleMembershipInvoicePaid(args: {
  pb: AdminPB;
  ev: Stripe.Event;
  invoice: Stripe.Invoice;
  pbSub: RecordModel;
}): Promise<void> {
  const sub = asSub(args.pbSub);
  const p = deriveFromInvoice(args.invoice, sub);
  if (!p) {
    await logReconcileError(
      args.pb,
      sub.mosque_id,
      args.ev,
      args.invoice.id,
      "invoice.paid: keine Subscription-Line"
    );
    return;
  }
  const fee = await ensureMembershipFeePeriod({
    mosqueId: sub.mosque_id,
    userId: sub.user_id,
    periodBucketId: p.period_bucket_id,
    periodKey: p.period_key,
    periodStart: p.period_start,
    periodEnd: p.period_end,
    interval: p.interval,
    billingCycleAnchor: p.billing_cycle_anchor,
    cycleIndex: p.cycle_index,
    source: "stripe_webhook",
    recurringSubscriptionId: sub.id,
  });

  const paidTs =
    args.invoice.status_transitions?.paid_at ?? args.invoice.created;
  const periodEndIso = p.period_end;

  if (fee) {
    // Regel 39: manuell verbucht (≠ stripe) bereits paid → kein Wechsel
    if (fee.payment_method !== "stripe" && fee.status === "paid") {
      logAudit({
        mosqueId: sub.mosque_id,
        action: "membership_fee.duplicate_settlement",
        entityType: "membership_fees",
        entityId: fee.id,
        details: {
          invoice_id: args.invoice.id,
          stripe_event_id: args.ev.id,
          subscription_id: sub.id,
        },
      });
    } else if (canTransition(fee.status as MembershipFeeStatus, "paid", "stripe_webhook")) {
      // Regel 54: provider_ref nur setzen wenn leer ODER identisch
      const refOk = !fee.provider_ref || fee.provider_ref === args.invoice.id;
      await args.pb.collection("membership_fees").update(fee.id, {
        status: "paid",
        payment_method: "stripe",
        paid_at: new Date(paidTs * 1000).toISOString(),
        provider_invoice_status: "paid",
        stripe_invoice_created: args.invoice.created,
        ...(refOk ? { provider_ref: args.invoice.id } : {}),
      });
      if (!refOk) {
        logAudit({
          mosqueId: sub.mosque_id,
          action: "membership_fee.transition_ignored",
          entityType: "membership_fees",
          entityId: fee.id,
          details: {
            reason: "provider_ref_mismatch",
            existing: fee.provider_ref,
            incoming: args.invoice.id,
          },
        });
      }
      logAudit({
        mosqueId: sub.mosque_id,
        action: "membership_fee.paid_stripe",
        entityType: "membership_fees",
        entityId: fee.id,
        details: {
          invoice_id: args.invoice.id,
          stripe_event_id: args.ev.id,
          subscription_id: sub.id,
          amount_cents: args.invoice.amount_paid,
        },
      });
    } else if (fee.status !== "paid") {
      await auditTransitionIgnored(
        sub.mosque_id,
        fee.id,
        fee.status,
        "paid",
        args.ev.id,
        args.invoice.id
      );
    }
  }

  await args.pb.collection("recurring_subscriptions").update(sub.id, {
    last_payment_status: "paid",
    last_payment_at: new Date(paidTs * 1000).toISOString(),
    status: "active",
    current_period_end: periodEndIso,
  });
}

/** invoice.payment_failed → bestehende Periode failed (NIE neu, Regel 25/57). */
export async function handleMembershipInvoiceFailed(args: {
  pb: AdminPB;
  ev: Stripe.Event;
  invoice: Stripe.Invoice;
  pbSub: RecordModel;
}): Promise<void> {
  const sub = asSub(args.pbSub);
  let feeRec = await findFeeByProviderRef(args.pb, args.invoice.id);
  if (!feeRec) {
    const p = deriveFromInvoice(args.invoice, sub);
    if (p) {
      try {
        feeRec = await args.pb
          .collection("membership_fees")
          .getFirstListItem(`period_bucket_id = "${p.period_bucket_id}"`);
      } catch {
        feeRec = null;
      }
    }
  }
  if (feeRec) {
    const status = (feeRec.status as MembershipFeeStatus) || "open";
    // Regel 57: manuell bezahlt (≠ stripe) + Stripe-Failure → HIGH-Audit
    if (feeRec.payment_method !== "stripe" && status === "paid") {
      logAudit({
        mosqueId: sub.mosque_id,
        action: "membership_fee.manual_stripe_conflict",
        entityType: "membership_fees",
        entityId: feeRec.id,
        details: {
          severity: "HIGH",
          invoice_id: args.invoice.id,
          stripe_event_id: args.ev.id,
          subscription_id: sub.id,
        },
      });
    } else if (canTransition(status, "failed", "stripe_webhook")) {
      await args.pb.collection("membership_fees").update(feeRec.id, {
        status: "failed",
        provider_invoice_status: "open",
      });
      logAudit({
        mosqueId: sub.mosque_id,
        action: "membership_fee.failed_stripe",
        entityType: "membership_fees",
        entityId: feeRec.id,
        details: {
          invoice_id: args.invoice.id,
          stripe_event_id: args.ev.id,
          subscription_id: sub.id,
          attempt_count: args.invoice.attempt_count,
        },
      });
    } else if (status !== "failed") {
      await auditTransitionIgnored(
        sub.mosque_id,
        feeRec.id,
        status,
        "failed",
        args.ev.id,
        args.invoice.id
      );
    }
  } else {
    logAudit({
      mosqueId: sub.mosque_id,
      action: "membership_fee.transition_ignored",
      entityType: "membership_fees",
      entityId: args.invoice.id,
      details: { reason: "no_period_for_failed", invoice_id: args.invoice.id },
    });
  }
  await args.pb.collection("recurring_subscriptions").update(sub.id, {
    last_payment_status: "failed",
    last_payment_at: new Date().toISOString(),
    status: "past_due",
  });
}

/** invoice.voided / .marked_uncollectible → Periode void (Regel 50). */
export async function handleMembershipInvoiceVoided(args: {
  pb: AdminPB;
  ev: Stripe.Event;
  invoice: Stripe.Invoice;
  pbSub: RecordModel;
  uncollectible: boolean;
}): Promise<void> {
  const sub = asSub(args.pbSub);
  const feeRec = await findFeeByProviderRef(args.pb, args.invoice.id);
  if (!feeRec) return;
  const status = (feeRec.status as MembershipFeeStatus) || "open";
  if (canTransition(status, "void", "stripe_webhook")) {
    await args.pb.collection("membership_fees").update(feeRec.id, {
      status: "void",
      provider_invoice_status: args.uncollectible ? "uncollectible" : "void",
    });
    logAudit({
      mosqueId: sub.mosque_id,
      action: "membership_fee.voided",
      entityType: "membership_fees",
      entityId: feeRec.id,
      details: {
        invoice_id: args.invoice.id,
        stripe_event_id: args.ev.id,
        uncollectible: args.uncollectible,
      },
    });
  } else if (status !== "void") {
    await auditTransitionIgnored(
      sub.mosque_id,
      feeRec.id,
      status,
      "void",
      args.ev.id,
      args.invoice.id
    );
  }
}
