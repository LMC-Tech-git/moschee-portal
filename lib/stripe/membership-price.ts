import { createHash } from "crypto";
import type Stripe from "stripe";
import { getAdminPB } from "@/lib/pocketbase-admin";
import type { MembershipInterval } from "@/lib/membership-period";

/**
 * Stripe-Price-Reuse (Regel 33): dynamisch erzeugte Prices pro
 * (amount_cents, interval, currency, connect_account) mit lokalem Cache.
 * Stripe Prices sind immutable → Cache nie löschen/ändern.
 */
export function membershipIntervalToStripe(interval: MembershipInterval): {
  interval: "month" | "year";
  interval_count: number;
} {
  if (interval === "yearly") return { interval: "year", interval_count: 1 };
  if (interval === "quarterly") return { interval: "month", interval_count: 3 };
  return { interval: "month", interval_count: 1 };
}

export async function getOrCreateMembershipPrice(args: {
  stripe: Stripe;
  stripeOpts?: { stripeAccount: string };
  amountCents: number;
  interval: MembershipInterval;
  currency: string;
  mosqueName: string;
}): Promise<string> {
  const accountId = args.stripeOpts?.stripeAccount || "platform";
  const currency = (args.currency || "EUR").toLowerCase();
  const cacheKey = createHash("sha256")
    .update(`${args.amountCents}|${args.interval}|${currency}|${accountId}`)
    .digest("hex");

  const pb = await getAdminPB();
  try {
    const hit = await pb
      .collection("stripe_price_cache")
      .getFirstListItem(`cache_key = "${cacheKey}"`);
    if (hit?.stripe_price_id) return hit.stripe_price_id as string;
  } catch {
    // kein Cache-Hit → erzeugen
  }

  const rec = membershipIntervalToStripe(args.interval);
  const price = await args.stripe.prices.create(
    {
      currency,
      unit_amount: args.amountCents,
      recurring: { interval: rec.interval, interval_count: rec.interval_count },
      product_data: { name: `Mitgliedsbeitrag — ${args.mosqueName}` },
    },
    args.stripeOpts
  );

  try {
    await pb.collection("stripe_price_cache").create({
      cache_key: cacheKey,
      stripe_price_id: price.id,
      connect_account_id: args.stripeOpts?.stripeAccount || "",
      interval_count: rec.interval_count,
      livemode: price.livemode,
      active: true,
    });
  } catch {
    // Race: paralleler Create hat Cache-Key belegt — Price-ID bleibt valide.
  }
  return price.id;
}
