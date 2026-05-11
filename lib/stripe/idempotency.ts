import { createHash } from "crypto";
import type Stripe from "stripe";
import type { getAdminPB } from "@/lib/pocketbase-admin";

type PB = Awaited<ReturnType<typeof getAdminPB>>;

/**
 * Prüft ob ein Stripe-Event bereits verarbeitet wurde.
 * Schutz gegen Doppel-Donations bei Stripe-Retries.
 */
export async function isAlreadyProcessed(pb: PB, eventId: string): Promise<boolean> {
  try {
    const rec = await pb
      .collection("stripe_events")
      .getFirstListItem(`event_id = "${eventId}"`);
    return rec.status === "processed";
  } catch {
    return false;
  }
}

/**
 * Legt einen Event-Record an (Status "received").
 * Idempotent: bei Doppel-Insert wird stillschweigend übersprungen
 * (PB Unique-Index auf event_id schützt vor Duplikaten).
 *
 * payload_preview wird nur in Test-Mode gefüllt (Debugging).
 * payload_hash immer (sha256 von raw body).
 */
export async function recordEventReceived(
  pb: PB,
  event: Stripe.Event,
  rawBody: string,
  accountId?: string,
  mosqueId?: string
): Promise<void> {
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const isTest = process.env.STRIPE_MODE === "test";

  try {
    await pb.collection("stripe_events").create({
      event_id: event.id,
      type: event.type,
      api_version: event.api_version || "",
      account_id: accountId || "",
      mosque_id: mosqueId || "",
      received_at: new Date().toISOString(),
      status: "received",
      payload_hash: payloadHash,
      payload_preview: isTest ? rawBody.slice(0, 4000) : "",
    });
  } catch (err) {
    // Race: wenn parallel zwei Webhooks ankommen, kann der UNIQUE-Index zuschlagen.
    // Das ist OK — der andere Request übernimmt die Verarbeitung.
    console.warn("[stripe_events] recordEventReceived ignored:", String((err as Error).message));
  }
}

export async function markProcessed(pb: PB, eventId: string): Promise<void> {
  try {
    const rec = await pb
      .collection("stripe_events")
      .getFirstListItem(`event_id = "${eventId}"`);
    await pb.collection("stripe_events").update(rec.id, {
      status: "processed",
      processed_at: new Date().toISOString(),
      error: "",
    });
  } catch (err) {
    console.error("[stripe_events] markProcessed failed:", err);
  }
}

export async function markFailed(pb: PB, eventId: string, error: string): Promise<void> {
  try {
    const rec = await pb
      .collection("stripe_events")
      .getFirstListItem(`event_id = "${eventId}"`);
    await pb.collection("stripe_events").update(rec.id, {
      status: "failed",
      error: error.slice(0, 2000),
    });
  } catch (err) {
    console.error("[stripe_events] markFailed failed:", err);
  }
}
