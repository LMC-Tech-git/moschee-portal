"use client";

import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import { createEvent } from "@/lib/actions/events";
import { getPortalSettings } from "@/lib/actions/settings";
import { EventForm } from "@/components/events/EventForm";
import { useTranslations } from "next-intl";
import type { EventInput } from "@/lib/validations";

export default function NewEventPage() {
  const { mosqueId } = useMosque();
  const { user } = useAuth();
  const t = useTranslations("events");
  const tCommon = useTranslations("common");
  const [defaultVisibility, setDefaultVisibility] = useState<string>("public");

  useEffect(() => {
    if (!mosqueId) return;
    getPortalSettings(mosqueId).then((r) => {
      if (r.success && r.settings) {
        setDefaultVisibility(r.settings.default_event_visibility || "public");
      }
    });
  }, [mosqueId]);

  async function handleCreate(data: EventInput) {
    if (!user) return { success: false, error: tCommon("notLoggedIn") };
    return createEvent(mosqueId, user.id, data);
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/events"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("new.back")}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("new.title")}
        </h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <EventForm onSubmit={handleCreate} defaultVisibility={defaultVisibility} />
      </div>
    </div>
  );
}
