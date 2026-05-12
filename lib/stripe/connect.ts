import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type Stripe from "stripe";
import { getStripe } from "./client";

// ─── State-Token (HMAC-signed) ─────────────────────────────────────

const STATE_TTL_MS = 30 * 60 * 1000; // 30 Min

function getStateSecret(): string {
  const s = process.env.STRIPE_CONNECT_STATE_SECRET;
  if (!s || s.length < 32) {
    throw new Error("STRIPE_CONNECT_STATE_SECRET fehlt oder zu kurz (min 32 Zeichen)");
  }
  return s;
}

export interface OnboardingStatePayload {
  mosque_id: string;
  nonce: string;
  exp: number;
}

export function signOnboardingState(mosqueId: string): string {
  const payload: OnboardingStatePayload = {
    mosque_id: mosqueId,
    nonce: randomBytes(8).toString("hex"),
    exp: Date.now() + STATE_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getStateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyOnboardingState(token: string): OnboardingStatePayload | null {
  const [body, sig] = (token || "").split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", getStateSecret()).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload: OnboardingStatePayload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!payload.mosque_id || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Stripe Connect Service ────────────────────────────────────────

export interface AccountState {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  currentlyDue: string[];
  eventuallyDue: string[];
  cardPaymentsStatus: "inactive" | "pending" | "active";
  sepaDebitPaymentsStatus: "inactive" | "pending" | "active";
}

function mapCapability(s: string | undefined): "inactive" | "pending" | "active" {
  if (s === "active" || s === "pending") return s;
  return "inactive";
}

export async function createConnectAccount(
  mosque: { id: string; slug: string; email: string }
): Promise<string> {
  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: "express",
    country: "DE",
    email: mosque.email || undefined,
    capabilities: {
      card_payments: { requested: true },
      sepa_debit_payments: { requested: true },
      // transfers ist Stripe-Pflicht bei card_payments — auch bei Direct Charges
      transfers: { requested: true },
      // KEIN business_type (Stripe-Wizard fragt selbst)
    },
    metadata: {
      mosque_id: mosque.id,
      mosque_slug: mosque.slug,
    },
  });
  return account.id;
}

export async function createOnboardingLink(
  accountId: string,
  mosqueId: string,
  origin: string
): Promise<string> {
  const stripe = getStripe();
  const state = signOnboardingState(mosqueId);
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/api/admin/stripe/connect/refresh/${mosqueId}`,
    return_url: `${origin}/api/admin/stripe/connect/return?state=${state}`,
    type: "account_onboarding",
  });
  return link.url;
}

export async function createDashboardLoginLink(accountId: string): Promise<string> {
  const stripe = getStripe();
  const link = await stripe.accounts.createLoginLink(accountId);
  return link.url;
}

export async function fetchAccountState(accountId: string): Promise<AccountState> {
  const stripe = getStripe();
  const acc = await stripe.accounts.retrieve(accountId);
  return {
    accountId: acc.id,
    chargesEnabled: acc.charges_enabled ?? false,
    payoutsEnabled: acc.payouts_enabled ?? false,
    detailsSubmitted: acc.details_submitted ?? false,
    currentlyDue: acc.requirements?.currently_due ?? [],
    eventuallyDue: acc.requirements?.eventually_due ?? [],
    cardPaymentsStatus: mapCapability(acc.capabilities?.card_payments),
    sepaDebitPaymentsStatus: mapCapability(acc.capabilities?.sepa_debit_payments),
  };
}

export function accountFromEvent(event: Stripe.Event): string | undefined {
  // Stripe Direct-Charge-Events tragen "account" auf Top-Level
  return (event as { account?: string }).account;
}
