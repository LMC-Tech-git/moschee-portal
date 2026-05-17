"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import {
  saveSubscription,
  removeSubscription,
  sendTestPush,
} from "@/lib/actions/push-subscriptions";
import type { PushTopic } from "@/types";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

const ALL_TOPICS: PushTopic[] = [
  "prayer_times",
  "events",
  "donations",
  "posts",
  "madrasa",
];

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

// applicationServerKey erwartet einen BufferSource — ArrayBuffer extrahieren
function vapidKey(base64: string): ArrayBuffer {
  const arr = urlBase64ToUint8Array(base64);
  return arr.buffer.slice(
    arr.byteOffset,
    arr.byteOffset + arr.byteLength
  ) as ArrayBuffer;
}

export function PushSubscriptionToggle({
  showMadrasa = true,
}: {
  showMadrasa?: boolean;
}) {
  const t = useTranslations("push");
  const tc = useTranslations("common");
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [topics, setTopics] = useState<PushTopic[]>(ALL_TOPICS);

  const visibleTopics = ALL_TOPICS.filter(
    (tp) => tp !== "madrasa" || showMadrasa
  );

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !VAPID_PUBLIC
    ) {
      return;
    }
    setSupported(true);
    setPermission(Notification.permission);

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  const toggleTopic = (tp: PushTopic) => {
    setTopics((prev) =>
      prev.includes(tp) ? prev.filter((x) => x !== tp) : [...prev, tp]
    );
  };

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey(VAPID_PUBLIC),
        });
      }
      const json = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      const res = await saveSubscription(
        { endpoint: json.endpoint, keys: json.keys },
        topics.filter((tp) => tp !== "madrasa" || showMadrasa)
      );
      if (res.success) {
        setSubscribed(true);
        toast.success(t("toggle.enabled"));
      } else {
        toast.error(res.error || t("toggle.error"));
      }
    } catch (err) {
      console.error("[push] enable:", err);
      toast.error(t("toggle.error"));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe().catch(() => {});
        await removeSubscription(endpoint);
      }
      setSubscribed(false);
    } catch (err) {
      console.error("[push] disable:", err);
      toast.error(t("toggle.error"));
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const res = await sendTestPush({
        title: t("test.title"),
        body: t("test.body"),
      });
      if (res.success) toast.success(t("test.sent"));
      else toast.error(res.error || t("toggle.error"));
    } finally {
      setBusy(false);
    }
  };

  // Browser ohne Push-Support oder ohne VAPID-Key: nichts rendern (graceful)
  if (!supported) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
          {subscribed ? (
            <Bell className="h-5 w-5 text-emerald-700" />
          ) : (
            <BellOff className="h-5 w-5 text-gray-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900">
            {t("toggle.title")}
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {t("toggle.description")}
          </p>

          {permission === "denied" && (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {t("toggle.denied")}
            </p>
          )}

          {permission !== "denied" && (
            <>
              <fieldset className="mt-3">
                <legend className="text-xs font-medium text-gray-700">
                  {t("topics.title")}
                </legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {visibleTopics.map((tp) => (
                    <label
                      key={tp}
                      className="flex cursor-pointer items-center gap-2 text-sm text-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={topics.includes(tp)}
                        onChange={() => toggleTopic(tp)}
                        disabled={busy}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      {t(`topics.${tp}`)}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="mt-4 flex flex-wrap gap-2">
                {!subscribed ? (
                  <button
                    onClick={enable}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                    {t("toggle.enable")}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={enable}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      {tc("save")}
                    </button>
                    <button
                      onClick={sendTest}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      {t("test.button")}
                    </button>
                    <button
                      onClick={disable}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <BellOff className="h-4 w-4" />
                      {t("toggle.disable")}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
