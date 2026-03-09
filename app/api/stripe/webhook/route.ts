import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { logAudit } from "@/lib/audit";
import { sendEmailDirect } from "@/lib/email";
import { renderDonationReceipt } from "@/lib/email/templates";
import { notifyAdmins } from "@/lib/email/notify-admin";

/**
 * POST /api/stripe/webhook
 * Stripe Webhook Handler.
 * Bestätigt Zahlungen und aktualisiert Donations in PocketBase.
 * P2: Payment nur via Webhook — kein Client-seitiger Status-Update.
 */
export async function POST(request: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeKey || !webhookSecret) {
      console.error("[Stripe Webhook] Fehlende Konfiguration");
      return NextResponse.json(
        { error: "Webhook nicht konfiguriert" },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    // Raw Body für Signatur-Verifikation
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Keine Signatur" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("[Stripe Webhook] Signatur-Fehler:", err);
      return NextResponse.json(
        { error: "Signatur ungültig" },
        { status: 400 }
      );
    }

    const pb = await getAdminPB();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentType = session.metadata?.payment_type;
        const mosqueId = session.metadata?.mosque_id;

        if (paymentType === "fee") {
          // --- Madrasa-Gebühr ---
          const feeId = session.metadata?.fee_id;
          if (!feeId) {
            console.warn("[Stripe Webhook] Keine fee_id in Metadata");
            break;
          }
          if (session.payment_status === "paid") {
            await pb.collection("student_fees").update(feeId, {
              status: "paid",
              paid_at: new Date().toISOString(),
              payment_method: "stripe",
            });
            console.log(`[Stripe Webhook] StudentFee ${feeId} als bezahlt markiert`);
            if (mosqueId) {
              logAudit({
                mosqueId,
                action: "student_fee.paid_stripe",
                entityType: "student_fees",
                entityId: feeId,
                details: { amount_cents: session.amount_total, provider: "stripe" },
              });
            }
          }
          break;
        }

        // --- Spende ---
        const donationId = session.metadata?.donation_id;
        if (!donationId) {
          console.warn("[Stripe Webhook] Keine donation_id in Metadata");
          break;
        }

        if (session.payment_status === "paid") {
          await pb.collection("donations").update(donationId, {
            status: "paid",
            paid_at: new Date().toISOString(),
          });
          console.log(`[Stripe Webhook] Donation ${donationId} als bezahlt markiert`);

          if (mosqueId) {
            logAudit({
              mosqueId,
              action: "donation.paid",
              entityType: "donation",
              entityId: donationId,
              details: { amount_cents: session.amount_total, provider: "stripe" },
            });

            // Spendenquittung + Admin-Benachrichtigung (asynchron)
            Promise.allSettled([
              (async () => {
                try {
                  const donation = await pb.collection("donations").getOne(donationId);
                  const mosque = await pb.collection("mosques").getOne(mosqueId, {
                    fields: "name,brand_primary_color",
                  });

                  // Spender-E-Mail ermitteln
                  let toEmail: string | null = null;
                  let donorName: string | undefined;
                  if (donation.user_id) {
                    try {
                      const user = await pb.collection("users").getOne(donation.user_id, {
                        fields: "email,first_name,name",
                      });
                      toEmail = user.email || null;
                      donorName = user.first_name || user.name || undefined;
                    } catch { /* Gast-Spende */ }
                  }
                  if (!toEmail && donation.donor_email) {
                    toEmail = donation.donor_email;
                    donorName = donation.donor_name || undefined;
                  }

                  if (toEmail) {
                    const amountEur = ((session.amount_total || 0) / 100).toFixed(2).replace(".", ",");
                    const donationDate = new Date().toLocaleDateString("de-DE");
                    const html = renderDonationReceipt({
                      mosqueName: mosque.name,
                      donorName,
                      amountEur,
                      donationDate,
                      category: donation.category || undefined,
                      accentColor: mosque.brand_primary_color || undefined,
                    });
                    await sendEmailDirect({
                      to: toEmail,
                      subject: `Ihre Spendenbestätigung — ${mosque.name}`,
                      html,
                    });
                  }

                  // Admin benachrichtigen
                  const amountFormatted = (((session.amount_total || 0) / 100).toFixed(2) + " €").replace(".", ",");
                  await notifyAdmins({
                    mosqueId,
                    mosqueName: mosque.name,
                    title: "Neue Spende eingegangen",
                    message: `Eine Spende von <strong>${amountFormatted}</strong> wurde erfolgreich verarbeitet.`,
                    accentColor: mosque.brand_primary_color || undefined,
                  });
                } catch (e) {
                  console.error("[Stripe Webhook] E-Mail-Fehler:", e);
                }
              })(),
            ]);
          }
        }
        break;
      }

      case "checkout.session.async_payment_succeeded": {
        // SEPA-Lastschrift: Payment kommt verzögert
        const session = event.data.object as Stripe.Checkout.Session;
        const donationId = session.metadata?.donation_id;
        const mosqueId = session.metadata?.mosque_id;

        if (donationId) {
          await pb.collection("donations").update(donationId, {
            status: "paid",
            paid_at: new Date().toISOString(),
          });
          console.log(`[Stripe Webhook] Async-Payment ${donationId} bezahlt`);

          if (mosqueId) {
            logAudit({
              mosqueId,
              action: "donation.paid",
              entityType: "donation",
              entityId: donationId,
              details: { async: true, provider: "stripe" },
            });
          }
        }
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const donationId = session.metadata?.donation_id;
        const mosqueId = session.metadata?.mosque_id;

        if (donationId) {
          await pb.collection("donations").update(donationId, {
            status: "failed",
          });
          console.log(`[Stripe Webhook] Payment ${donationId} fehlgeschlagen`);

          if (mosqueId) {
            logAudit({
              mosqueId,
              action: "donation.failed",
              entityType: "donation",
              entityId: donationId,
              details: { provider: "stripe" },
            });
          }
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        // Suche die Donation anhand der Session
        if (charge.payment_intent) {
          try {
            const donation = await pb
              .collection("donations")
              .getFirstListItem(
                `provider_ref ~ "${charge.payment_intent}" && provider = "stripe"`
              );
            await pb.collection("donations").update(donation.id, {
              status: "refunded",
            });
            console.log(`[Stripe Webhook] Donation ${donation.id} erstattet`);

            logAudit({
              mosqueId: donation.mosque_id,
              action: "donation.refunded",
              entityType: "donation",
              entityId: donation.id,
              details: { provider: "stripe", payment_intent: charge.payment_intent },
            });
          } catch {
            console.warn("[Stripe Webhook] Donation für Refund nicht gefunden");
          }
        }
        break;
      }

      default:
        // Nicht behandelte Events einfach ignorieren
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Stripe Webhook] Fehler:", error);
    return NextResponse.json(
      { error: "Webhook-Fehler" },
      { status: 500 }
    );
  }
}
