export const dynamic = "force-static";
export const revalidate = 86400;

import type { Metadata } from "next";
import Link from "next/link";
import {
  Clock,
  Calendar,
  Heart,
  Users,
  Bell,
  BookOpen,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FEATURES } from "@/lib/docs/features";
import { QUICKSTART } from "@/lib/docs/quickstart";
import { MADRASA_GUIDES } from "@/lib/docs/guide";
import { FAQ_ITEMS } from "@/lib/docs/faq";
import { MadrasaGuide } from "@/components/anleitung/MadrasaGuide";
import type { TranslatedPhase } from "@/components/anleitung/MadrasaGuide";
import { FAQ } from "@/components/anleitung/FAQ";

const ICON_MAP = {
  clock: Clock,
  calendar: Calendar,
  heart: Heart,
  users: Users,
  bell: Bell,
  "book-open": BookOpen,
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("anleitung");
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: {
      canonical: "https://moschee.app/anleitung",
    },
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDesc"),
      type: "website",
      url: "https://moschee.app/anleitung",
      siteName: "moschee.app",
    },
  };
}

export default async function AnleitungPage() {
  const t = await getTranslations("anleitung");

  // Feature grid — highlighted first
  const sortedFeatures = [
    ...FEATURES.filter((f) => f.highlight),
    ...FEATURES.filter((f) => !f.highlight),
  ];

  // Resolve Madrasa guide translations server-side
  const translatedPhases: TranslatedPhase[] = MADRASA_GUIDES.map((guide) => ({
    phase: guide.phase,
    title: t(guide.titleKey as Parameters<typeof t>[0]),
    steps: guide.steps.map((step) => ({
      title: t(step.titleKey as Parameters<typeof t>[0]),
      desc: t(step.descKey as Parameters<typeof t>[0]),
      screenshotKey: step.screenshotKey,
    })),
  }));

  // Resolve FAQ
  const faqItems = FAQ_ITEMS.map((item) => ({
    question: t(item.questionKey as Parameters<typeof t>[0]),
    answer: t(item.answerKey as Parameters<typeof t>[0]),
  }));

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-600 to-teal-700 py-16 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-emerald-100">
            {t("heroSubtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="https://demo.moschee.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-bold text-emerald-700 shadow transition-colors hover:bg-emerald-50"
            >
              {t("heroCta")}
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="#madrasa-guide"
              className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              {t("heroGuideLink")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Features — text only, no screenshots */}
      <section id="features" className="bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-2 text-center text-2xl font-extrabold text-gray-900">
            {t("featuresTitle")}
          </h2>
          <p className="mb-10 text-center text-sm text-gray-500">
            {t("featuresSubtitle")}
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sortedFeatures.map((feature) => {
              const Icon = ICON_MAP[feature.iconKey];
              return (
                <div
                  key={feature.key}
                  className={`relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${
                    feature.highlight ? "ring-2 ring-emerald-200" : ""
                  }`}
                >
                  {feature.highlight && (
                    <span className="absolute right-3 top-3 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      {t("featureHighlight")}
                    </span>
                  )}
                  <div
                    className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${feature.color.bg}`}
                  >
                    <Icon
                      className={`h-5 w-5 ${feature.color.text}`}
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="mb-1 text-base font-semibold text-gray-900">
                    {t(feature.titleKey as Parameters<typeof t>[0])}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-600">
                    {t(feature.descKey as Parameters<typeof t>[0])}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quickstart */}
      <section id="quickstart" className="py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-2 text-center text-2xl font-extrabold text-gray-900">
            {t("quickstartTitle")}
          </h2>
          <p className="mb-10 text-center text-sm text-gray-500">
            {t("quickstartSubtitle")}
          </p>
          <ol className="space-y-4">
            {QUICKSTART.map((step, i) => (
              <li
                key={i}
                className="flex gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {t(step.titleKey as Parameters<typeof t>[0])}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-gray-600">
                    {t(step.descKey as Parameters<typeof t>[0])}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8 text-center">
            <Link
              href="https://demo.moschee.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow transition-colors hover:bg-emerald-700"
            >
              {t("quickstartCta")}
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Madrasa Journey */}
      <section id="madrasa-guide" className="bg-gray-50 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-2 text-center text-2xl font-extrabold text-gray-900">
            {t("madrasaTitle")}
          </h2>
          <p className="mb-10 text-center text-sm text-gray-500">
            {t("madrasaSubtitle")}
          </p>
          <MadrasaGuide phases={translatedPhases} />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-2 text-center text-2xl font-extrabold text-gray-900">
            {t("faqTitle")}
          </h2>
          <p className="mb-10 text-center text-sm text-gray-500">
            {t("faqSubtitle")}
          </p>
          <FAQ items={faqItems} />
        </div>
      </section>
    </>
  );
}
