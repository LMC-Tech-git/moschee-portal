import { getAdminPB } from "@/lib/pocketbase-admin";
import { logAudit } from "@/lib/audit";
import { sendEmailDirect } from "@/lib/email";
import { renderDonationReceipt, renderSepaFailureEmail } from "@/lib/email/templates";
import { notifyAdmins } from "@/lib/email/notify-admin";
import type { RecordModel } from "pocketbase";

type PB = Awaited<ReturnType<typeof getAdminPB>>;
type FinalizeSource = "checkout_async" | "invoice_paid" | "expired_recheck";
type FailSource = "checkout_async" | "invoice_failed" | "expired";

/**
 * Lädt Donor-Email für eine Donation (User-Lookup oder Gast-Email-Fallback).
 */
async function resolveDonorEmail(
  pb: PB,
  donation: RecordModel
): Promise<{ email: string | null; name?: string }> {
  if (donation.user_id) {
    try {
      const user = await pb.collection("users").getOne(donation.user_id, {
        fields: "email,first_name,name",
      });
      return {
        email: user.email || null,
        name: user.first_name || user.name || undefined,
      };
    } catch {
      // Fallback Gast
    }
  }
  return {
    email: donation.donor_email || null,
    name: donation.donor_name || undefined,
  };
}

/**
 * Zentrale Erfolgs-Finalisierung einer Donation.
 * Aufgerufen aus exakt zwei Webhook-Quellen + Cleanup-Cron-Recheck:
 *  - checkout.session.async_payment_succeeded
 *  - invoice.paid (recurring)
 *  - cleanup-cron (expired_recheck — Stripe sagt paid, wir hatten Webhook verpasst)
 *
 * Idempotent: bei status="paid" passiert nichts.
 * Versendet Quittung + Admin-Notif.
 */
export async function finalizeSuccessfulPayment(args: {
  donationId: string;
  mosqueId: string;
  source: FinalizeSource;
}): Promise<void> {
  const pb = await getAdminPB();
  const donation = await pb.collection("donations").getOne(args.donationId);

  if (donation.status === "paid") return;

  await pb.collection("donations").update(args.donationId, {
    status: "paid",
    paid_at: new Date().toISOString(),
  });

  logAudit({
    mosqueId: args.mosqueId,
    action: "donation.paid",
    entityType: "donation",
    entityId: args.donationId,
    details: {
      source: args.source,
      provider: donation.provider || "stripe",
      amount_cents: donation.amount_cents,
    },
  });

  // Email + Admin-Notif (best-effort, blockiert Webhook nicht bei Fehler)
  try {
    const mosque = await pb.collection("mosques").getOne(args.mosqueId, {
      fields: "name,brand_primary_color",
    });
    const { email, name } = await resolveDonorEmail(pb, donation);

    if (email) {
      const amountEur = ((donation.amount_cents || 0) / 100).toFixed(2).replace(".", ",");
      const html = renderDonationReceipt({
        mosqueName: mosque.name,
        donorName: name,
        amountEur,
        donationDate: new Date().toLocaleDateString("de-DE"),
        category: donation.category || undefined,
        accentColor: mosque.brand_primary_color || undefined,
      });
      await sendEmailDirect({
        to: email,
        subject: donation.is_recurring
          ? `Ihre Spendenbestätigung (Dauerauftrag) — ${mosque.name}`
          : `Ihre Spendenbestätigung — ${mosque.name}`,
        html,
      });
    }

    const amountFormatted = (((donation.amount_cents || 0) / 100).toFixed(2) + " €").replace(".", ",");
    await notifyAdmins({
      mosqueId: args.mosqueId,
      mosqueName: mosque.name,
      title: donation.is_recurring ? "Neue Dauerauftrag-Zahlung" : "Neue Spende eingegangen",
      message: `Eine Spende von <strong>${amountFormatted}</strong> wurde erfolgreich verarbeitet.`,
      accentColor: mosque.brand_primary_color || undefined,
    });
  } catch (err) {
    console.error("[finalize] Email/Notify-Fehler:", err);
  }
}

/**
 * Zentrale Fehler-Finalisierung.
 * Aufgerufen aus:
 *  - checkout.session.async_payment_failed
 *  - invoice.payment_failed
 *  - cleanup-cron (14-Tage-Expiry → failed_expired)
 *
 * Idempotent. Versendet User-Email mit Fehlergrund.
 */
export async function finalizeFailedPayment(args: {
  donationId: string;
  mosqueId: string;
  source: FailSource;
  reason?: string;
}): Promise<void> {
  const pb = await getAdminPB();
  const donation = await pb.collection("donations").getOne(args.donationId);

  if (donation.status === "failed" || donation.status === "failed_expired") return;

  const newStatus = args.source === "expired" ? "failed_expired" : "failed";
  await pb.collection("donations").update(args.donationId, {
    status: newStatus,
  });

  logAudit({
    mosqueId: args.mosqueId,
    action: newStatus === "failed_expired" ? "donation.failed_expired" : "donation.failed",
    entityType: "donation",
    entityId: args.donationId,
    details: {
      source: args.source,
      reason: args.reason ? args.reason.slice(0, 200) : undefined,
      provider: donation.provider || "stripe",
    },
  });

  // User-Email "SEPA-Lastschrift fehlgeschlagen"
  try {
    const mosque = await pb.collection("mosques").getOne(args.mosqueId, {
      fields: "name,brand_primary_color,slug",
    });
    const { email, name } = await resolveDonorEmail(pb, donation);
    if (email) {
      const amountEur = ((donation.amount_cents || 0) / 100).toFixed(2).replace(".", ",");
      const html = renderSepaFailureEmail({
        mosqueName: mosque.name,
        mosqueSlug: mosque.slug,
        donorName: name,
        amountEur,
        reason: args.reason,
        accentColor: mosque.brand_primary_color || undefined,
        expired: newStatus === "failed_expired",
      });
      await sendEmailDirect({
        to: email,
        subject: `SEPA-Lastschrift fehlgeschlagen — ${mosque.name}`,
        html,
      });
    }
  } catch (err) {
    console.error("[finalize] Failure-Email-Fehler:", err);
  }
}
