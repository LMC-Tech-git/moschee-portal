import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft,
  Calendar,
  MapPin,
  Users,
  Clock,
  AlertTriangle,
  Lock,
  RefreshCw,
} from "lucide-react";
import { resolveMosqueBySlug } from "@/lib/resolve-mosque";
import { getAuthFromCookie } from "@/lib/auth-cookie";
import {
  getEventById,
  getEventRegistrationCount,
  isMemberRegistered,
} from "@/lib/actions/events";
import { formatDate, formatDateTime } from "@/lib/utils";
import { eventCategoryLabels, eventCategoryColors } from "@/lib/constants";
import { getNextOccurrence, getRecurrenceLabel } from "@/lib/recurrence";
import { GuestRegistrationForm } from "./GuestRegistrationForm";
import { MemberRegistrationButton } from "./MemberRegistrationButton";

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || "";

export async function generateMetadata({
  params,
}: {
  params: { slug: string; eventId: string };
}) {
  try {
    const mosque = await resolveMosqueBySlug(params.slug);
    const result = await getEventById(params.eventId, mosque?.id ?? "");
    if (!result.success || !result.data) return { title: "Veranstaltung" };
    const title = `${result.data.title} | ${mosque?.name ?? "Gemeinde"}`;
    const description = result.data.description
      ? result.data.description.slice(0, 160)
      : `Veranstaltung der ${mosque?.name ?? "Gemeinde"}`;
    return {
      title,
      description,
      alternates: { canonical: `https://${params.slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "moschee.app"}/events/${params.eventId}` },
      openGraph: { title, description, type: "article" as const },
    };
  } catch {
    return { title: "Veranstaltung" };
  }
}

const PRAYER_LABELS: Record<string, string> = {
  fajr:    "nach dem Morgengebet",
  dhuhr:   "nach dem Mittagsgebet",
  asr:     "nach dem Nachmittagsgebet",
  maghrib: "nach dem Abendgebet",
  isha:    "nach dem Nachtgebet",
};

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "";
  if (minutes < 60) return `${minutes} Min.`;
  if (minutes % 60 === 0) return `${minutes / 60} Std.`;
  return `${Math.floor(minutes / 60)} Std. ${minutes % 60} Min.`;
}

