"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { getAuthFromCookie } from "@/lib/auth-cookie";
import { logAudit } from "@/lib/audit";
import { checkDemoLimit } from "@/lib/demo";
import { sendPushToUser } from "@/lib/push";
import type { PushTopic } from "@/types";

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

const VALID_TOPICS: PushTopic[] = [
  "prayer_times",
  "events",
  "donations",
  "posts",
  "madrasa",
];

interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Lädt den eingeloggten User serverseitig inkl. mosque_id (nie vom Client). */
async function resolveUser(): Promise<
  { userId: string; mosqueId: string } | null
> {
  const auth = getAuthFromCookie();
  if (!auth.isLoggedIn || !auth.userId) return null;
  try {
    const pb = await getAdminPB();
    const user = await pb.collection("users").getOne(auth.userId);
    if (!user?.mosque_id) return null;
    return { userId: auth.userId, mosqueId: user.mosque_id };
  } catch {
    return null;
  }
}

/**
 * Speichert oder aktualisiert eine Push-Subscription für den eingeloggten User.
 * Upsert anhand des (uniquen) endpoint.
 */
export async function saveSubscription(
  subscription: BrowserSubscription,
  topics: PushTopic[]
): Promise<ActionResult> {
  const ctx = await resolveUser();
  if (!ctx) return { success: false, error: "Nicht angemeldet." };

  if (
    !subscription?.endpoint ||
    !subscription?.keys?.p256dh ||
    !subscription?.keys?.auth
  ) {
    return { success: false, error: "Ungültige Subscription." };
  }

  const cleanTopics = (topics || []).filter((t) =>
    VALID_TOPICS.includes(t)
  );

  const pb = await getAdminPB();

  // Existierende Subscription dieses Users mit gleichem Endpoint suchen
  let existingId = "";
  try {
    const list = await pb.collection("push_subscriptions").getFullList({
      filter: `user_id = "${ctx.userId}"`,
    });
    const match = list.find(
      (r) => (r as { endpoint?: string }).endpoint === subscription.endpoint
    );
    if (match) existingId = match.id;
  } catch {
    /* weiter: dann anlegen */
  }

  // Demo-Limit nur bei Neuanlage prüfen
  if (!existingId) {
    const demo = await checkDemoLimit(ctx.mosqueId, "push_subscriptions");
    if (!demo.allowed) {
      return { success: false, error: demo.error || "Demo-Limit erreicht." };
    }
  }

  const data = {
    mosque_id: ctx.mosqueId,
    user_id: ctx.userId,
    endpoint: subscription.endpoint,
    p256dh_key: subscription.keys.p256dh,
    auth_key: subscription.keys.auth,
    topics: cleanTopics,
  };

  try {
    if (existingId) {
      await pb.collection("push_subscriptions").update(existingId, {
        topics: cleanTopics,
        p256dh_key: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
      });
    } else {
      await pb.collection("push_subscriptions").create(data);
    }
  } catch (err) {
    console.error("[push] saveSubscription:", err);
    return { success: false, error: "Konnte nicht gespeichert werden." };
  }

  await logAudit({
    mosqueId: ctx.mosqueId,
    userId: ctx.userId,
    action: existingId ? "push_update" : "push_subscribe",
    entityType: "push_subscription",
    entityId: existingId || subscription.endpoint.slice(-24),
    details: { topics: cleanTopics },
  });

  return { success: true };
}

/** Entfernt eine Subscription (Owner-geschützt) anhand des endpoint. */
export async function removeSubscription(
  endpoint: string
): Promise<ActionResult> {
  const ctx = await resolveUser();
  if (!ctx) return { success: false, error: "Nicht angemeldet." };
  if (!endpoint) return { success: false, error: "Kein Endpoint." };

  const pb = await getAdminPB();
  try {
    const list = await pb.collection("push_subscriptions").getFullList({
      filter: `user_id = "${ctx.userId}"`,
    });
    const match = list.find(
      (r) => (r as { endpoint?: string }).endpoint === endpoint
    );
    if (match) {
      await pb.collection("push_subscriptions").delete(match.id);
      await logAudit({
        mosqueId: ctx.mosqueId,
        userId: ctx.userId,
        action: "push_unsubscribe",
        entityType: "push_subscription",
        entityId: match.id,
      });
    }
  } catch (err) {
    console.error("[push] removeSubscription:", err);
    return { success: false, error: "Konnte nicht entfernt werden." };
  }
  return { success: true };
}

/** Sendet eine Test-Benachrichtigung an alle Geräte des eingeloggten Users. */
export async function sendTestPush(payload: {
  title: string;
  body: string;
}): Promise<ActionResult<{ delivered: number }>> {
  const ctx = await resolveUser();
  if (!ctx) return { success: false, error: "Nicht angemeldet." };

  const delivered = await sendPushToUser(ctx.userId, {
    title: payload.title,
    body: payload.body,
    url: "/member/profile",
    tag: "test",
  });

  return { success: true, data: { delivered } };
}
