import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { logAudit } from "@/lib/audit";
import { sendEmailDirect } from "@/lib/email";
import { renderDonationReceipt } from "@/lib/email/templates";
import { notifyAdmins } from "@/lib/email/notify-admin";
import type { RecordModel } from "pocketbase";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Markiert alle offenen Gebühren eines Elternteils für mehrere Monate als bezahlt.
 * Kombiniert Legacy parent_id + parent_child_relations Junction Table.
 */
async function markFeeMultiPaid(
  pb: Awaited<ReturnType<typeof getAdminPB>>,
  mosqueId: string,
  parentUserId: string,
  startMonthKey: string,
  months: number,
  amountTotal: number | null
): Promise<void> {
  // Monatsliste
  const monthKeys: string[] = [];
  const [sy, sm] = startMonthKey.split("-").map(Number);
  for (let i = 0; i < months; i++) {
    const d = new Date(sy, sm - 1 + i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  // Kinder laden: Legacy + Junction Table
  const legacyStudents = await pb.collection("students").getFullList({
    filter: `mosque_id = "${mosqueId}" && status = "active" && (parent_id = "${parentUserId}" || father_user_id = "${parentUserId}" || mother_user_id = "${parentUserId}")`,
    fields: "id",
  });
  const studentIds = new Set<string>(legacyStudents.map((s) => s.id));

  let page = 1;
  while (true) {
    const res = await pb.collection("parent_child_relations").getList(page, 200, {
      filter: `mosque_id = "${mosqueId}" && parent_user = "${parentUserId}"`,
      fields: "student",
    });
    res.items.forEach((r) => { if (r.student) studentIds.add(r.student); });
    if (res.page >= res.totalPages) break;
    page++;
  }

  const paidNow = new Date().toISOString();
  const studentIdList = Array.from(studentIds);
  for (let si = 0; si < studentIdList.length; si++) {
    const studentId = studentIdList[si];
    for (let mi = 0; mi < monthKeys.length; mi++) {
      const monthKey = monthKeys[mi];
      const fees = await pb.collection("student_fees").getFullList({
        filter: `mosque_id = "${mosqueId}" && student_id = "${studentId}" && month_key = "${monthKey}"`,
      });
      for (const fee of fees) {
        if (fee.status === "open") {
          await pb.collection("student_fees").update(fee.id, {
            status: "paid",
            paid_at: paidNow,
            payment_method: "stripe",
          });
        }
      }
    }
  }

  console.log(`[Stripe Webhook] fee_multi: ${studentIds.size} Schüler × ${months} Monate bezahlt`);
  logAudit({
    mosqueId,
    action: "student_fee.multi_paid_stripe",
    entityType: "student_fees",
    entityId: parentUserId,
    details: { months, start_month_key: startMonthKey, amount_cents: amountTotal },
  });
}

// ─── Recurring Subscription Helpers ─────────────────────────────────────────

/**
 * Findet PB-Sub per Stripe-subscription_id. Fallback: liest metadata.pb_subscription_id
 * aus Stripe (für out-of-order Webhooks: invoice.paid kann vor checkout.session.completed kommen).
 */
async function findPbSubscription(
  pb: Awaited<ReturnType<typeof getAdminPB>>,
  stripe: Stripe,
  stripeSubscriptionId: string
): Promise<RecordModel | null> {
  try {
    return await pb
      .collection("recurring_subscriptions")
      .getFirstListItem(`provider_subscription_id = "${stripeSubscriptionId}"`);
  } catch {
    // Fallback: metadata.pb_subscription_id via Stripe
    try {
      const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const pbSubId = stripeSub.metadata?.pb_subscription_id;
      if (!pbSubId) return null;
      const pbSub = await pb.collection("recurring_subscriptions").getOne(pbSubId);
      // Fehlende Felder nachziehen
      await pb.collection("recurring_subscriptions").update(pbSub.id, {
        provider_subscription_id: stripeSub.id,
        status: stripeSub.status === "active" ? "active" : pbSub.status,
        current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
        ...(pbSub.started_at ? {} : { started_at: new Date().toISOString() }),
      });
      return await pb.collection("recurring_subscriptions").getOne(pbSub.id);
    } catch {
      return null;
    }
  }
}

/**
 * Prüft Feature-Toggle. Falls deaktiviert → flag setzen, trotzdem verarbeiten
 * (Geld ist bereits da — Zahlung nicht ignorieren).
 */
async function checkRecurringFeatureFlag(
  pb: Awaited<ReturnType<typeof getAdminPB>>,
  mosqueId: string,
  pbSubId: string
): Promise<void> {
  try {
    const settings = await pb
      .collection("settings")
      .getFirstListItem(`mosque_id = "${mosqueId}"`, {
        fields: "recurring_donations_enabled",
      });
    if (!settings.recurring_donations_enabled) {
      await pb.collection("recurring_subscriptions").update(pbSubId, {
        disabled_by_setting: true,
      });
      logAudit({
        mosqueId,
        action: "donation_subscription.processed_while_disabled",
        entityType: "recurring_subscription",
        entityId: pbSubId,
      });
    }
  } catch {
    // kein Settings → ignorieren
  }
}

// ─── Event Payment Finalization ──────────────────────────────────────────────

/**
 * Finalisiert eine bezahlte Event-Registrierung.
 * Idempotent, prüft Kapazität und Ablauf nochmals.
 */
async function finalizeEventRegistration(
  pb: Awaited<ReturnType<typeof getAdminPB>>,
  registrationId: string,
  method: "card" | "sepa",
  sessionId: string
): Promise<void> {
  let reg: RecordModel;
  try {
    reg = await pb.collection("event_registrations").getOne(registrationId);
  } catch {
    console.error(`[Stripe Webhook] event_registration ${registrationId} nicht gefunden`);
    return;
  }

  // Idempotenz
  if (reg.payment_status === "paid") return;

  // Zahlung nach Ablauf oder Fehlschlag → nur markieren, nicht aktivieren
  if (reg.payment_status === "expired" || reg.payment_status === "failed") {
    await pb.collection("event_registrations").update(registrationId, {
      cancel_reason: "payment_after_expiry",
    });
    console.warn(`[Stripe Webhook] Late/zombie payment: registration=${registrationId}, status=${reg.payment_status}`);
    return;
  }

  // Kapazität nochmal prüfen (Race Condition bei simultanen Zahlungen)
  try {
    const event = await pb.collection("events").getOne(reg.event_id);
    if (event.capacity > 0) {
      const confirmed = await pb.collection("event_registrations").getList(1, 1, {
        filter: `event_id = "${reg.event_id}" && status = "registered"`,
        fields: "id",
      });
      if (confirmed.totalItems >= event.capacity) {
        await pb.collection("event_registrations").update(registrationId, {
          status: "cancelled",
          payment_status: "paid",
          payment_method: method,
          cancel_reason: "overbooked",
        });
        console.warn(`[Stripe Webhook] Überbucht: event=${reg.event_id}, registration=${registrationId}`);
        return;
      }
    }
  } catch {
    // Event nicht gefunden — trotzdem finalisieren
  }

  await pb.collection("event_registrations").update(registrationId, {
    status: "registered",
    payment_status: "paid",
    payment_method: method,
    payment_ref: sessionId,
    paid_at: new Date().toISOString(),
  });

  if (reg.mosque_id) {
    logAudit({
      mosqueId: reg.mosque_id,
      action: "event_registration.paid_stripe",
      entityType: "event_registration",
      entityId: registrationId,
      details: { method, session_id: sessionId, event_id: reg.event_id, user_id: reg.user_id },
    });
  }
}

// ─── Webhook Handler ─────────────────────────────────────────────────────────

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

    // Logging: Event-Typ und relevante Metadata für Debugging
    const _meta = (event.data.object as Stripe.Checkout.Session | Stripe.PaymentIntent)?.metadata;
    console.log("[Stripe Webhook]", {
      type: event.type,
      id: event.id,
      payment_type: _meta?.payment_type,
      registration_id: _meta?.registration_id,
      fee_id: _meta?.fee_id,
    });

    const pb = await getAdminPB();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentType = session.metadata?.payment_type;
        const mosqueId = session.metadata?.mosque_id;

        if (paymentType === "sponsor") {
          // --- Förderpartner-Beitrag ---
          const sponsorId = session.metadata?.sponsor_id;
          if (!sponsorId) {
            console.warn("[Stripe Webhook] Keine sponsor_id in Metadata");
            break;
          }
          if (session.payment_status === "paid") {
            const sponsorMonths = parseInt(session.metadata?.months || "1", 10);
            const paidAt = new Date();
            const startDate = paidAt.toISOString().split("T")[0];
            const endDateObj = new Date(paidAt.getFullYear(), paidAt.getMonth() + sponsorMonths, 0);
            const endDate = endDateObj.toISOString().split("T")[0];
            await pb.collection("sponsors").update(sponsorId, {
              payment_status: "paid",
              paid_at: paidAt.toISOString(),
              payment_method: "stripe",
              is_active: true,
              months_paid: sponsorMonths,
              start_date: startDate,
              end_date: endDate,
              notification_sent: false,
            });
            console.log(`[Stripe Webhook] Sponsor ${sponsorId} als bezahlt markiert`);
            if (mosqueId) {
              logAudit({
                mosqueId,
                action: "sponsor.paid_stripe",
                entityType: "sponsors",
                entityId: sponsorId,
                details: { amount_cents: session.amount_total, provider: "stripe" },
              });
            }
          }
          break;
        }

        if (paymentType === "fee_multi") {
          // --- Mehrmonatige Madrasa-Vorauszahlung ---
          const parentUserId = session.metadata?.parent_user_id;
          const startMonthKey = session.metadata?.start_month_key;
          const months = parseInt(session.metadata?.months || "1", 10);
          if (!parentUserId || !startMonthKey || !mosqueId) {
            console.warn("[Stripe Webhook] fee_multi: fehlende Metadata");
            break;
          }
          if (session.payment_status === "paid") {
            await markFeeMultiPaid(pb, mosqueId, parentUserId, startMonthKey, months, session.amount_total);
          }
          // SEPA: payment_status = "unpaid" → async_payment_succeeded wird separat gefeuert
          break;
        }

        if (paymentType === "fee") {
          // --- Einzelne Madrasa-Gebühr ---
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

        if (paymentType === "event") {
          // --- Bezahlte Event-Registrierung ---
          const registrationId = session.metadata?.registration_id;
          if (!registrationId) {
            console.warn("[Stripe Webhook] Keine registration_id in Metadata");
            break;
          }
          if (session.payment_status === "paid") {
            // Kartenzahlung → sofort finalisieren
            await finalizeEventRegistration(pb, registrationId, "card", session.id);
          } else if (session.payment_status === "unpaid") {
            // SEPA-Mandat akzeptiert → Platz reservieren, Zahlung kommt async
            try {
              const reg = await pb.collection("event_registrations").getOne(registrationId);
              if (reg.payment_status !== "paid") {
                await pb.collection("event_registrations").update(registrationId, {
                  payment_status: "pending_sepa",
                  payment_method: "sepa",
                  payment_ref: session.id,
                });
              }
            } catch {
              console.warn(`[Stripe Webhook] SEPA-Update fehlgeschlagen für ${registrationId}`);
            }
          }
          break;
        }

        if (paymentType === "donation_subscription") {
          // --- Monatlicher Dauerauftrag: Abschluss ---
          const pbSubId = session.metadata?.pb_subscription_id;
          if (!pbSubId) {
            console.warn("[Stripe Webhook] Keine pb_subscription_id in Metadata");
            break;
          }
          const fullSession = typeof session.subscription === "object" && session.subscription
            ? session
            : await stripe.checkout.sessions.retrieve(session.id, { expand: ["subscription"] });
          const stripeSub = fullSession.subscription as Stripe.Subscription | null;
          if (!stripeSub) {
            console.warn(`[Stripe Webhook] donation_subscription ${pbSubId}: keine Subscription im Session-Expand`);
            break;
          }
          await pb.collection("recurring_subscriptions").update(pbSubId, {
            provider_subscription_id: stripeSub.id,
            started_at: new Date().toISOString(),
            current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
            status: "active",
          });
          if (mosqueId) {
            logAudit({
              mosqueId,
              action: "donation_subscription.created",
              entityType: "recurring_subscription",
              entityId: pbSubId,
              details: { stripe_sub_id: stripeSub.id },
            });
            await checkRecurringFeatureFlag(pb, mosqueId, pbSubId);
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
        const paymentTypeAsync = session.metadata?.payment_type;
        const mosqueIdAsync = session.metadata?.mosque_id;
        const donationId = session.metadata?.donation_id;

        if (donationId) {
          // Spende
          await pb.collection("donations").update(donationId, {
            status: "paid",
            paid_at: new Date().toISOString(),
          });
          console.log(`[Stripe Webhook] Async-Payment Spende ${donationId} bezahlt`);
          if (mosqueIdAsync) {
            logAudit({
              mosqueId: mosqueIdAsync,
              action: "donation.paid",
              entityType: "donation",
              entityId: donationId,
              details: { async: true, provider: "stripe" },
            });
          }
        } else if (paymentTypeAsync === "fee" && mosqueIdAsync) {
          // Einzelne Madrasa-Gebühr (SEPA)
          const feeId = session.metadata?.fee_id;
          if (feeId) {
            await pb.collection("student_fees").update(feeId, {
              status: "paid",
              paid_at: new Date().toISOString(),
              payment_method: "stripe",
            });
            console.log(`[Stripe Webhook] Async-Payment Gebühr ${feeId} bezahlt`);
            logAudit({
              mosqueId: mosqueIdAsync,
              action: "student_fee.paid_stripe",
              entityType: "student_fees",
              entityId: feeId,
              details: { async: true },
            });
          }
        } else if (paymentTypeAsync === "fee_multi" && mosqueIdAsync) {
          // Mehrmonatige Vorauszahlung (SEPA)
          const parentUserId = session.metadata?.parent_user_id;
          const startMonthKey = session.metadata?.start_month_key;
          const months = parseInt(session.metadata?.months || "1", 10);
          if (parentUserId && startMonthKey) {
            await markFeeMultiPaid(pb, mosqueIdAsync, parentUserId, startMonthKey, months, session.amount_total);
          }
        } else if (paymentTypeAsync === "event") {
          // SEPA-Zahlung für Event bestätigt
          const registrationId = session.metadata?.registration_id;
          if (registrationId) {
            await finalizeEventRegistration(pb, registrationId, "sepa", session.id);
          }
        }
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentTypeFailed = session.metadata?.payment_type;
        const mosqueIdFailed = session.metadata?.mosque_id;
        const donationId = session.metadata?.donation_id;

        if (donationId) {
          // Spende
          await pb.collection("donations").update(donationId, { status: "failed" });
          console.log(`[Stripe Webhook] Payment Spende ${donationId} fehlgeschlagen`);
          if (mosqueIdFailed) {
            logAudit({
              mosqueId: mosqueIdFailed,
              action: "donation.failed",
              entityType: "donation",
              entityId: donationId,
              details: { provider: "stripe" },
            });
          }
        } else if (paymentTypeFailed === "fee" && mosqueIdFailed) {
          // Einzelne Madrasa-Gebühr
          const feeId = session.metadata?.fee_id;
          if (feeId) {
            console.log(`[Stripe Webhook] SEPA-Zahlung Gebühr ${feeId} fehlgeschlagen`);
            logAudit({
              mosqueId: mosqueIdFailed,
              action: "student_fee.failed_stripe",
              entityType: "student_fees",
              entityId: feeId,
              details: { async: true },
            });
          }
        } else if (paymentTypeFailed === "fee_multi" && mosqueIdFailed) {
          const parentUserId = session.metadata?.parent_user_id;
          console.log(`[Stripe Webhook] SEPA-Zahlung fee_multi für ${parentUserId} fehlgeschlagen`);
          logAudit({
            mosqueId: mosqueIdFailed,
            action: "student_fee.multi_failed_stripe",
            entityType: "student_fees",
            entityId: parentUserId || "",
            details: { async: true },
          });
        } else if (paymentTypeFailed === "event") {
          // SEPA-Zahlung für Event fehlgeschlagen → auf Barzahlung umschalten
          const registrationId = session.metadata?.registration_id;
          if (registrationId) {
            try {
              await pb.collection("event_registrations").update(registrationId, {
                status: "pending",   // Platz bleibt reserviert für Barzahlung
                payment_status: "pending",
                payment_method: "cash",
                original_payment_method: "sepa",
                cancel_reason: "sepa_failed",
              });
              if (mosqueIdFailed) {
                logAudit({
                  mosqueId: mosqueIdFailed,
                  action: "event_registration.sepa_failed",
                  entityType: "event_registration",
                  entityId: registrationId,
                  details: { event_id: session.metadata?.event_id },
                });
              }
            } catch {
              console.warn(`[Stripe Webhook] SEPA-Failed-Update fehlgeschlagen für ${registrationId}`);
            }
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

      // SEPA-Fallback: payment_intent.succeeded kommt wenn checkout.session.async_payment_succeeded
      // nicht geliefert wird (je nach Stripe-Konfiguration)
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const registrationId = pi.metadata?.registration_id;
        if (registrationId && pi.metadata?.payment_type === "event") {
          await finalizeEventRegistration(pb, registrationId, "sepa", pi.id);
          console.log(`[Stripe Webhook] payment_intent.succeeded → Event-Registrierung ${registrationId} finalisiert`);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const registrationId = pi.metadata?.registration_id;
        if (registrationId && pi.metadata?.payment_type === "event") {
          try {
            const reg = await pb.collection("event_registrations").getOne(registrationId);
            if (reg.payment_status !== "paid") {
              await pb.collection("event_registrations").update(registrationId, {
                status: "pending",
                payment_status: "pending",
                payment_method: "cash",
                original_payment_method: reg.payment_method || "sepa",
                cancel_reason: "sepa_failed",
              });
              console.log(`[Stripe Webhook] payment_intent.payment_failed → Registrierung ${registrationId} auf Cash umgestellt`);
            }
          } catch {
            console.warn(`[Stripe Webhook] payment_intent.payment_failed: Registrierung ${registrationId} nicht gefunden`);
          }
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;
        if (!subId) break;

        const pbSub = await findPbSubscription(pb, stripe, subId);
        if (!pbSub) {
          console.warn(`[Stripe Webhook] invoice.paid: PB-Sub für ${subId} nicht auffindbar`);
          break;
        }

        const paidTs =
          invoice.status_transitions?.paid_at ??
          (invoice as unknown as { paid_at?: number }).paid_at ??
          invoice.created;
        const paidAt = new Date(paidTs * 1000).toISOString();

        // Idempotenz: invoice.id bereits als donation?
        try {
          await pb
            .collection("donations")
            .getFirstListItem(
              `mosque_id = "${pbSub.mosque_id}" && provider = "stripe" && provider_ref = "${invoice.id}"`
            );
          console.log(`[Stripe Webhook] invoice.paid: Donation für ${invoice.id} existiert schon`);
          // Donation existiert — aber Sub-Status ggf. noch nicht aktualisiert (Race-Condition)
          if (pbSub.last_payment_status !== "paid") {
            await pb.collection("recurring_subscriptions").update(pbSub.id, {
              last_payment_status: "paid",
              last_payment_at: paidAt,
              ...(invoice.period_end
                ? { current_period_end: new Date(invoice.period_end * 1000).toISOString() }
                : {}),
            });
          }
          break;
        } catch {
          // nicht vorhanden → weiter
        }

        try {
          await pb.collection("donations").create({
            mosque_id: pbSub.mosque_id,
            campaign_id: pbSub.campaign_id || "",
            donor_type: pbSub.donor_type,
            user_id: pbSub.user_id || "",
            donor_email: pbSub.donor_email || "",
            amount: (invoice.amount_paid ?? invoice.total ?? 0) / 100,
            amount_cents: invoice.amount_paid ?? invoice.total ?? 0,
            currency: "EUR",
            is_recurring: true,
            subscription_id: pbSub.id,
            provider: "stripe",
            provider_ref: invoice.id,
            status: "paid",
            paid_at: paidAt,
          });
        } catch (e) {
          console.warn(`[Stripe Webhook] invoice.paid: Donation create fehlgeschlagen (evtl. Race):`, e);
        }

        await pb.collection("recurring_subscriptions").update(pbSub.id, {
          last_payment_status: "paid",
          last_payment_at: paidAt,
          ...(invoice.period_end
            ? { current_period_end: new Date(invoice.period_end * 1000).toISOString() }
            : {}),
        });

        logAudit({
          mosqueId: pbSub.mosque_id,
          action: "donation_subscription.payment_succeeded",
          entityType: "recurring_subscription",
          entityId: pbSub.id,
          details: {
            amount_cents: invoice.amount_paid,
            invoice_id: invoice.id,
            subscription_id: pbSub.id,
            stripe_sub_id: subId,
          },
        });

        await checkRecurringFeatureFlag(pb, pbSub.mosque_id, pbSub.id);

        // Spendenquittung
        (async () => {
          try {
            const mosque = await pb.collection("mosques").getOne(pbSub.mosque_id, {
              fields: "name,brand_primary_color",
            });
            let toEmail: string | null = null;
            let donorName: string | undefined;
            if (pbSub.user_id) {
              try {
                const user = await pb.collection("users").getOne(pbSub.user_id, {
                  fields: "email,first_name,name",
                });
                toEmail = user.email || null;
                donorName = user.first_name || user.name || undefined;
              } catch {}
            }
            if (!toEmail) toEmail = pbSub.donor_email || null;
            if (toEmail) {
              const amountEur = ((invoice.amount_paid || 0) / 100).toFixed(2).replace(".", ",");
              const html = renderDonationReceipt({
                mosqueName: mosque.name,
                donorName,
                amountEur,
                donationDate: new Date(paidAt).toLocaleDateString("de-DE"),
                accentColor: mosque.brand_primary_color || undefined,
              });
              await sendEmailDirect({
                to: toEmail,
                subject: `Ihre Spendenbestätigung (Dauerauftrag) — ${mosque.name}`,
                html,
              });
            }
          } catch (e) {
            console.error("[Stripe Webhook] invoice.paid E-Mail-Fehler:", e);
          }
        })();

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;
        if (!subId) break;

        const pbSub = await findPbSubscription(pb, stripe, subId);
        if (!pbSub) {
          console.warn(`[Stripe Webhook] invoice.payment_failed: PB-Sub für ${subId} nicht auffindbar`);
          break;
        }

        // Idempotenz für failed-Donation
        try {
          await pb
            .collection("donations")
            .getFirstListItem(
              `mosque_id = "${pbSub.mosque_id}" && provider = "stripe" && provider_ref = "${invoice.id}"`
            );
        } catch {
          try {
            await pb.collection("donations").create({
              mosque_id: pbSub.mosque_id,
              campaign_id: pbSub.campaign_id || "",
              donor_type: pbSub.donor_type,
              user_id: pbSub.user_id || "",
              donor_email: pbSub.donor_email || "",
              amount: (invoice.amount_due || 0) / 100,
              amount_cents: invoice.amount_due || 0,
              currency: "EUR",
              is_recurring: true,
              subscription_id: pbSub.id,
              provider: "stripe",
              provider_ref: invoice.id,
              status: "failed",
            });
          } catch (e) {
            console.warn(`[Stripe Webhook] invoice.payment_failed: Donation create fehlgeschlagen:`, e);
          }
        }

        await pb.collection("recurring_subscriptions").update(pbSub.id, {
          last_payment_status: "failed",
          last_payment_at: new Date().toISOString(),
        });

        logAudit({
          mosqueId: pbSub.mosque_id,
          action: "donation_subscription.payment_failed",
          entityType: "recurring_subscription",
          entityId: pbSub.id,
          details: { invoice_id: invoice.id, attempt_count: invoice.attempt_count },
        });
        break;
      }

      case "customer.subscription.updated": {
        const stripeSub = event.data.object as Stripe.Subscription;
        const pbSub = await findPbSubscription(pb, stripe, stripeSub.id);
        if (!pbSub) break;

        await pb.collection("recurring_subscriptions").update(pbSub.id, {
          cancel_at_period_end: stripeSub.cancel_at_period_end || false,
          current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
        });

        logAudit({
          mosqueId: pbSub.mosque_id,
          action: "donation_subscription.updated",
          entityType: "recurring_subscription",
          entityId: pbSub.id,
          details: {
            status: stripeSub.status,
            cancel_at_period_end: stripeSub.cancel_at_period_end,
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const stripeSub = event.data.object as Stripe.Subscription;
        const pbSub = await findPbSubscription(pb, stripe, stripeSub.id);
        if (!pbSub) break;

        await pb.collection("recurring_subscriptions").update(pbSub.id, {
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        });

        logAudit({
          mosqueId: pbSub.mosque_id,
          action: "donation_subscription.cancelled",
          entityType: "recurring_subscription",
          entityId: pbSub.id,
          details: { reason: "period_end" },
        });
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const paymentIntentId = typeof dispute.payment_intent === "string"
          ? dispute.payment_intent
          : dispute.payment_intent?.id;
        if (!paymentIntentId) break;

        // Donation per payment_intent ODER invoice-ref suchen
        let donation: RecordModel | null = null;
        try {
          donation = await pb
            .collection("donations")
            .getFirstListItem(`provider_ref = "${paymentIntentId}" && provider = "stripe"`);
        } catch {}

        if (!donation && dispute.charge) {
          try {
            const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
            const charge = await stripe.charges.retrieve(chargeId, { expand: ["invoice"] });
            const inv = charge.invoice;
            const invoiceId = typeof inv === "string" ? inv : inv?.id;
            if (invoiceId) {
              donation = await pb
                .collection("donations")
                .getFirstListItem(`provider_ref = "${invoiceId}" && provider = "stripe"`);
            }
          } catch {}
        }

        if (!donation) {
          console.warn(`[Stripe Webhook] charge.dispute.created: Donation für ${paymentIntentId} nicht gefunden`);
          break;
        }

        await pb.collection("donations").update(donation.id, { status: "disputed" });

        logAudit({
          mosqueId: donation.mosque_id,
          action: "donation.disputed",
          entityType: "donation",
          entityId: donation.id,
          details: { reason: dispute.reason, amount_cents: dispute.amount },
        });

        try {
          const mosque = await pb.collection("mosques").getOne(donation.mosque_id, {
            fields: "name,brand_primary_color",
          });
          const amountFormatted = ((dispute.amount || 0) / 100).toFixed(2).replace(".", ",") + " €";
          await notifyAdmins({
            mosqueId: donation.mosque_id,
            mosqueName: mosque.name,
            title: "Zahlungsanfechtung (Dispute)",
            message: `Eine Spende von <strong>${amountFormatted}</strong> wurde angefochten. Grund: ${dispute.reason}. Bitte im Stripe-Dashboard prüfen.`,
            accentColor: mosque.brand_primary_color || undefined,
          });
        } catch (e) {
          console.error("[Stripe Webhook] dispute admin-notify Fehler:", e);
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