export default async function PublicEventPage({
  params,
}: {
  params: { slug: string; eventId: string };
}) {
  const mosque = await resolveMosqueBySlug(params.slug);
  if (!mosque) notFound();

  const result = await getEventById(params.eventId, mosque.id);
  if (!result.success || !result.data) notFound();

  const event = result.data;

  // Nur veröffentlichte Events anzeigen
  if (event.status === "draft") notFound();

  // Auth-Status prüfen
  const { isLoggedIn: cookieLoggedIn, isActiveMember, userId } = getAuthFromCookie();
  const isLoggedIn = cookieLoggedIn && !!userId;

  // Members-Only: Für eingeloggte User (inkl. Admins) und aktive Mitglieder
  if (event.visibility === "members" && !isLoggedIn) {
    return (
      <div className="py-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Link
            href={`/events`}
            className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Zurück zu Veranstaltungen
          </Link>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
            <Lock className="mx-auto mb-3 h-10 w-10 text-amber-500" />
            <h2 className="text-lg font-bold text-gray-900">Nur für Mitglieder</h2>
            <p className="mt-2 text-sm text-gray-600">
              Diese Veranstaltung ist nur für eingeloggte Mitglieder sichtbar.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Jetzt anmelden
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const registrationCount =
    event.capacity > 0 ? await getEventRegistrationCount(event.id) : 0;
  const isFull = event.capacity > 0 && registrationCount >= event.capacity;
  const isCancelled = event.status === "cancelled";
  const memberRegistered =
    isLoggedIn && userId ? await isMemberRegistered(event.id, userId) : false;

  const startLabel = event.start_prayer
    ? `${PRAYER_LABELS[event.start_prayer] || event.start_prayer}${event.start_at ? `, ${formatDate(event.start_at)}` : ""}`
    : event.start_at
    ? formatDateTime(event.start_at)
    : "";

  const recurrenceLabel = event.is_recurring ? getRecurrenceLabel(event) : "";
  const nextOccurrence = event.is_recurring ? getNextOccurrence(event) : null;

  return (
    <>
      {/* Header */}
      <section
        className="py-10"
        style={{
          background: isCancelled
            ? "linear-gradient(to bottom right, #6b7280, #4b5563)"
            : "linear-gradient(to bottom right, var(--brand-primary, #059669), color-mix(in srgb, var(--brand-primary, #059669) 80%, transparent))",
        }}
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Link
            href={`/events`}
            className="mb-4 inline-flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Alle Veranstaltungen
          </Link>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${eventCategoryColors[event.category]}`}
            >
              {eventCategoryLabels[event.category]}
            </span>
            {event.is_recurring && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                <RefreshCw className="h-3 w-3" />
                Wiederkehrend
              </span>
            )}
            {isCancelled && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                <AlertTriangle className="h-3 w-3" />
                Abgesagt
              </span>
            )}
            {isFull && !isCancelled && (
              <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                Ausgebucht
              </span>
            )}
          </div>

          <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
            {event.title}
          </h1>

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/80">
            {startLabel && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 shrink-0" />
                {startLabel}
              </span>
            )}
            {event.location_name && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0" />
                {event.location_name}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Inhalt */}
      <section className="py-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-8">

          {/* Cover-Bild */}
          {event.cover_image && (
            <div className="relative overflow-hidden rounded-xl bg-gray-100" style={{ maxHeight: "400px", minHeight: "200px" }}>
              <Image
                src={`${PB_URL}/api/files/events/${event.id}/${event.cover_image}`}
                alt={event.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 800px"
              />
            </div>
          )}

          {/* Absage-Hinweis */}
          {isCancelled && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <p className="text-sm font-medium text-red-700">
                Diese Veranstaltung wurde leider abgesagt.
              </p>
            </div>
          )}

          {/* Details */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 font-bold text-gray-900">Details</h2>
            <dl className="space-y-3 text-sm">
              {event.is_recurring && recurrenceLabel && (
                <div className="flex items-start gap-3">
                  <dt className="flex w-28 shrink-0 items-center gap-1.5 font-medium text-purple-600">
                    <RefreshCw className="h-4 w-4" />
                    Rhythmus
                  </dt>
                  <dd className="text-purple-800 font-medium">{recurrenceLabel}</dd>
                </div>
              )}
              {event.is_recurring && nextOccurrence && (
                <div className="flex items-start gap-3">
                  <dt className="flex w-28 shrink-0 items-center gap-1.5 font-medium text-gray-500">
                    <Calendar className="h-4 w-4" />
                    Nächstes
                  </dt>
                  <dd className="text-gray-800">
                    {nextOccurrence.toLocaleDateString("de-DE", {
                      weekday: "long", day: "2-digit", month: "long", year: "numeric",
                    })}
                  </dd>
                </div>
              )}
              {event.is_recurring && event.recurrence_end_date && (
                <div className="flex items-start gap-3">
                  <dt className="flex w-28 shrink-0 items-center gap-1.5 font-medium text-gray-500">
                    <Clock className="h-4 w-4" />
                    Bis
                  </dt>
                  <dd className="text-gray-800">{formatDate(event.recurrence_end_date)}</dd>
                </div>
              )}
              {startLabel && (
                <div className="flex items-start gap-3">
                  <dt className="flex w-28 shrink-0 items-center gap-1.5 font-medium text-gray-500">
                    <Calendar className="h-4 w-4" />
                    {event.is_recurring ? "Uhrzeit" : "Beginn"}
                  </dt>
                  <dd className="text-gray-800">{startLabel}</dd>
                </div>
              )}
              {event.end_at && !event.start_prayer && (
                <div className="flex items-start gap-3">
                  <dt className="flex w-28 shrink-0 items-center gap-1.5 font-medium text-gray-500">
                    <Clock className="h-4 w-4" />
                    Ende
                  </dt>
                  <dd className="text-gray-800">{formatDateTime(event.end_at)}</dd>
                </div>
              )}
              {event.duration_minutes > 0 && (
                <div className="flex items-start gap-3">
                  <dt className="flex w-28 shrink-0 items-center gap-1.5 font-medium text-gray-500">
                    <Clock className="h-4 w-4" />
                    Dauer
                  </dt>
                  <dd className="text-gray-800">{formatDuration(event.duration_minutes)}</dd>
                </div>
              )}
              {event.location_name && (
                <div className="flex items-start gap-3">
                  <dt className="flex w-28 shrink-0 items-center gap-1.5 font-medium text-gray-500">
                    <MapPin className="h-4 w-4" />
                    Ort
                  </dt>
                  <dd className="text-gray-800">{event.location_name}</dd>
                </div>
              )}
              {event.capacity > 0 && (
                <div className="flex items-start gap-3">
                  <dt className="flex w-28 shrink-0 items-center gap-1.5 font-medium text-gray-500">
                    <Users className="h-4 w-4" />
                    Plätze
                  </dt>
                  <dd className={isFull ? "font-semibold text-orange-600" : "text-gray-800"}>
                    {registrationCount} / {event.capacity} belegt
                    {isFull && <span className="ml-2 text-xs">(Ausgebucht)</span>}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Beschreibung */}
          {event.description && (
            <div>
              <h2 className="mb-3 font-bold text-gray-900">Beschreibung</h2>
              <div className="whitespace-pre-wrap text-base leading-relaxed text-gray-700">
                {event.description}
              </div>
            </div>
          )}

          {/* Anmeldung */}
          {!isCancelled && (
            <div>
              {isFull && !memberRegistered ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
                  <p className="font-medium text-amber-800">
                    Diese Veranstaltung ist leider ausgebucht.
                  </p>
                </div>
              ) : isLoggedIn && userId ? (
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                  <h3 className="mb-4 text-lg font-bold text-gray-900">
                    Anmeldung als Mitglied
                  </h3>
                  <MemberRegistrationButton
                    eventId={event.id}
                    mosqueId={mosque.id}
                    userId={userId}
                    initialRegistered={memberRegistered}
                  />
                </div>
              ) : event.visibility === "public" ? (
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                  <h3 className="mb-4 text-lg font-bold text-gray-900">
                    Anmeldung als Gast
                  </h3>
                  <GuestRegistrationForm
                    slug={params.slug}
                    eventId={event.id}
                    mosqueId={mosque.id}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
