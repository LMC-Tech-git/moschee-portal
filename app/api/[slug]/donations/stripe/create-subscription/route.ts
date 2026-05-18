import { NextResponse, type NextRequest } from "next/server";
import { resolveMosqueBySlug, resolveMosqueSettings } from "@/lib/resolve-mosque";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { donationSubscriptionSchema } from "@/lib/validations";
import { checkRateLimit, hashIP, getRateLimitHeaders } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { logAudit } from "@/lib/audit";
import { normalizeEmail } from "@/lib/normalize-email";
import { getStripe, stripeAccountFor, sepaAvailable } from "@/lib/stripe/client";
import { getActiveConfig } from "@/lib/actions/membership-fees";
import {
  getOrCreateMembershipPrice,
} from "@/lib/stripe/membership-price";

/**
 * POST /api/[slug]/donations/stripe/create-subscription
 * Generalisiert: purpose="donation" (Dauerauftrag) | "membership_fee"
 * (automatischer Mitgliedsbeitrags-Einzug). Gemeinsame Stripe-Subscription-
 * Basis, fachlich getrennte Records (subscription_type-Discriminator).
 * PB-Record startet status="pending" → Webhook setzt "active".
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const mosque = await resolveMosqueBySlug(params.slug);
    if (!mosque) {
      return NextResponse.json(
        { success: false, error: "Moschee nicht gefunden" },
        { status: 404 }
      );
    }

    if (mosque.donation_provider !== "stripe") {
      return NextResponse.json(
        { success: false, error: "Stripe ist für diese Moschee nicht aktiviert" },
        { status: 400 }
      );
    }

    const pb = await getAdminPB();

    // Auth detektieren
    let isPreAuthenticated = false;
    const authHeaderPre = request.headers.get("authorization");
    if (authHeaderPre?.startsWith("Bearer ")) {
      try {
        const token = authHeaderPre.slice(7);
        const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
        isPreAuthenticated = !!(payload.id && payload.type === "authRecord");
      } catch {}
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const ipHash = await hashIP(ip);

    if (!isPreAuthenticated) {
      const rl = checkRateLimit(`donation_sub:${ipHash}`, 3, 60 * 60 * 1000);
      if (!rl.allowed) {
        return NextResponse.json(
          { success: false, error: "Zu viele Anfragen. Bitte später erneut versuchen." },
          { status: 429, headers: getRateLimitHeaders(rl) }
        );
      }
    }

    const body = await request.json();
    const parsed = donationSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Ungültige Eingabe" },
        { status: 400 }
      );
    }

    const purpose = parsed.data.purpose;
    const { campaign_id, donor_name, payment_method_type } = parsed.data;

    // Auth vollständig prüfen (für Membership Pflicht)
    let authenticatedUserId = "";
    let authenticatedUserEmail = "";
    let donorType: "member" | "guest" = "guest";
    if (isPreAuthenticated && authHeaderPre?.startsWith("Bearer ")) {
      try {
        const token = authHeaderPre.slice(7);
        const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
        if (payload.id && payload.type === "authRecord") {
          const userRecord = await pb.collection("users").getOne(payload.id);
          if (userRecord.mosque_id === mosque.id) {
            authenticatedUserId = userRecord.id;
            authenticatedUserEmail = userRecord.email || "";
            donorType = "member";
          }
        }
      } catch {}
    }

    let stripe;
    let stripeOpts: { stripeAccount: string } | undefined;
    try {
      stripe = getStripe();
      stripeOpts = stripeAccountFor(mosque);
    } catch (err) {
      return NextResponse.json(
        { success: false, error: String((err as Error).message) },
        { status: 400 }
      );
    }

    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
    const origin = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : request.nextUrl.origin;

    // SEPA-Capability prüfen wenn explizit gewählt
    if (payment_method_type === "sepa_debit") {
      const settings = await resolveMosqueSettings(mosque.id);
      if (!sepaAvailable(mosque, settings)) {
        return NextResponse.json(
          { success: false, error: "SEPA-Lastschrift ist für diese Moschee nicht verfügbar." },
          { status: 400 }
        );
      }
    }

    // ============== MEMBERSHIP-FEE-PFAD ==============
    if (purpose === "membership_fee") {
      // Regel 6/34: nur eingeloggte, server-seitig verifizierte Member
      if (!authenticatedUserId) {
        return NextResponse.json(
          { success: false, error: "Anmeldung erforderlich." },
          { status: 401 }
        );
      }

      const settings = await resolveMosqueSettings(mosque.id);
      if (!settings.membership_fees_enabled) {
        return NextResponse.json(
          { success: false, error: "Mitgliedsbeiträge sind für diese Moschee nicht aktiviert." },
          { status: 400 }
        );
      }

      const cfg = await getActiveConfig(mosque.id, authenticatedUserId);
      if (!cfg || !cfg.active) {
        return NextResponse.json(
          { success: false, error: "Für dich ist kein Mitgliedsbeitrag konfiguriert." },
          { status: 400 }
        );
      }

      // Duplicate-Guard (App-Level; DB-UNIQUE idx_recsub_one_active_membership
      // ist autoritativ und mappt Constraint-Verletzung ebenfalls auf 409).
      try {
        const existing = await pb
          .collection("recurring_subscriptions")
          .getFirstListItem(
            `mosque_id = "${mosque.id}" && user_id = "${authenticatedUserId}" && ` +
              `subscription_type = "membership_fee" && ` +
              `(status = "active" || status = "pending" || status = "past_due" || status = "incomplete")`
          );
        if (existing) {
          return NextResponse.json(
            { success: false, error: "Es besteht bereits eine aktive automatische Abbuchung." },
            { status: 409 }
          );
        }
      } catch {
        // keine aktive Sub → OK
      }

      const memberEmail = normalizeEmail(authenticatedUserEmail || "");

      // Customer am Connected Account suchen/erstellen
      let customerId: string;
      const existingCustomers = await stripe.customers.list(
        { email: memberEmail, limit: 10 },
        stripeOpts
      );
      const reuse = existingCustomers.data.find(
        (c) => c.metadata?.mosque_id === mosque.id
      );
      if (reuse) {
        customerId = reuse.id;
      } else {
        const customer = await stripe.customers.create(
          {
            email: memberEmail,
            name: donor_name || undefined,
            metadata: { mosque_id: mosque.id, user_id: authenticatedUserId },
          },
          stripeOpts
        );
        customerId = customer.id;
      }

      const priceId = await getOrCreateMembershipPrice({
        stripe,
        stripeOpts,
        amountCents: cfg.amount_cents,
        interval: cfg.interval,
        currency: cfg.currency || "EUR",
        mosqueName: mosque.name,
      });

      let subRecord;
      try {
        subRecord = await pb.collection("recurring_subscriptions").create({
          mosque_id: mosque.id,
          donor_type: "member",
          user_id: authenticatedUserId,
          donor_name: donor_name || "",
          donor_email: memberEmail,
          campaign_id: "",
          amount_cents: cfg.amount_cents,
          currency: cfg.currency || "EUR",
          interval: cfg.interval,
          provider: "stripe",
          provider_subscription_id: "",
          status: "pending",
          last_payment_status: "pending",
          subscription_type: "membership_fee",
          subscription_generation: 1,
        });
      } catch {
        // DB-UNIQUE idx_recsub_one_active_membership → bereits aktive Sub
        return NextResponse.json(
          { success: false, error: "Es besteht bereits eine aktive automatische Abbuchung." },
          { status: 409 }
        );
      }

      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer: customerId,
          payment_method_types:
            payment_method_type === "sepa_debit"
              ? ["sepa_debit"]
              : payment_method_type === "card"
                ? ["card"]
                : ["card", "sepa_debit"],
          line_items: [{ price: priceId, quantity: 1 }],
          subscription_data: {
            metadata: {
              mosque_id: mosque.id,
              pb_subscription_id: subRecord.id,
              payment_type: "membership_fee_subscription",
              membership_fee_config_id: cfg.id,
              user_id: authenticatedUserId,
            },
          },
          metadata: {
            mosque_id: mosque.id,
            pb_subscription_id: subRecord.id,
            payment_type: "membership_fee_subscription",
            membership_fee_config_id: cfg.id,
          },
          success_url: `${origin}/member/profile?membership_success=true`,
          cancel_url: `${origin}/member/profile?membership_cancelled=true`,
        },
        { idempotencyKey: `msub:${subRecord.id}`, ...(stripeOpts || {}) }
      );

      await pb.collection("recurring_subscriptions").update(subRecord.id, {
        provider_ref: session.id,
      });

      logAudit({
        mosqueId: mosque.id,
        userId: authenticatedUserId,
        action: "membership_subscription.created",
        entityType: "recurring_subscription",
        entityId: subRecord.id,
        details: { amount_cents: cfg.amount_cents, interval: cfg.interval },
      });

      return NextResponse.json({ success: true, checkout_url: session.url });
    }

    // ============== DONATION-PFAD (unverändert) ==============
    let recurringEnabled = false;
    let minCents = 300;
    try {
      const rec = await pb
        .collection("settings")
        .getFirstListItem(`mosque_id = "${mosque.id}"`, {
          fields: "recurring_donations_enabled,recurring_min_cents",
        });
      recurringEnabled = rec.recurring_donations_enabled ?? false;
      minCents = rec.recurring_min_cents || 300;
    } catch {
      // Keine Settings → Feature aus
    }

    if (!recurringEnabled) {
      return NextResponse.json(
        { success: false, error: "Daueraufträge sind für diese Moschee nicht aktiviert." },
        { status: 400 }
      );
    }

    const amount_cents = parsed.data.amount_cents ?? 0;
    if (!parsed.data.donor_email) {
      return NextResponse.json(
        { success: false, error: "E-Mail ist erforderlich." },
        { status: 400 }
      );
    }
    const donor_email = normalizeEmail(parsed.data.donor_email);

    if (amount_cents < minCents) {
      return NextResponse.json(
        { success: false, error: `Mindestbetrag: ${(minCents / 100).toFixed(2)} €` },
        { status: 400 }
      );
    }

    if (!isPreAuthenticated) {
      const turnstileValid = await verifyTurnstileToken(parsed.data.turnstile_token || "");
      if (!turnstileValid) {
        return NextResponse.json(
          { success: false, error: "CAPTCHA-Verifizierung fehlgeschlagen." },
          { status: 400 }
        );
      }
    }

    // Duplicate-Guard: kein zweites aktives Abo pro (mosque, email)
    try {
      const existing = await pb
        .collection("recurring_subscriptions")
        .getFirstListItem(
          `mosque_id = "${mosque.id}" && donor_email = "${donor_email}" && (status = "active" || status = "pending")`
        );
      if (existing) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Es besteht bereits ein aktiver Dauerauftrag für diese Email — bitte kündige den bestehenden zuerst.",
          },
          { status: 409 }
        );
      }
    } catch {
      // keine aktive Sub → OK
    }

    // Customer am Connected Account suchen/erstellen
    let customerId: string;
    const existingCustomers = await stripe.customers.list(
      { email: donor_email, limit: 10 },
      stripeOpts,
    );
    const reuse = existingCustomers.data.find((c) => c.metadata?.mosque_id === mosque.id);
    if (reuse) {
      customerId = reuse.id;
    } else {
      const customer = await stripe.customers.create(
        {
          email: donor_email,
          name: donor_name || undefined,
          metadata: {
            mosque_id: mosque.id,
            ...(authenticatedUserId ? { user_id: authenticatedUserId } : {}),
          },
        },
        stripeOpts,
      );
      customerId = customer.id;
    }

    const subRecord = await pb.collection("recurring_subscriptions").create({
      mosque_id: mosque.id,
      donor_type: donorType,
      user_id: authenticatedUserId || "",
      donor_name: donor_name || "",
      donor_email,
      campaign_id: campaign_id || "",
      amount_cents,
      currency: "EUR",
      interval: "monthly",
      provider: "stripe",
      provider_subscription_id: "",
      status: "pending",
      last_payment_status: "pending",
      subscription_type: "donation",
    });

    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        payment_method_types:
          payment_method_type === "sepa_debit"
            ? ["sepa_debit"]
            : payment_method_type === "card"
              ? ["card"]
              : ["card", "sepa_debit"],
        line_items: [
          {
            price_data: {
              currency: "eur",
              unit_amount: amount_cents,
              product_data: {
                name: `Monatliche Spende — ${mosque.name}`,
              },
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        subscription_data: {
          metadata: {
            mosque_id: mosque.id,
            pb_subscription_id: subRecord.id,
            payment_type: "donation_subscription",
            campaign_id: campaign_id || "",
            donor_type: donorType,
            user_id: authenticatedUserId || "",
          },
        },
        metadata: {
          mosque_id: mosque.id,
          pb_subscription_id: subRecord.id,
          payment_type: "donation_subscription",
        },
        success_url: `${origin}/${params.slug}/donate?sub_success=true`,
        cancel_url: `${origin}/${params.slug}/donate?cancelled=true`,
      },
      { idempotencyKey: `sub:${subRecord.id}`, ...(stripeOpts || {}) }
    );

    await pb.collection("recurring_subscriptions").update(subRecord.id, {
      provider_ref: session.id,
    });

    logAudit({
      mosqueId: mosque.id,
      userId: authenticatedUserId || undefined,
      action: "donation_subscription.created",
      entityType: "recurring_subscription",
      entityId: subRecord.id,
      details: { amount_cents, campaign_id: campaign_id || null, donor_type: donorType },
    });

    return NextResponse.json({ success: true, checkout_url: session.url });
  } catch (error) {
    console.error("[Stripe Subscription] Fehler:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
