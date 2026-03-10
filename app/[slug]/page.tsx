import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import {
  Building2,
  MapPin,
  Clock,
  CalendarDays,
  Heart,
  FileText,
  TrendingUp,
  Target,
  Banknote,
} from "lucide-react";
import { resolveMosqueWithSettings } from "@/lib/resolve-mosque";

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || "";
import { getPrayerTimesForDate, buildPrayerConfig } from "@/lib/prayer";
import type { PrayerTimes } from "@/lib/prayer";
import {
  getPublicPostsByMosque,
  getMemberPostsByMosque,
} from "@/lib/actions/posts";
import {
  getPublicUpcomingEvents,
  getMemberUpcomingEvents,
} from "@/lib/actions/events";
import { getPublicCampaigns } from "@/lib/actions/campaigns";
import { getDashboardStats } from "@/lib/actions/dashboard";
import { formatCurrencyCents } from "@/lib/utils";
import { PostCard } from "@/components/posts/PostCard";
import { EventCard } from "@/components/events/EventCard";
import { KPITile } from "@/components/shared/KPITile";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

/**
 * Live Dashboard — Startseite einer Moschee.
 * Eingeloggte Mitglieder sehen auch "members"-Events und -Posts.
 * Gäste sehen nur öffentliche Inhalte.
 */
