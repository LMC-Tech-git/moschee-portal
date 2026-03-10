import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { CalendarDays, ChevronLeft } from "lucide-react";
import { resolveMosqueBySlug } from "@/lib/resolve-mosque";
import {
  getPublicEventsFiltered,
  getMemberEventsFiltered,
} from "@/lib/actions/events";
import { EventCard } from "@/components/events/EventCard";
import { eventCategoryLabels } from "@/lib/constants";
import { getNextOccurrence } from "@/lib/recurrence";
import type { Event } from "@/types";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { category?: string };
}) {
  const mosque = await resolveMosqueBySlug(params.slug);
  if (!mosque) return { title: "Nicht gefunden" };

  const categoryMap: Record<string, string> = {
    community: "Gemeinschaft",
    lecture: "Vorträge",
    quran: "Koran",
    ramadan: "Ramadan",
    other: "Sonstiges",
  };

  const catLabel = searchParams?.category ? categoryMap[searchParams.category] ?? searchParams.category : null;
  const title = catLabel
    ? `Veranstaltungen – ${catLabel} | ${mosque.name}`
    : `Veranstaltungen | ${mosque.name}`;
  const description = `Veranstaltungen und Events der ${mosque.name}. Gemeinschaftstreffen, Vorträge und mehr.`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://moschee.app/${params.slug}/events`,
    },
    robots: searchParams?.category ? { index: false } : undefined,
    openGraph: {
      title,
      description,
      type: "website" as const,
      url: `https://moschee.app/${params.slug}/events`,
      siteName: "moschee.app",
    },
  };
}

const CATEGORIES: { value: Event["category"] | ""; label: string }[] = [
  { value: "",          label: "Alle"        },
  { value: "community", label: "Gemeinde"    },
  { value: "lecture",   label: "Vortrag"     },
  { value: "quran",     label: "Quran"       },
  { value: "ramadan",   label: "Ramadan"     },
  { value: "youth",     label: "Jugend"      },
  { value: "other",     label: "Sonstiges"   },
];

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { category?: string };
}) {
  const mosque = await resolveMosqueBySlug(params.slug);
  if (!mosque) notFound();

  const cookieStore = cookies();
  const isLoggedIn = !!cookieStore.get("pb_auth")?.value;

  const category = searchParams.category || "";

  const result = isLoggedIn
    ? await getMemberEventsFiltered(mosque.id, {
        category: category || undefined,
        limit: 100,
      })
    : await getPublicEventsFiltered(mosque.id, {
        category: category || undefined,
        limit: 100,
      });

  const allEvents = result.success ? result.data || [] : [];

  const now = new Date().toISOString();
  // Recurring events always count as upcoming (they repeat indefinitely / until recurrence_end_date)
  const isPast = (e: Event) => {
    if (e.is_recurring) {
      const next = getNextOccurrence(e);
      return next === null; // only past if recurrence has ended
    }
    return !!e.end_at && e.end_at < now;
  };
  const upcoming = allEvents.filter((e) => !isPast(e));
  const past = allEvents.filter((e) => isPast(e));

  function categoryHref(cat: string) {
    if (!cat) return `/${params.slug}/events`;
    return `/${params.slug}/events?category=${cat}`;
  }

  return (
    <>
      {/* Header */}
      <section
        className="py-10"
        style={{
          background:
            "linear-gradient(to bottom right, var(--brand-primary, #059669), color-mix(in srgb, var(--brand-primary, #059669) 80%, transparent))",
        }}
      >
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href={`/${params.slug}`}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Zurück zur Startseite"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
                Veranstaltungen
              </h1>
              <p className="mt-1 text-sm text-white/70">{mosque.name}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Kategorie-Filter */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <nav
            aria-label="Kategorie-Filter"
            className="flex gap-1 overflow-x-auto py-3 scrollbar-none"
          >
            {CATEGORIES.map((cat) => {
              const isActive = category === cat.value;
              return (
                <Link
                  key={cat.value}
                  href={categoryHref(cat.value)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Veranstaltungen */}
      <section className="py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {allEvents.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
              <CalendarDays className="mx-auto mb-3 h-10 w-10 text-gray-300" aria-hidden="true" />
              <p className="font-medium text-gray-500">
                Keine Veranstaltungen{" "}
                {category
                  ? `in der Kategorie „${eventCategoryLabels[category as Event["category"]]}"`
                  : "vorhanden"}
                .
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Kommende */}
              {upcoming.length > 0 && (
                <div>
                  <h2 className="mb-4 text-lg font-bold text-gray-900">
                    Kommende Veranstaltungen
                  </h2>
                  <div className="space-y-4">
                    {upcoming.map((event) => (
                      <Link
                        key={event.id}
                        href={`/${params.slug}/events/${event.id}`}
                        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-xl"
                      >
                        <EventCard event={event} />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Vergangene */}
              {past.length > 0 && (
                <div>
                  <h2 className="mb-4 text-lg font-bold text-gray-500">
                    Vergangene Veranstaltungen
                  </h2>
                  <div className="space-y-4 opacity-75">
                    {past.map((event) => (
                      <Link
                        key={event.id}
                        href={`/${params.slug}/events/${event.id}`}
                        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-xl"
                      >
                        <EventCard event={event} />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
