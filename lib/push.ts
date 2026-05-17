import webpush from "web-push";
import { getAdminPB } from "@/lib/pocketbase-admin";

/**
 * Web-Push Versand-Layer.
 * Graceful degradation: ohne VAPID-Keys werden Sends still übersprungen.
 */

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:kontakt@moschee.app";

let configured = false;

export function isPushConfigured(): boolean {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  if (!configured) {
    try {
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
      configured = true;
    } catch (err) {
      console.error("[push] VAPID-Konfiguration fehlgeschlagen:", err);
      return false;
    }
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Ziel-URL beim Klick (relativ, z.B. "/events"). */
  url?: string;
  /** tag — neuere Notification mit gleichem tag ersetzt ältere. */
  tag?: string;
  icon?: string;
  badge?: string;
}

interface SubRecord {
  id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  topics: string[] | string | null;
}

function parseTopics(raw: SubRecord["topics"]): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw) {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function sendToSub(
  sub: SubRecord,
  payload: PushPayload
): Promise<{ ok: boolean; gone: boolean }> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
      },
      JSON.stringify(payload)
    );
    return { ok: true, gone: false };
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    // 404/410 → Subscription abgelaufen/abgemeldet → entfernen
    const gone = status === 404 || status === 410;
    if (!gone) console.error("[push] Send-Fehler:", status, err);
    return { ok: false, gone };
  }
}

async function pruneSub(id: string): Promise<void> {
  try {
    const pb = await getAdminPB();
    await pb.collection("push_subscriptions").delete(id);
  } catch {
    /* nicht blockierend */
  }
}

/**
 * Sendet eine Push-Nachricht an alle Subscriptions einer Moschee,
 * die das gegebene Topic abonniert haben.
 * Liefert die Anzahl erfolgreich zugestellter Geräte zurück.
 */
export async function sendPushToMosque(
  mosqueId: string,
  topic: string,
  payload: PushPayload
): Promise<number> {
  if (!isPushConfigured() || !mosqueId) return 0;

  const pb = await getAdminPB();
  let records: SubRecord[] = [];
  try {
    const list = await pb.collection("push_subscriptions").getFullList({
      filter: `mosque_id = "${mosqueId}"`,
    });
    records = list as unknown as SubRecord[];
  } catch (err) {
    console.error("[push] Subscriptions laden fehlgeschlagen:", err);
    return 0;
  }

  let delivered = 0;
  for (const sub of records) {
    const topics = parseTopics(sub.topics);
    if (topics.length > 0 && !topics.includes(topic)) continue;
    const res = await sendToSub(sub, payload);
    if (res.ok) delivered++;
    if (res.gone) await pruneSub(sub.id);
  }
  return delivered;
}

/** Sendet an alle Geräte eines einzelnen Users (z.B. Test-Nachricht). */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<number> {
  if (!isPushConfigured() || !userId) return 0;

  const pb = await getAdminPB();
  let records: SubRecord[] = [];
  try {
    const list = await pb.collection("push_subscriptions").getFullList({
      filter: `user_id = "${userId}"`,
    });
    records = list as unknown as SubRecord[];
  } catch {
    return 0;
  }

  let delivered = 0;
  for (const sub of records) {
    const res = await sendToSub(sub, payload);
    if (res.ok) delivered++;
    if (res.gone) await pruneSub(sub.id);
  }
  return delivered;
}