export default async function MosqueDashboard({
  params,
}: {
  params: { slug: string };
}) {
  const result = await resolveMosqueWithSettings(params.slug);
  if (!result) notFound();
  const { mosque, settings } = result;

  // Prüfe ob User eingeloggt ist (via Cookie)
  const cookieStore = cookies();
  const authCookie = cookieStore.get("pb_auth");
  const isLoggedIn = !!authCookie?.value;

  const prayerConfig = buildPrayerConfig(mosque, settings);

  // Gebetszeiten + Posts + Events + Kampagnen + Stats parallel laden
  const [prayerTimes, postsResult, eventsResult, campaignsResult, stats] =
    await Promise.all([
      getPrayerTimesForDate(mosque.id, new Date(), prayerConfig),
      isLoggedIn
        ? getMemberPostsByMosque(mosque.id, 10)
        : getPublicPostsByMosque(mosque.id, 10),
      isLoggedIn
        ? getMemberUpcomingEvents(mosque.id, 5)
        : getPublicUpcomingEvents(mosque.id, 5),
      getPublicCampaigns(mosque.id, 3),
      getDashboardStats(mosque.id),
    ]);
  const posts = postsResult.success ? postsResult.data || [] : [];
  const upcomingEvents = eventsResult.success ? eventsResult.data || [] : [];
  const campaigns = campaignsResult.success
    ? campaignsResult.data || []
    : [];

  return (
    <>
      {/* Moschee Header */}
      <section className="py-12" style={{ background: "linear-gradient(to bottom right, var(--brand-primary, #059669), color-mix(in srgb, var(--brand-primary, #059669) 80%, transparent), color-mix(in srgb, var(--brand-primary, #059669) 90%, black))" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {mosque.brand_logo ? (
              <div className="relative mx-auto mb-4 h-24 w-[200px]">
                <Image
                  src={`${PB_URL}/api/files/mosques/${mosque.id}/${mosque.brand_logo}`}
                  alt={mosque.name}
                  fill
                  className="object-contain"
                  sizes="200px"
                />
              </div>
            ) : (
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                <Building2 className="h-8 w-8 text-white" aria-hidden="true" />
              </div>
            )}
            <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
              {mosque.name}
            </h1>
            {mosque.city && (
              <p className="mt-2 flex items-center justify-center gap-1 text-emerald-100">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {mosque.city}
              </p>
            )}
            {prayerTimes?.hijriDate && (
              <p className="mt-1 text-sm text-emerald-200">{prayerTimes.hijriDate}</p>
            )}
          </div>
        </div>
      </section>

      {/* Gebetszeiten — nur anzeigen wenn Provider aktiv und Daten vorhanden */}
      {prayerTimes && (
        <section aria-label="Heutige Gebetszeiten" className="border-b border-gray-100 bg-gray-50 py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                <h2 className="text-lg font-bold text-emerald-700">
                  Heutige Gebetszeiten
                </h2>
              </div>
              <div className="flex flex-wrap justify-center gap-6">
                {(
                  [
                    { key: "fajr",    label: "Morgen"     },
                    { key: "sunrise", label: "Aufgang"    },
                    { key: "dhuhr",   label: "Mittag"     },
                    { key: "asr",     label: "Nachmittag" },
                    { key: "maghrib", label: "Abend"      },
                    { key: "isha",    label: "Nacht"      },
                  ] as { key: keyof PrayerTimes; label: string }[]
                ).map(({ key, label }) => (
                  <div key={key} className="text-center">
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      {label}
                    </p>
                    <p className="text-lg font-bold text-emerald-600">
                      {prayerTimes[key] as string}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* KPI-Kacheln */}
      <section aria-label="Gemeinde-Statistiken" className="border-b border-gray-100 bg-white py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Link
              href={`/${params.slug}/campaigns`}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              <KPITile
                icon={<Target className="h-5 w-5 text-emerald-600" />}
                label="Aktive Kampagnen"
                value={stats.activeCampaigns}
              />
            </Link>
            <Link
              href={`/${params.slug}/donate`}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              <KPITile
                icon={<Banknote className="h-5 w-5 text-amber-600" />}
                label="Kampagnen-Spenden"
                value={formatCurrencyCents(stats.campaignDonationsCents)}
              />
            </Link>
            <Link
              href={`/${params.slug}/events`}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <KPITile
                icon={<CalendarDays className="h-5 w-5 text-blue-600" />}
                label="Events diesen Monat"
                value={stats.upcomingEventsThisMonth}
              />
            </Link>
            <KPITile
              icon={<FileText className="h-5 w-5 text-gray-600" />}
              label="Beiträge"
              value={stats.publishedPosts}
            />
          </div>
        </div>
      </section>

      {/* Dashboard Content */}
      <section className="py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Linke Spalte: Posts */}
            <div className="lg:col-span-2">
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                <h2 className="text-xl font-bold text-gray-900">Beiträge</h2>
              </div>

              {posts.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-8 text-center">
                  <FileText className="mx-auto mb-2 h-8 w-8 text-gray-300" aria-hidden="true" />
                  <p className="text-sm text-gray-500">
                    Noch keine Beiträge veröffentlicht.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      href={`/${params.slug}/posts/${post.id}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Rechte Spalte: Sidebar */}
            <div className="space-y-6">
              {/* Kommende Veranstaltungen */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-blue-600" aria-hidden="true" />
                    <h3 className="font-bold text-gray-900">
                      Veranstaltungen
                    </h3>
                  </div>
                  <Link
                    href={`/${params.slug}/events`}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    Alle anzeigen<span className="sr-only"> Veranstaltungen</span>
                  </Link>
                </div>
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Keine kommenden Veranstaltungen.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {upcomingEvents.map((event) => (
                      <Link
                        key={event.id}
                        href={`/${params.slug}/events/${event.id}`}
                      >
                        <EventCard event={event} compact />
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Aktive Kampagnen */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                    <h3 className="font-bold text-gray-900">Kampagnen</h3>
                  </div>
                  <Link
                    href={`/${params.slug}/campaigns`}
                    className="text-xs font-medium text-emerald-600 hover:underline"
                  >
                    Alle anzeigen<span className="sr-only"> Kampagnen</span>
                  </Link>
                </div>
                {campaigns.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Keine aktiven Kampagnen.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {campaigns.map((campaign) => (
                      <Link
                        key={campaign.id}
                        href={`/${params.slug}/campaigns/${campaign.id}`}
                        className="group block rounded-lg p-2 -mx-2 transition-colors hover:bg-emerald-50"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold leading-tight text-gray-900 group-hover:text-emerald-700 transition-colors">
                              {campaign.title}
                            </p>
                            <span className="whitespace-nowrap text-xs font-medium text-emerald-700">
                              {campaign.progress_percent}%
                            </span>
                          </div>
                          <Progress
                            value={Math.min(campaign.progress_percent, 100)}
                            className="h-2.5"
                            aria-label={`${campaign.title}: ${campaign.progress_percent}% erreicht`}
                          />
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>
                              {formatCurrencyCents(campaign.raised_cents)} gesammelt
                            </span>
                            <span>
                              Ziel: {formatCurrencyCents(campaign.goal_amount_cents)}
                            </span>
                          </div>
                          {campaign.donor_count > 0 && (
                            <p className="text-xs text-gray-400">
                              {campaign.donor_count} Spender
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Spenden CTA */}
              <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Heart className="h-5 w-5 text-amber-600" aria-hidden="true" />
                  <h3 className="font-bold text-gray-900">Spenden</h3>
                </div>
                <p className="mb-4 text-sm text-gray-600">
                  Unterstützen Sie unsere Gemeinde mit einer Spende.
                </p>
                <Button asChild className="w-full bg-amber-500 hover:bg-amber-600">
                  <Link href={`/${params.slug}/donate`} className="inline-flex items-center justify-center gap-2">
                    <Heart className="h-4 w-4" />
                    Jetzt spenden
                  </Link>
                </Button>
              </div>

              {/* Kontakt */}
              {(mosque.phone || mosque.email) && (
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h3 className="mb-3 font-bold text-gray-900">Kontakt</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    {mosque.address && <p>{mosque.address}</p>}
                    {mosque.phone && (
                      <p>
                        Tel:{" "}
                        <a
                          href={`tel:${mosque.phone}`}
                          className="text-emerald-600 hover:underline"
                        >
                          {mosque.phone}
                        </a>
                      </p>
                    )}
                    {mosque.email && (
                      <p>
                        E-Mail:{" "}
                        <a
                          href={`mailto:${mosque.email}`}
                          className="text-emerald-600 hover:underline"
                        >
                          {mosque.email}
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
