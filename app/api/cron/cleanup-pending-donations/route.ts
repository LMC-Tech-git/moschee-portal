import { NextRequest, NextResponse } from "next/server";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { getStripe, stripeAccountFor } from "@/lib/stripe/client";
import { finalizeSuccessfulPayment, finalizeFailedPayment } from "@/lib/stripe/finalize";
import type { Mosque } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Cron: Cleanup für pending Donations älter als 14 Tage.
 * Macht NICHT blind failed — fragt Stripe vorher ab, ob Zahlung doch durchging
 * (verpasstes Webhook). Verhindert Inkonsistenz "Stripe sagt paid, wir failed".
 *
 * Aufruf täglich 5 Uhr:
 *   0 5 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://moschee.app/api/cron/cleanup-pending-donations
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret) {
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const pb = await getAdminPB();
    const stripe = getStripe();
    const cutoff = new Date(Date.now() - 14 * 86400000).toISOString();

    const stale = await pb.collection("donations").getFullList({
      filter: `status = "pending" && created < "${cutoff}"`,
    });

    let finalizedPaid = 0;
    let finalizedFailed = 0;
    let skipped = 0;
    const errors: { donation_id: string; error: string }[] = [];

    for (const d of stale) {
      if (!d.provider_ref) {
        await finalizeFailedPayment({
          donationId: d.id,
          mosqueId: d.mosque_id,
          source: "expired",
          reason: "Kein provider_ref gespeichert",
        });
        finalizedFailed++;
        continue;
      }

      try {
        // Mosque für stripeAccount-Routing laden
        const mosqueRec = await pb.collection("mosques").getOne(d.mosque_id);
        const mosque = mosqueRec as unknown as Mosque;
        let opts;
        try {
          opts = stripeAccountFor(mosque);
        } catch {
          // Mosque payments_mode = disabled — direkt failed_expired
          await finalizeFailedPayment({
            donationId: d.id,
            mosqueId: d.mosque_id,
            source: "expired",
            reason: "Mosque-Stripe nicht mehr verfügbar",
          });
          finalizedFailed++;
          continue;
        }

        // provider_ref kann cs_... (CheckoutSession) oder pi_... (PaymentIntent)
        // oder in_... (Invoice) sein. Wir versuchen CheckoutSession zuerst.
        let outcome: "paid" | "failed" | "still_pending" = "still_pending";
        let reason: string | undefined;

        if (d.provider_ref.startsWith("cs_")) {
          const session = await stripe.checkout.sessions.retrieve(d.provider_ref, opts);
          if (session.payment_status === "paid") {
            outcome = "paid";
          } else if (session.status === "expired") {
            outcome = "failed";
            reason = "Stripe-Session expired";
          } else if (session.payment_intent) {
            const piId = typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent.id;
            const pi = await stripe.paymentIntents.retrieve(piId, opts);
            if (pi.status === "succeeded") {
              outcome = "paid";
            } else if (["canceled", "requires_payment_method"].includes(pi.status)) {
              outcome = "failed";
              reason = pi.last_payment_error?.message || pi.status;
            }
          } else {
            outcome = "failed";
            reason = "Keine PaymentIntent zur Session";
          }
        } else if (d.provider_ref.startsWith("in_")) {
          // Invoice (recurring)
          const invoice = await stripe.invoices.retrieve(d.provider_ref, opts);
          if (invoice.status === "paid") {
            outcome = "paid";
          } else if (invoice.status === "uncollectible" || invoice.status === "void") {
            outcome = "failed";
            reason = `Invoice-Status: ${invoice.status}`;
          }
        } else if (d.provider_ref.startsWith("pi_")) {
          const pi = await stripe.paymentIntents.retrieve(d.provider_ref, opts);
          if (pi.status === "succeeded") {
            outcome = "paid";
          } else if (["canceled", "requires_payment_method"].includes(pi.status)) {
            outcome = "failed";
            reason = pi.last_payment_error?.message || pi.status;
          }
        }

        if (outcome === "paid") {
          // Webhook verpasst → nachträglich finalisieren
          await finalizeSuccessfulPayment({
            donationId: d.id,
            mosqueId: d.mosque_id,
            source: "expired_recheck",
          });
          finalizedPaid++;
        } else if (outcome === "failed") {
          await finalizeFailedPayment({
            donationId: d.id,
            mosqueId: d.mosque_id,
            source: "expired",
            reason: reason || "14 Tage ohne Bestätigung",
          });
          finalizedFailed++;
        } else {
          // Stripe sagt "noch pending" — Sub-Recurring kann lange dauern, später nochmal probieren
          skipped++;
        }
      } catch (err) {
        const msg = String((err as Error).message);
        errors.push({ donation_id: d.id, error: msg.slice(0, 200) });
        console.error(`[cleanup-pending] Donation ${d.id}:`, err);
        // Bei Stripe-API-Fehler nicht blind failed setzen — nächster Cron-Lauf
      }
    }

    return NextResponse.json({
      ok: true,
      total: stale.length,
      finalizedPaid,
      finalizedFailed,
      skipped,
      errors,
    });
  } catch (err) {
    console.error("[cleanup-pending-donations]", err);
    return NextResponse.json(
      { error: "Cleanup fehlgeschlagen", message: String((err as Error).message) },
      { status: 500 }
    );
  }
}
