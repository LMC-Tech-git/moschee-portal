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
