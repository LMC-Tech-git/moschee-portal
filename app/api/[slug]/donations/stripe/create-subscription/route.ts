import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { resolveMosqueBySlug } from "@/lib/resolve-mosque";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { donationSubscriptionSchema } from "@/lib/validations";
import { checkRateLimit, hashIP, getRateLimitHeaders } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { logAudit } from "@/lib/audit";
import { normalizeEmail } from "@/lib/normalize-email";

/**
 * POST /api/[slug]/donations/stripe/create-subscription
 * Erstellt Stripe Checkout Session im "subscription"-Modus für monatliche Daueraufträge.
 * PB-Record startet mit status="pending" → wird vom Webhook auf "active" gesetzt.
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

    // Settings: Feature-Toggle + Min-Betrag
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
      const rl = checkRateLimit(
        `donation_sub:${ipHash}`,
        3,
        60 * 60 * 1000
      );
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

    const { amount_cents, campaign_id, donor_name, payment_method_type } = parsed.data;
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

    // Auth vollständig prüfen
    let authenticatedUserId = "";
    let donorType: "member" | "guest" = "guest";
    if (isPreAuthenticated && authHeaderPre?.startsWith("Bearer ")) {
      try {
        const token = authHeaderPre.slice(7);
        const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
        if (payload.id && payload.type === "authRecord") {
          const userRecord = await pb.collection("users").getOne(payload.id);
          if (userRecord.mosque_id === mosque.id) {
            authenticatedUserId = userRecord.id;
            donorType = "member";
          }
        }
      } catch {}
    }

    // Duplicate-Guard: kein zweites aktives Abo pro (mosque, email)
    try {
      const existing = await pb
        .collection("recurring_subscriptions")
        .getFirstListItem(
          `mosque_id = "${mosque.id}" && donor_email = "${donor_email}" && status = "active"`
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

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json(
        { success: false, error: "Stripe ist nicht konfiguriert" },
        { status: 500 }
      );
    }
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    // Stripe Customer reuse
    let customerId: string;
    const existingCustomers = await stripe.customers.list({ email: donor_email, limit: 10 });
    const reuse = existingCustomers.data.find((c) => c.metadata?.mosque_id === mosque.id);
    if (reuse) {
      customerId = reuse.id;
    } else {
      const customer = await stripe.customers.create({
        email: donor_email,
        name: donor_name || undefined,
        metadata: {
          mosque_id: mosque.id,
          ...(authenticatedUserId ? { user_id: authenticatedUserId } : {}),
        },
      });
      customerId = customer.id;
    }

    // PB-Record pending anlegen
    const subRecord = await pb.collection("recurring_subscriptions").create({
      mosque_id: mosque.id,
      donor_type: donorType,
      user_id: authenticatedUserId || "",
      donor_email,
      campaign_id: campaign_id || "",
      amount_cents,
      currency: "EUR",
      interval: "monthly",
      provider: "stripe",
      provider_subscription_id: "",
      status: "pending",
      last_payment_status: "pending",
    });

    // Checkout Session
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
    const origin = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : request.nextUrl.origin;

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
      { idempotencyKey: `sub:${subRecord.id}` }
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
