"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  Calendar,
  Heart,
  Users,
  BookOpen,
  Bell,
  ArrowRight,
  CheckCircle2,
  LogIn,
  Building2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const FEATURES = [
  {
    icon: Clock,
    title: "Gebetszeiten",
    description:
      "Automatische Gebetszeiten für Ihren Standort — täglich aktuell, mit individuellen Feinabstimmungen.",
  },
  {
    icon: Bell,
    title: "Ankündigungen",
    description:
      "Neuigkeiten und Beiträge direkt für Mitglieder und die Öffentlichkeit veröffentlichen.",
  },
  {
    icon: Calendar,
    title: "Veranstaltungen",
    description:
      "Events anlegen, Anmeldungen verwalten und Teilnehmerlisten exportieren.",
  },
  {
    icon: Heart,
    title: "Spendenkampagnen",
    description:
      "Transparente Fundraising-Seiten mit Echtzeit-Fortschritt und Online-Zahlung via Stripe.",
  },
  {
    icon: Users,
    title: "Mitgliederverwaltung",
    description:
      "Mitglieder einladen, Rollen vergeben und den Überblick behalten.",
  },
  {
    icon: BookOpen,
    title: "Madrasa",
    description:
      "Kurse, Schüler, Anwesenheit und Gebühren — alles an einem Ort verwalten.",
  },
];

const FOR_WHO = [
  "Moscheen jeder Größe in Deutschland, Österreich und der Schweiz",
  "Islamische Vereine und Gemeinden ohne eigene IT-Abteilung",
  "Gemeinden, die ihre Verwaltung modernisieren möchten",
  "Madrasa-Betreiber, die Schüler und Kurse digital verwalten wollen",
];

export default function HomePage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [loadingSlug, setLoadingSlug] = useState(false);

  // Eingeloggte User → automatisch zum Moschee-Dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.mosque_id) {
      setLoadingSlug(true);
      fetch(
        `${process.env.NEXT_PUBLIC_POCKETBASE_URL}/api/collections/mosques/records/${user.mosque_id}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.slug) {
            router.push(`/${data.slug}`);
          } else {
            setLoadingSlug(false);
          }
        })
        .catch(() => setLoadingSlug(false));
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading || loadingSlug) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <h1 className="sr-only">Moschee-Portal</h1>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white px-4 pb-20 pt-16 sm:pt-24">
        {/* Dezenter Hintergrund-Akzent */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 z-0 transform-gpu overflow-hidden blur-3xl"
        >
          <div
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-emerald-100 to-emerald-50 opacity-60 sm:left-[calc(50%-30rem)] sm:w-[72rem]"
          />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Jetzt in der Pilotphase
          </div>

          <h1 className="mb-5 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Das digitale Portal{" "}
            <span className="text-emerald-600">für Ihre Moschee</span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-gray-600">
            Gebetszeiten, Mitglieder, Spenden, Veranstaltungen und Madrasa —
            alles in einer einfachen Plattform. Für muslimische Gemeinden
            in Deutschland.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="mailto:info@moschee.app?subject=Pilotmoschee%20anfragen"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-7 py-3.5 text-base font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              Pilotmoschee anfragen
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-7 py-3.5 text-base font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Anmelden
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="bg-gray-50 px-4 py-16 sm:py-20" aria-labelledby="features-heading">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 id="features-heading" className="text-3xl font-bold text-gray-900">
              Alles, was Ihre Gemeinde braucht
            </h2>
            <p className="mt-3 text-gray-500">
              Ein vollständiges System — keine Einzellösungen, kein Flickenteppich.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
                    <Icon className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                  </div>
                  <h3 className="mb-2 text-base font-bold text-gray-900">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-500">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Für Moscheegemeinden ─────────────────────────────────────── */}
      <section className="bg-white px-4 py-16 sm:py-20" aria-labelledby="for-who-heading">
        <div className="mx-auto max-w-5xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 id="for-who-heading" className="mb-4 text-3xl font-bold text-gray-900">
                Für Moscheegemeinden —{" "}
                <span className="text-emerald-600">nicht für Tech-Konzerne</span>
              </h2>
              <p className="mb-6 text-gray-600 leading-relaxed">
                Moschee-Portal wurde gemeinsam mit Gemeinden entwickelt, die
                genau wissen, welche Herausforderungen der Alltag mit sich
                bringt. Kein unnötiger Schnickschnack — nur das, was wirklich
                gebraucht wird.
              </p>
              <ul className="space-y-3">
                {FOR_WHO.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2
                      className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500"
                      aria-hidden="true"
                    />
                    <span className="text-sm text-gray-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Grafik-Placeholder */}
            <div className="flex items-center justify-center">
              <div className="flex h-64 w-64 items-center justify-center rounded-3xl bg-emerald-50">
                <Building2 className="h-32 w-32 text-emerald-200" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────── */}
      <section className="bg-emerald-600 px-4 py-16" aria-labelledby="cta-heading">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="cta-heading" className="mb-4 text-3xl font-bold text-white">
            Bereit, Ihre Gemeinde zu digitalisieren?
          </h2>
          <p className="mb-8 text-emerald-100">
            Wir nehmen derzeit ausgewählte Pilotmoscheen auf. Schreiben Sie uns —
            die Einrichtung ist kostenlos und unkompliziert.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="mailto:info@moschee.app?subject=Pilotmoschee%20anfragen"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50"
            >
              Pilotmoschee anfragen
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400 px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Bereits registriert? Anmelden
            </Link>
          </div>
          <p className="mt-6 text-sm text-emerald-200">
            info@moschee.app
          </p>
        </div>
      </section>

    </div>
  );
}
