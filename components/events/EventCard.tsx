import { Calendar, MapPin, Users, RefreshCw, Euro } from "lucide-react";
import type { Event } from "@/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { getNextOccurrence } from "@/lib/recurrence";
import { getTranslations } from "next-intl/server";
import {
  eventCategoryColors,
  eventStatusLabels,
  eventStatusColors,
} from "@/lib/constants";

interface EventCardProps {
  event: Event;
  compact?: boolean;
  registrationCount?: number;
}

export async function EventCard({ event, compact, registrationCount }: EventCardProps) {
  const t = await getTranslations("eventCard");
  const tL = await getTranslations("labels");
  const nextOccurrence = event.is_recurring ? getNextOccurrence(event) : null;
  const EVT_CAT_LABELS: Record<string, string> = {
    youth: tL("event.category.youth"), lecture: tL("event.category.lecture"), quran: tL("event.category.quran"),
    community: tL("event.category.community"), ramadan: tL("event.category.ramadan"), other: tL("event.category.other"),
  };

  // Locale-aware recurrence label
  let recurrenceLabel = "";
  if (event.is_recurring && event.recurrence_type) {
    if (event.recurrence_type === "daily") {
      recurrenceLabel = t("recurrence.daily");
    } else if (event.recurrence_type === "weekly") {
      const DAY_KEYS: Record<string, string> = {
        monday: tL("day.monday"), tuesday: tL("day.tuesday"), wednesday: tL("day.wednesday"),
        thursday: tL("day.thursday"), friday: tL("day.friday"), saturday: tL("day.saturday"), sunday: tL("day.sunday"),
      };
      const dayKey = event.recurrence_day_of_week || "";
      const dayLabel = DAY_KEYS[dayKey] || "";
      recurrenceLabel = dayLabel ? t("recurrence.weekly", { day: dayLabel }) : t("recurrence.weeklyGeneric");
    } else if (event.recurrence_type === "monthly") {
      recurrenceLabel = event.recurrence_day_of_month
        ? t("recurrence.monthlyOn", { day: event.recurrence_day_of_month })
        : t("recurrence.monthly");
    }
  }

  // Locale-aware event start string
  function formatStart(): string {
    if (event.start_prayer) {
      const prayerLabel = event.start_prayer.charAt(0).toUpperCase() + event.start_prayer.slice(1);
      return t("afterPrayer", { prayer: prayerLabel }) + (event.start_at ? `, ${formatDate(event.start_at)}` : "");
    }
    return event.start_at ? formatDateTime(event.start_at) : "";
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900">{event.title}</p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${eventCategoryColors[event.category]}`}
            >
              {EVT_CAT_LABELS[event.category] || event.category}
            </span>
            {event.is_recurring && recurrenceLabel && (
              <span className="flex items-center gap-1 text-purple-600">
                <RefreshCw className="h-3 w-3" />
                {recurrenceLabel}
              </span>
            )}
            {!event.is_recurring && (event.start_at || event.start_prayer) && (
              <span>{formatStart()}</span>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${eventStatusColors[event.status]}`}
        >
          {eventStatusLabels[event.status]}
        </span>
      </div>
    );
  }

  return (
    <article aria-label={event.title} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="p-5">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${eventCategoryColors[event.category]}`}
            >
              {EVT_CAT_LABELS[event.category] || event.category}
            </span>
            {event.is_recurring && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                <RefreshCw className="h-3 w-3" />
                {t("recurring")}
              </span>
            )}
            {event.is_paid && event.price_cents && event.price_cents > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                <Euro className="h-3 w-3" />
                {(event.price_cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
              </span>
            )}
          </div>
          {event.status === "cancelled" && (
            <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
              {eventStatusLabels.cancelled}
            </span>
          )}
        </div>

        {/* Titel */}
        <h2 className="mb-2 break-words text-lg font-bold text-gray-900">{event.title}</h2>

        {/* Beschreibung */}
        {event.description && (
          <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-gray-600">
            {event.description}
          </p>
        )}

        {/* Details */}
        <div className="space-y-1.5 text-sm text-gray-500">
          {event.is_recurring ? (
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 shrink-0 text-purple-500" aria-hidden="true" />
              <span className="text-purple-700 font-medium">{recurrenceLabel}</span>
              {nextOccurrence && (
                <span className="text-gray-400">
                  · {t("nextOccurrence")}{" "}
                  {nextOccurrence.toLocaleDateString("de-DE", {
                    weekday: "short", day: "2-digit", month: "2-digit", year: "numeric",
                  })}
                </span>
              )}
            </div>
          ) : (event.start_at || event.start_prayer) && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{formatStart()}</span>
              {event.end_at && !event.start_prayer && (
                <span className="text-gray-400">
                  –{" "}
                  <time dateTime={new Date(event.end_at).toISOString()}>
                    {formatDateTime(event.end_at)}
                  </time>
                </span>
              )}
              {event.duration_minutes > 0 && (
                <span className="text-gray-400">
                  ({event.duration_minutes < 60
                    ? `${event.duration_minutes} ${t("minutesShort")}`
                    : event.duration_minutes % 60 === 0
                      ? `${event.duration_minutes / 60} ${t("hoursShort")}`
                      : `${Math.floor(event.duration_minutes / 60)} ${t("hoursShort")} ${event.duration_minutes % 60} ${t("minutesShort")}`})
                </span>
              )}
            </div>
          )}
          {event.location_name && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{event.location_name}</span>
            </div>
          )}
          {event.capacity > 0 && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {registrationCount !== undefined
                  ? `${registrationCount} / ${event.capacity} ${t("places")}`
                  : `${event.capacity} ${t("places")}`}
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
