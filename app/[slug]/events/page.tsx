import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { CalendarDays, ChevronLeft } from "lucide-react";
import { resolveMosqueBySlug } from "@/lib/resolve-mosque";
import { getTranslations } from "next-intl/server";
import {
  getPublicEventsFiltered,
  getMemberEventsFiltered,
} from "@/lib/actions/events";
import { EventCard } from "@/components/events/EventCard";
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
  const t = await getTranslations("publicEvents");
  const tL = await getTranslations("labels");

  const categoryMap: Record<string, string> = {
    community: tL("event.category.community"), lecture: tL("event.category.lecture"),
    quran: tL("event.category.quran"), ramadan: tL("event.category.ramadan"), other: tL("event.category.other"),
  };

  const catLabel = searchParams?.category ? categoryMap[searchParams.category] ?? searchParams.category : null;
  const title = catLabel
    ? t("metaTitleCat", { category: catLabel, mosque: mosque.name })
    : t("metaTitle", { mosque: mosque.name });
  const description = t("metaDesc", { mosque: mosque.name });

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

// CATEGORIES built inside component with translations

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { category?: string };
}) {
  const mosque = await resolveMosqueBySlug(params.slug);
  if (!mosque) notFound();
  const t = await getTranslations("publicEvents");
  const tL = await getTranslations("labels");

  const CATEGORIES: { value: Event["category"] | ""; label: string }[] = [
    { value: "",          label: t("allCategories") },
    { value: "community", label: tL("event.category.community") },
    { value: "lecture",   label: tL("event.category.lecture") },
    { value: "quran",     label: tL("event.category.quran") },
    { value: "ramadan",   label: tL("event.category.ramadan") },
    { value: "youth",     label: tL("event.category.youth") },
    { value: "other",     label: tL("event.category.other") },
  ];

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
              aria-label={t("back")}
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
                {t("title")}
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
            aria-label={t("categoryFilter")}
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
                {t("empty")}{" "}
                {category
                  ? t("emptyInCategory", { category: CATEGORIES.find(c => c.value === category)?.label || category })
                  : t("emptyAvailable")}
                .
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Kommende */}
              {upcoming.length > 0 && (
                <div>
                  <h2 className="mb-4 text-lg font-bold text-gray-900">
                    {t("upcoming")}
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
                    {t("past")}
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
