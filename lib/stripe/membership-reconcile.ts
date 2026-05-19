import type Stripe from "stripe";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { getStripe, stripeAccountFor } from "@/lib/stripe/client";
import { logAudit } from "@/lib/audit";
import { ensureMembershipFeePeriod } from "@/lib/actions/membership-fees";
import {
  canTransition,
  deriveStripePeriod,
  bucketScope,
  type MembershipInterval,
} from "@/lib/membership-period";
import type { Mosque } from "@/types";

const MAX_LOOKBACK_DAYS = 90;
const OVERLAP_SECONDS = 26 * 3600;
const MAX_PAGES = 20;

/**
 * Reconcile-Cron (Delta-Strategie): fängt verpasste invoice.paid-Webhooks.
 * Cursor pro Connected Account in settings.membership_reconcile_cursor.
 * Idempotent via period_bucket_id → keine Doppel-Forderungen.
 */
export async function reconcileMembershipFees(): Promise<{
  success: boolean;
  mosques: number;
  repaired: number;
  errors: number;
}> {
  const pb = await getAdminPB();
  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch {
    return { success: false, mosques: 0, repaired: 0, errors: 0 };
  }

  const mosques = await pb.collection("mosques").getFullList();
  let repaired = 0;
  let errors = 0;
  let processedMosques = 0;

  for (const m of mosques) {
    let settingsRec;
    try {
      settingsRec = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${m.id}"`);
    } catch {
      continue;
    }
    if (!settingsRec.membership_fees_enabled) continue;

    let stripeOpts: { stripeAccount: string } | undefined;
    try {
      stripeOpts = stripeAccountFor(m as unknown as Mosque);
    } catch {
      continue;
    }
    const accountKey = stripeOpts?.stripeAccount || "platform";

    let cursor: Record<string, { last_invoice_created: number }> = {};
    try {
      cursor =
        typeof settingsRec.membership_reconcile_cursor === "string"
          ? JSON.parse(settingsRec.membership_reconcile_cursor || "{}")
          : settingsRec.membership_reconcile_cursor || {};
    } catch {
      cursor = {};
    }
    const last = cursor[accountKey]?.last_invoice_created || 0;
    const floor =
      Math.floor(Date.now() / 1000) - MAX_LOOKBACK_DAYS * 24 * 3600;
    const since = Math.max(last ? last - OVERLAP_SECONDS : 0, floor);

    processedMosques++;
    let maxCreated = last;
    let pages = 0;
    let startingAfter: string | undefined;
    let allOk = true;

    try {
      while (pages < MAX_PAGES) {
        pages++;
        const list = await stripe.invoices.list(
          {
            status: "paid",
            created: { gte: since },
            limit: 100,
            ...(startingAfter ? { starting_after: startingAfter } : {}),
          },
          stripeOpts
        );
        // ORDER BY created ASC sicherstellen
        const items = [...list.data].sort((a, b) => a.created - b.created);
        for (const invoice of items) {
          const subId =
            typeof invoice.subscription === "string"
              ? invoice.subscription
              : invoice.subscription?.id;
          if (!subId) continue;
          let pbSub;
          try {
            pbSub = await pb
              .collection("recurring_subscriptions")
              .getFirstListItem(
                `provider_subscription_id = "${subId}" && subscription_type = "membership_fee"`
              );
          } catch {
            continue;
          }
          const r = await repairPaidInvoice(pb, invoice, pbSub);
          if (r === "repaired") repaired++;
          if (r === "error") {
            errors++;
            allOk = false;
          }
          if (invoice.created > maxCreated) maxCreated = invoice.created;
        }
        if (!list.has_more) break;
        startingAfter = list.data[list.data.length - 1]?.id;
      }
    } catch (e) {
      console.error("[membership-reconcile] Stripe-Liste:", e);
      allOk = false;
    }

    // Cursor NUR bei vollständigem Erfolg fortschreiben (kein Drift).
    if (allOk && maxCreated > last) {
      cursor[accountKey] = { last_invoice_created: maxCreated };
      await pb
        .collection("settings")
        .update(settingsRec.id, {
          membership_reconcile_cursor: JSON.stringify(cursor),
        });
    }
  }

  return { success: true, mosques: processedMosques, repaired, errors };
}

interface SubRec {
  id: string;
  mosque_id: string;
  user_id: string;
  interval: MembershipInterval;
  stripe_subscription_item_id: string;
}

async function repairPaidInvoice(
  pb: Awaited<ReturnType<typeof getAdminPB>>,
  invoice: Stripe.Invoice,
  pbSubRec: { [k: string]: unknown }
): Promise<"repaired" | "noop" | "error"> {
  const sub: SubRec = {
    id: String(pbSubRec.id),
    mosque_id: String(pbSubRec.mosque_id || ""),
    user_id: String(pbSubRec.user_id || ""),
    interval: (pbSubRec.interval as MembershipInterval) || "monthly",
    stripe_subscription_item_id: String(
      pbSubRec.stripe_subscription_item_id || ""
    ),
  };
  try {
    const lines = invoice.lines?.data || [];
    const line =
      lines.find(
        (l) =>
          (l as unknown as { type?: string }).type === "subscription" &&
          l.proration !== true
      ) || null;
    if (!line || !line.period) return "noop";
    const p = deriveStripePeriod({
      interval: sub.interval,
      lineStartUnix: line.period.start,
      lineEndUnix: line.period.end,
      billingCycleAnchorUnix: line.period.start,
      mosqueId: sub.mosque_id,
      userId: sub.user_id,
      scope: bucketScope(sub.id, sub.interval),
    });
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
    if (!fee) return "noop";
    if (fee.status === "paid") return "noop";
    if (!canTransition(fee.status, "paid", "reconcile")) return "noop";
    const refOk = !fee.provider_ref || fee.provider_ref === invoice.id;
    await pb.collection("membership_fees").update(fee.id, {
      status: "paid",
      payment_method: "stripe",
      paid_at: new Date(
        (invoice.status_transitions?.paid_at ?? invoice.created) * 1000
      ).toISOString(),
      provider_invoice_status: "paid",
      stripe_invoice_created: invoice.created,
      ...(refOk ? { provider_ref: invoice.id } : {}),
    });
    logAudit({
      mosqueId: sub.mosque_id,
      action: "membership_fee.reconciled",
      entityType: "membership_fees",
      entityId: fee.id,
      details: { invoice_id: invoice.id, subscription_id: sub.id },
    });
    return "repaired";
  } catch (e) {
    console.error("[membership-reconcile] repair:", e);
    return "error";
  }
}
