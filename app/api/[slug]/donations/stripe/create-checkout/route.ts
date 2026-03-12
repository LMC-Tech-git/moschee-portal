import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { resolveMosqueBySlug } from "@/lib/resolve-mosque";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { donationCheckoutSchema } from "@/lib/validations";
import { checkRateLimit, hashIP, getRateLimitHeaders } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/[slug]/donations/stripe/create-checkout
 * Erstellt eine Stripe Checkout Session und eine "created" Donation in PB.
 * Payment wird erst durch den Webhook bestätigt (P2: Payment only via webhook).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // 1. Moschee auflösen
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

    // 1b. Rate Limiting (IP-basiert)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const ipHash = await hashIP(ip);

    const rl = checkRateLimit(
      `donation:${ipHash}`,
      5, // Max 5 Checkout-Sessions pro IP pro Stunde
      60 * 60 * 1000
    );

    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut." },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    // 2. Body validieren
    const body = await request.json();
    const parsed = donationCheckoutSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Ungültige Eingabe";
      return NextResponse.json(
        { success: false, error: firstError },
        { status: 400 }
      );
    }

    // 2b. CAPTCHA (Turnstile) verifizieren
    const turnstileValid = await verifyTurnstileToken(body.turnstile_token || "");
    if (!turnstileValid) {
      return NextResponse.json(
        { success: false, error: "CAPTCHA-Verifizierung fehlgeschlagen. Bitte versuchen Sie es erneut." },
        { status: 400 }
      );
    }

    const { amount_cents, campaign_id, donor_name, donor_email } = parsed.data;

    // 2c. Auth-Token prüfen (optional — eingeloggte Mitglieder)
    let authenticatedUserId = "";
    let authenticatedDonorType: "member" | "guest" = "guest";
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.slice(7);
        // Token dekodieren und User-ID extrahieren
        const payload = JSON.parse(
          Buffer.from(token.split(".")[1], "base64").toString()
        );
        if (payload.id && payload.type === "authRecord") {
          // Verifizieren dass der User existiert und zur Moschee gehört
          const pbCheck = await getAdminPB();
          const userRecord = await pbCheck.collection("users").getOne(payload.id);
          if (userRecord.mosque_id === mosque.id) {
            authenticatedUserId = userRecord.id;
            authenticatedDonorType = "member";
          }
        }
      } catch {
        // Token ungültig → als Gast weiter
      }
    }

    // 3. Stripe API Key prüfen
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json(
        { success: false, error: "Stripe ist nicht konfiguriert" },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    // 4. Donation in PB erstellen (Status: "created")
    const pbAdmin = await getAdminPB();

    const donationData: Record<string, unknown> = {
      mosque_id: mosque.id,
      campaign_id: campaign_id || "",
      donor_type: authenticatedDonorType,
      donor_name: donor_name || "",
      donor_email: donor_email || "",
      amount: amount_cents / 100, // EUR (Pflichtfeld)
      amount_cents,
      currency: "EUR",
      is_recurring: false,
      provider: "stripe",
      payment_method: "stripe",
      status: "created",
    };
    if (authenticatedUserId) {
      donationData.user_id = authenticatedUserId;
    }

    const donation = await pbAdmin.collection("donations").create(donationData);

    logAudit({
      mosqueId: mosque.id,
      userId: authenticatedUserId || undefined,
      action: "donation.created",
      entityType: "donation",
      entityId: donation.id,
      details: { amount_cents, campaign_id: campaign_id || null, provider: "stripe", donor_type: authenticatedDonorType },
    });

    // 5. Stripe Checkout Session erstellen
    // Caddy leitet HTTPS-Anfragen intern an localhost:3000 weiter.
    // request.nextUrl.origin wäre "http://localhost:3000" → falsch für Stripe.
    // Stattdessen X-Forwarded-Host/-Proto aus den Caddy-Headers nutzen.
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
    const origin = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : request.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "sepa_debit"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: amount_cents,
            product_data: {
              name: campaign_id
                ? `Spende — ${mosque.name} (Kampagne)`
                : `Spende — ${mosque.name}`,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: donor_email || undefined,
      metadata: {
        mosque_id: mosque.id,
        donation_id: donation.id,
        campaign_id: campaign_id || "",
      },
      success_url: `${origin}/${params.slug}/donate?success=true`,
      cancel_url: `${origin}/${params.slug}/donate?cancelled=true`,
    });

    // 6. Provider-Ref speichern
    await pbAdmin.collection("donations").update(donation.id, {
      provider_ref: session.id,
      status: "pending",
    });

    return NextResponse.json({
      success: true,
      checkout_url: session.url,
    });
  } catch (error) {
    console.error("[Stripe Checkout] Fehler:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
