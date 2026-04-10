"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import { getEventById, updateEvent } from "@/lib/actions/events";
import { EventForm } from "@/components/events/EventForm";
import { RegistrationList } from "@/components/events/RegistrationList";
import type { Event } from "@/types";
import type { EventInput } from "@/lib/validations";

export default function EditEventPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { mosqueId } = useMosque();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!mosqueId || !eventId) return;

    async function load() {
      const result = await getEventById(eventId, mosqueId);
      if (result.success && result.data) {
        setEvent(result.data);
      } else {
        setError(result.error || "Veranstaltung nicht gefunden");
      }
      setIsLoading(false);
    }
    load();
  }, [mosqueId, eventId]);

  async function handleUpdate(data: EventInput) {
    if (!user) return { success: false, error: "Nicht eingeloggt" };
    return updateEvent(eventId, mosqueId, user.id, data);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error || "Veranstaltung nicht gefunden"}</p>
        <Link
          href="/admin/events"
          className="mt-3 inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück zu Veranstaltungen
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/events"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück zu Veranstaltungen
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          Veranstaltung bearbeiten
        </h1>
      </div>

      {/* Event-Formular */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <EventForm initialData={event} onSubmit={handleUpdate} isEdit />
      </div>

      {/* Teilnehmerliste + CSV-Export */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <RegistrationList
          eventId={eventId}
          mosqueId={mosqueId}
          eventTitle={event.title}
          isPaid={event.is_paid}
        />
      </div>
    </div>
  );
}
