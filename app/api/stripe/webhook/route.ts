import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { getAdminPB } from "@/lib/pocketbase-admin";
import { logAudit } from "@/lib/audit";
import { sendEmailDirect } from "@/lib/email";
import { renderDonationReceipt } from "@/lib/email/templates";
import { notifyAdmins } from "@/lib/email/notify-admin";
import { getStripe } from "@/lib/stripe/client";
import { accountFromEvent, fetchAccountState } from "@/lib/stripe/connect";
import {
  isAlreadyProcessed,
  recordEventReceived,
  markProcessed,
  markFailed,
} from "@/lib/stripe/idempotency";
import { finalizeSuccessfulPayment, finalizeFailedPayment } from "@/lib/stripe/finalize";
import {
  handleMembershipCheckoutCompleted,
  handleMembershipInvoiceFinalized,
  handleMembershipInvoicePaid,
  handleMembershipInvoiceFailed,
  handleMembershipInvoiceVoided,
} from "@/lib/stripe/membership-webhook";
import { getMembershipFeeSettings } from "@/lib/actions/settings";
import { markDonationPaidAndEmit } from "@/lib/actions/donations";
import { markStudentFeePaidAndEmit } from "@/lib/actions/student-fees";
import { markSponsorPaidAndEmit } from "@/lib/actions/sponsors";
import { refundIncome } from "@/lib/actions/finance-domain";
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
          // Finance-Event emittieren (Sprint 5)
          try {
            await markStudentFeePaidAndEmit(fee.id, paidNow, {
              mosqueIdHint: mosqueId,
              paymentMethod: "stripe",
              ctx: { webhook: true },
            });
          } catch (e) {
            console.error(`[Stripe Webhook] fee_multi emit fehlgeschlagen für fee ${fee.id}:`, e);
          }
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
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Stripe Webhook] Fehlende Konfiguration");
      return NextResponse.json(
        { error: "Webhook nicht konfiguriert" },
        { status: 500 }
      );
    }

    const stripe = getStripe();

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

    // Idempotenz-Guard — Stripe sendet Events mehrfach
    if (await isAlreadyProcessed(pb, event.id)) {
      console.log("[Stripe Webhook] Bereits verarbeitet:", event.id);
      return NextResponse.json({ received: true, deduped: true });
    }

    // Connect-Account-Resolution: bei Direct Charges trägt event.account
    // die Connected-Account-ID. mosque per Lookup auflösen.
    const connectedAccountId = accountFromEvent(event);
    let connectMosque: RecordModel | null = null;
    if (connectedAccountId) {
      try {
        connectMosque = await pb
          .collection("mosques")
          .getFirstListItem(`stripe_account_id = "${connectedAccountId}"`);
      } catch {
        // Account-ID unbekannt — Event trotzdem persistieren für Audit
      }
    }

    await recordEventReceived(pb, event, body, connectedAccountId, connectMosque?.id);

    const _meta = (event.data.object as Stripe.Checkout.Session | Stripe.PaymentIntent)?.metadata;
    console.log("[Stripe Webhook]", {
      type: event.type,
      id: event.id,
      account: connectedAccountId || "platform",
      mosque: connectMosque?.id,
      payment_type: _meta?.payment_type,
      registration_id: _meta?.registration_id,
      fee_id: _meta?.fee_id,
    });

    try {
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
            const paidAtStr = paidAt.toISOString();
            await pb.collection("sponsors").update(sponsorId, {
              payment_status: "paid",
              paid_at: paidAtStr,
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
              // Finance-Event emittieren (Sprint 5)
              try {
                await markSponsorPaidAndEmit(sponsorId, paidAtStr, {
                  mosqueIdHint: mosqueId,
                  externalEventId: session.id,
                  paymentMethod: "stripe",
                  monthsPaid: sponsorMonths,
                  ctx: { webhook: true },
                });
              } catch (e) {
                console.error(`[Stripe Webhook] sponsor emit fehlgeschlagen:`, e);
              }
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
            const feePaidAt = new Date().toISOString();
            await pb.collection("student_fees").update(feeId, {
              status: "paid",
              paid_at: feePaidAt,
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
              // Finance-Event emittieren (Sprint 5)
              try {
                await markStudentFeePaidAndEmit(feeId, feePaidAt, {
                  mosqueIdHint: mosqueId,
                  externalEventId: session.id,
                  paymentMethod: "stripe",
                  ctx: { webhook: true },
                });
              } catch (e) {
                console.error(`[Stripe Webhook] fee emit fehlgeschlagen:`, e);
              }
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

        if (paymentType === "membership_fee_subscription") {
          // --- Automatischer Mitgliedsbeitrags-Einzug: Abschluss ---
          const pbSubId = session.metadata?.pb_subscription_id;
          if (!pbSubId) {
            console.warn("[Stripe Webhook] membership: keine pb_subscription_id");
            break;
          }
          const fullSession =
            typeof session.subscription === "object" && session.subscription
              ? session
              : await stripe.checkout.sessions.retrieve(session.id, {
                  expand: ["subscription"],
                });
          const stripeSub = fullSession.subscription as Stripe.Subscription | null;
          if (!stripeSub) {
            console.warn(`[Stripe Webhook] membership ${pbSubId}: keine Subscription`);
            break;
          }
          let membershipEnabled = true;
          if (mosqueId) {
            const ms = await getMembershipFeeSettings(mosqueId);
            membershipEnabled = ms.data?.membership_fees_enabled ?? false;
          }
          await handleMembershipCheckoutCompleted({
            pb,
            stripeSub,
            pbSubId,
            mosqueId: mosqueId || "",
            membershipEnabled,
          });
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
          const paidAt = new Date().toISOString();
          await pb.collection("donations").update(donationId, {
            status: "paid",
            paid_at: paidAt,
          });
          console.log(`[Stripe Webhook] Donation ${donationId} als bezahlt markiert`);

          // Sprint 2 (F2): income_received-Event emittieren via Domain-Service.
          // Idempotent; bei Fehler kein Rollback (Sweeper fängt nach).
          if (mosqueId) {
            try {
              await markDonationPaidAndEmit(donationId, paidAt, {
                mosqueIdHint: mosqueId,
                externalEventId: session.id || undefined,
                ctx: { webhook: true },
              });
            } catch (e) {
              console.error("[Stripe Webhook] mark-paid emit fehlgeschlagen (Sweeper holt nach):", e);
            }

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
        const mosqueIdAsync = session.metadata?.mosque_id || connectMosque?.id;
        const donationId = session.metadata?.donation_id;

        if (donationId && mosqueIdAsync) {
          // Zentraler Finalizer: setzt status=paid + sendet Quittung + Admin-Notif
          await finalizeSuccessfulPayment({
            donationId,
            mosqueId: mosqueIdAsync,
            source: "checkout_async",
          });
        } else if (paymentTypeAsync === "fee" && mosqueIdAsync) {
          // Einzelne Madrasa-Gebühr (SEPA)
          const feeId = session.metadata?.fee_id;
          if (feeId) {
            const asyncFeePaidAt = new Date().toISOString();
            await pb.collection("student_fees").update(feeId, {
              status: "paid",
              paid_at: asyncFeePaidAt,
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
            // Finance-Event emittieren (Sprint 5)
            try {
              await markStudentFeePaidAndEmit(feeId, asyncFeePaidAt, {
                mosqueIdHint: mosqueIdAsync,
                externalEventId: session.id,
                paymentMethod: "stripe",
                ctx: { webhook: true },
              });
            } catch (e) {
              console.error(`[Stripe Webhook] async fee emit fehlgeschlagen:`, e);
            }
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
        const mosqueIdFailed = session.metadata?.mosque_id || connectMosque?.id;
        const donationId = session.metadata?.donation_id;

        if (donationId && mosqueIdFailed) {
          // Zentraler Failure-Handler: status=failed + SEPA-Failure-Email
          await finalizeFailedPayment({
            donationId,
            mosqueId: mosqueIdFailed,
            source: "checkout_async",
            reason: "SEPA-Lastschrift konnte nicht eingezogen werden",
          });
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
        const piId = typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : (charge.payment_intent as Stripe.PaymentIntent | null)?.id;
        if (!piId) break;

        const connectedAccountId = connectMosque?.stripe_account_id;
        const acctOpts = connectedAccountId ? { stripeAccount: connectedAccountId } : undefined;

        // 1. Quelle auflösen: donation (pi/invoice) → sonst fee/sponsor (session)
        let refundSource:
          | { collection: "donations" | "student_fees" | "sponsors"; rec: RecordModel }
          | null = null;

        // 1a. Donation via payment_intent ODER invoice (Subscription-Donations)
        let refundDonation: RecordModel | null = null;
        try {
          refundDonation = await pb.collection("donations").getFirstListItem(
            `provider_ref = "${piId}" && provider = "stripe"`
          );
        } catch {}
        if (!refundDonation && charge.invoice) {
          const invId = typeof charge.invoice === "string" ? charge.invoice : (charge.invoice as Stripe.Invoice).id;
          try {
            refundDonation = await pb.collection("donations").getFirstListItem(
              `provider_ref = "${invId}" && provider = "stripe"`
            );
          } catch {}
        }

        if (refundDonation) {
          refundSource = { collection: "donations", rec: refundDonation };
        } else {
          // 1b. Fee/Sponsor via Checkout-Session (provider_ref = session.id, NICHT pi).
          // fee_multi: Session ohne einzelne fee_id → KEIN Auto-Refund Phase 1
          // (Stripe liefert keine fee-ID-Verteilung). Admin → manuelle Storno-Buchung.
          try {
            const sessions = await stripe.checkout.sessions.list({ payment_intent: piId, limit: 1 }, acctOpts);
            const sessionId = sessions.data[0]?.id;
            if (sessionId) {
              for (const coll of ["student_fees", "sponsors"] as const) {
                try {
                  const rec = await pb.collection(coll).getFirstListItem(`provider_ref = "${sessionId}"`);
                  refundSource = { collection: coll, rec };
                  break;
                } catch {}
              }
            }
          } catch (e) {
            console.error("[Stripe Webhook] charge.refunded: fee/sponsor-Backref fehlgeschlagen:", e);
          }
        }

        if (!refundSource) {
          console.warn(`[Stripe Webhook] charge.refunded: keine Quelle für ${piId} gefunden (evtl. fee_multi → manuelle Storno-Buchung)`);
          break;
        }

        // 2. Refunds-Liste — has_more → nachladen
        let refundsList = (charge.refunds?.data || []) as Stripe.Refund[];
        if (charge.refunds?.has_more) {
          try {
            const full = await stripe.charges.retrieve(charge.id, { expand: ["refunds"] }, acctOpts);
            refundsList = (full.refunds?.data || []) as Stripe.Refund[];
          } catch (e) {
            console.error("[Stripe Webhook] charge.refunded: refunds expand fehlgeschlagen:", e);
          }
        }

        // 3. Pro Refund refundIncome aufrufen (UNIQUE-Index = Idempotenz bei Doppel-Delivery)
        for (let ri = 0; ri < refundsList.length; ri++) {
          const r = refundsList[ri];
          try {
            await refundIncome({
              mosqueId: refundSource.rec.mosque_id,
              sourceCollection: refundSource.collection,
              sourceId: refundSource.rec.id,
              refundAmountCents: r.amount,
              externalEventId: r.id,
              eventType: "income_refunded",
              reason: r.reason || undefined,
              occurredAt: new Date(((r.created ?? Date.now() / 1000)) * 1000).toISOString(),
              ctx: { webhook: true },
            });
          } catch (e) {
            console.error(`[Stripe Webhook] refundIncome fehlgeschlagen für refund ${r.id}:`, e);
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
        // Audit-only für Connect-Account (Donations laufen separat über checkout/invoice failed)
        if (connectMosque) {
          logAudit({
            mosqueId: connectMosque.id,
            action: "stripe.payment_intent.failed",
            entityType: "mosque",
            entityId: connectMosque.id,
            details: {
              payment_intent_id: pi.id.slice(0, 14) + "...",
              error: pi.last_payment_error?.message?.slice(0, 200) || pi.status,
            },
          });
        }
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

      case "invoice.finalized": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;
        if (!subId) break;
        const pbSub = await findPbSubscription(pb, stripe, subId);
        if (pbSub?.subscription_type === "membership_fee") {
          await handleMembershipInvoiceFinalized({ pb, ev: event, invoice, pbSub });
        }
        break;
      }

      case "invoice.voided":
      case "invoice.marked_uncollectible": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;
        if (!subId) break;
        const pbSub = await findPbSubscription(pb, stripe, subId);
        if (pbSub?.subscription_type === "membership_fee") {
          await handleMembershipInvoiceVoided({
            pb,
            ev: event,
            invoice,
            pbSub,
            uncollectible: event.type === "invoice.marked_uncollectible",
          });
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

        if (pbSub.subscription_type === "membership_fee") {
          await handleMembershipInvoicePaid({ pb, ev: event, invoice, pbSub });
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

        // Payment-Method-Detail aus PaymentIntent (card / sepa_debit) extrahieren
        let methodDetail = "";
        try {
          const piId = typeof invoice.payment_intent === "string"
            ? invoice.payment_intent
            : invoice.payment_intent?.id;
          if (piId) {
            const piOpts = connectedAccountId ? { stripeAccount: connectedAccountId } : undefined;
            const pi = await stripe.paymentIntents.retrieve(
              piId,
              { expand: ["latest_charge"] },
              piOpts,
            );
            const charge = pi.latest_charge as Stripe.Charge | string | null;
            if (charge && typeof charge !== "string") {
              methodDetail = charge.payment_method_details?.type || "";
            }
          }
        } catch {
          // best-effort, weiter ohne Detail
        }

        let newDonationId: string | null = null;
        try {
          const created = await pb.collection("donations").create({
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
            payment_method: "stripe",
            payment_method_detail: methodDetail,
            provider_ref: invoice.id,
            status: "pending", // Finalizer setzt paid + sendet Quittung
          });
          newDonationId = created.id;
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

        // Zentraler Finalizer: setzt paid + sendet Quittung + Admin-Notif
        if (newDonationId) {
          await finalizeSuccessfulPayment({
            donationId: newDonationId,
            mosqueId: pbSub.mosque_id,
            source: "invoice_paid",
          });
        }

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

        if (pbSub.subscription_type === "membership_fee") {
          await handleMembershipInvoiceFailed({ pb, ev: event, invoice, pbSub });
          break;
        }

        // Idempotenz für failed-Donation: bestehend → finalize, sonst neu mit pending → finalize fail
        let failDonationId: string | null = null;
        try {
          const existing = await pb
            .collection("donations")
            .getFirstListItem(
              `mosque_id = "${pbSub.mosque_id}" && provider = "stripe" && provider_ref = "${invoice.id}"`
            );
          failDonationId = existing.id;
        } catch {
          try {
            const created = await pb.collection("donations").create({
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
              status: "pending", // Finalizer setzt failed + sendet Email
            });
            failDonationId = created.id;
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

        // Zentraler Failure-Handler — sendet User-Email "SEPA fehlgeschlagen"
        if (failDonationId) {
          await finalizeFailedPayment({
            donationId: failDonationId,
            mosqueId: pbSub.mosque_id,
            source: "invoice_failed",
            reason: (invoice as unknown as { last_finalization_error?: { message?: string } })
              .last_finalization_error?.message || `Versuch ${invoice.attempt_count || 1}`,
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const stripeSub = event.data.object as Stripe.Subscription;
        const pbSub = await findPbSubscription(pb, stripe, stripeSub.id);
        if (!pbSub) break;

        // Stripe-Status 1:1 spiegeln (active/past_due/canceled/unpaid/incomplete);
        // subscription_type NICHT überschreiben.
        const mirrored = [
          "active",
          "past_due",
          "canceled",
          "unpaid",
          "incomplete",
        ].includes(stripeSub.status)
          ? { status: stripeSub.status }
          : {};
        await pb.collection("recurring_subscriptions").update(pbSub.id, {
          cancel_at_period_end: stripeSub.cancel_at_period_end || false,
          current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
          ...mirrored,
        });

        logAudit({
          mosqueId: pbSub.mosque_id,
          action:
            pbSub.subscription_type === "membership_fee"
              ? "membership_subscription.updated"
              : "donation_subscription.updated",
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
          status: "canceled",
          cancelled_at: new Date().toISOString(),
        });

        logAudit({
          mosqueId: pbSub.mosque_id,
          action:
            pbSub.subscription_type === "membership_fee"
              ? "membership_subscription.cancelled"
              : "donation_subscription.cancelled",
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

        // Chargeback-Event emittieren (Sprint 5)
        if (dispute.amount && dispute.amount > 0) {
          try {
            await refundIncome({
              mosqueId: donation.mosque_id,
              sourceCollection: "donations",
              sourceId: donation.id,
              refundAmountCents: dispute.amount,
              externalEventId: dispute.id,
              eventType: "chargeback",
              reason: dispute.reason || undefined,
              occurredAt: new Date(((dispute.created ?? Date.now() / 1000)) * 1000).toISOString(),
              ctx: { webhook: true },
            });
          } catch (e) {
            console.error("[Stripe Webhook] chargeback-Event fehlgeschlagen:", e);
          }
        }
        break;
      }

      // ─── Stripe Connect Account-Events ──────────────────────────
      case "account.updated": {
        const acc = event.data.object as Stripe.Account;
        try {
          const m = await pb
            .collection("mosques")
            .getFirstListItem(`stripe_account_id = "${acc.id}"`);
          const currentlyDue = acc.requirements?.currently_due ?? [];
          const eventuallyDue = acc.requirements?.eventually_due ?? [];
          const cardStatus =
            acc.capabilities?.card_payments === "active" || acc.capabilities?.card_payments === "pending"
              ? acc.capabilities.card_payments
              : "inactive";
          const sepaStatus =
            acc.capabilities?.sepa_debit_payments === "active" || acc.capabilities?.sepa_debit_payments === "pending"
              ? acc.capabilities.sepa_debit_payments
              : "inactive";
          const update: Record<string, unknown> = {
            stripe_charges_enabled: acc.charges_enabled ?? false,
            stripe_payouts_enabled: acc.payouts_enabled ?? false,
            stripe_details_submitted: acc.details_submitted ?? false,
            stripe_requirements_currently_due: currentlyDue,
            stripe_requirements_eventually_due: eventuallyDue,
            stripe_card_payments_status: cardStatus,
            stripe_sepa_debit_payments_status: sepaStatus,
            stripe_last_synced_at: new Date().toISOString(),
          };
          if (acc.details_submitted && !m.stripe_onboarded_at) {
            update.stripe_onboarded_at = new Date().toISOString();
          }
          await pb.collection("mosques").update(m.id, update);
          logAudit({
            mosqueId: m.id,
            action: "stripe.connect.account_updated",
            entityType: "mosque",
            entityId: m.id,
            details: {
              charges_enabled: acc.charges_enabled ?? false,
              payouts_enabled: acc.payouts_enabled ?? false,
              currently_due_count: currentlyDue.length,
              card_payments: cardStatus,
              sepa_debit_payments: sepaStatus,
            },
          });
        } catch {
          console.warn("[Stripe Webhook] account.updated für unbekannten Account:", acc.id);
        }
        break;
      }

      case "account.application.deauthorized": {
        // Mosque-Admin hat die App in Stripe getrennt → Zahlungen BLOCKIEREN.
        // payments_mode wird auf "disabled" gesetzt — NICHT "platform_legacy",
        // sonst landen Spenden ungewollt wieder auf dem Plattform-Konto.
        // event.data.object ist hier ein Application-Objekt — die Account-ID
        // kommt aus connectedAccountId (event.account).
        const accountId = connectedAccountId;
        if (!accountId) break;
        try {
          const m = await pb
            .collection("mosques")
            .getFirstListItem(`stripe_account_id = "${accountId}"`);
          await pb.collection("mosques").update(m.id, {
            payments_mode: "disabled",
            stripe_charges_enabled: false,
            stripe_payouts_enabled: false,
            stripe_last_synced_at: new Date().toISOString(),
          });
          logAudit({
            mosqueId: m.id,
            action: "stripe.connect.deauthorized",
            entityType: "mosque",
            entityId: m.id,
            details: { account_id_redacted: accountId.slice(0, 10) + "..." },
          });
          // TODO: Admin-Email "Stripe getrennt — Zahlungen blockiert"
        } catch {
          console.warn("[Stripe Webhook] deauthorized für unbekannten Account:", accountId);
        }
        break;
      }

      // ─── Audit-only Cases (kein Business-Effekt, nur Tracking) ─────────
      case "mandate.updated": {
        // SEPA-Mandat geändert (Widerruf, Status-Update). Nur loggen.
        const mandate = event.data.object as { id?: string; status?: string; payment_method?: string };
        if (connectMosque) {
          logAudit({
            mosqueId: connectMosque.id,
            action: "stripe.mandate.updated",
            entityType: "mosque",
            entityId: connectMosque.id,
            details: {
              mandate_id: mandate.id?.slice(0, 12) + "..." || "?",
              status: mandate.status || "?",
            },
          });
        }
        break;
      }

      default:
        // Nicht behandelte Events einfach ignorieren
        break;
    }

    await markProcessed(pb, event.id);
    } catch (procErr) {
      await markFailed(pb, event.id, String((procErr as Error).message));
      throw procErr;
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
