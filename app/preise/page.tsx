import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Shield,
  Lock,
  CreditCard,
  Users,
  Database,
  Languages,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Wrench,
  Headphones,
} from "lucide-react";
import { PricingPlans } from "@/components/pricing/PricingPlans";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pricing");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: "https://moschee.app/preise",
    },
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
    },
  };
}

const TRUST_ITEMS = [
  { key: "hosting", icon: Shield, color: "text-emerald-600", bg: "bg-emerald-50" },
  { key: "gdpr", icon: Lock, color: "text-blue-600", bg: "bg-blue-50" },
  { key: "payments", icon: CreditCard, color: "text-violet-600", bg: "bg-violet-50" },
  { key: "roles", icon: Users, color: "text-amber-600", bg: "bg-amber-50" },
  { key: "backups", icon: Database, color: "text-rose-600", bg: "bg-rose-50" },
  { key: "multilang", icon: Languages, color: "text-teal-600", bg: "bg-teal-50" },
] as const;

const ONBOARDING_ITEMS = ["i1", "i2", "i3", "i4", "i5"] as const;

const FAQ_ITEMS = ["cancellation", "vat", "yearly", "export", "small", "stripe"] as const;

const COMPARE_ROWS = [
  { key: "hosting", wp: "extraCost", agency: "agencyHosted", moschee: "inclusive" },
  { key: "updates", wp: "selfMaintained", agency: "extraCost", moschee: "inclusive" },
  { key: "members", wp: "plugin", agency: "missing", moschee: "yes" },
  { key: "donations", wp: "plugin", agency: "missing", moschee: "yes" },
  { key: "madrasa", wp: "missing", agency: "missing", moschee: "yes" },
  { key: "security", wp: "selfMaintained", agency: "limited", moschee: "yes" },
  { key: "support", wp: "no", agency: "onRequest", moschee: "yes" },
] as const;

export default async function PreisePage() {
  const t = await getTranslations("pricing");

  return (
    <div className="flex flex-col">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white px-4 pb-16 pt-16 sm:pt-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 z-0 transform-gpu overflow-hidden blur-3xl"
        >
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-emerald-100 to-emerald-50 opacity-60 sm:left-[calc(50%-30rem)] sm:w-[72rem]" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {t("hero.badge")}
          </div>

          <h1 className="mb-5 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            {t("hero.title")}
          </h1>

          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-gray-600">
            {t("hero.subtitle")}
          </p>
        </div>
      </section>

      {/* ── Tarif-Cards (Client Component mit Toggle) ─────────────────── */}
      <section className="bg-white px-4 pb-20" aria-label={t("hero.title")}>
        <div className="mx-auto max-w-6xl">
          <PricingPlans />
        </div>
      </section>

      {/* ── Vertrauens-Sektion ───────────────────────────────────────── */}
      <section className="bg-gray-50 px-4 py-16 sm:py-20" aria-labelledby="trust-heading">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 id="trust-heading" className="text-3xl font-bold text-gray-900">
              {t("trust.title")}
            </h2>
            <p className="mt-3 text-gray-500">{t("trust.subtitle")}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TRUST_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.key}
                  className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                >
                  <div className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.bg}`}>
                    <Icon className={`h-5 w-5 ${item.color}`} aria-hidden="true" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800">
                    {t(`trust.items.${item.key}`)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Onboarding-Sektion ───────────────────────────────────────── */}
      <section className="bg-white px-4 py-16 sm:py-20" aria-labelledby="onboarding-heading">
        <div className="mx-auto max-w-4xl">
          <div className="overflow-hidden rounded-3xl border border-gray-100 bg-gradient-to-br from-emerald-50 via-white to-white shadow-sm">
            <div className="grid gap-8 p-8 sm:p-12 lg:grid-cols-5 lg:items-center">
              <div className="lg:col-span-3">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("onboarding.title")}
                </div>
                <h2 id="onboarding-heading" className="mb-2 text-3xl font-bold text-gray-900">
                  {t("onboarding.lead")}
                </h2>
                <ul className="mt-6 space-y-3">
                  {ONBOARDING_ITEMS.map((key) => (
                    <li key={key} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
                      <span className="text-sm text-gray-700">
                        {t(`onboarding.items.${key}`)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="lg:col-span-2">
                <div className="rounded-2xl border border-emerald-100 bg-white p-6 text-center shadow-sm">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    {t("onboarding.title")}
                  </p>
                  <p className="text-4xl font-extrabold tracking-tight text-gray-900">
                    {t("onboarding.price")}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {t("onboarding.vatNote")}
                  </p>
                  <Link
                    href="/kontakt?topic=onboarding"
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
                  >
                    {t("onboarding.cta")}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Vergleich WordPress vs. moschee.app ───────────────────────── */}
      <section className="bg-gray-50 px-4 py-16 sm:py-20" aria-labelledby="compare-heading">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 id="compare-heading" className="text-3xl font-bold text-gray-900">
              {t("compare.title")}
            </h2>
            <p className="mt-3 text-gray-500">{t("compare.subtitle")}</p>
          </div>

          {/* Desktop-Tabelle */}
          <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-6 py-4 text-left font-semibold text-gray-700"></th>
                  <th className="px-6 py-4 text-center font-semibold text-gray-600">
                    {t("compare.cols.wp")}
                  </th>
                  <th className="px-6 py-4 text-center font-semibold text-gray-600">
                    {t("compare.cols.agency")}
                  </th>
                  <th className="px-6 py-4 text-center font-semibold text-emerald-700">
                    {t("compare.cols.moschee")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, idx) => (
                  <tr
                    key={row.key}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                  >
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {t(`compare.rows.${row.key}`)}
                    </td>
                    <td className="px-6 py-4 text-center text-gray-500">
                      {t(`compare.values.${row.wp}`)}
                    </td>
                    <td className="px-6 py-4 text-center text-gray-500">
                      {t(`compare.values.${row.agency}`)}
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-emerald-700">
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        {t(`compare.values.${row.moschee}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile-Cards */}
          <div className="space-y-4 lg:hidden">
            {COMPARE_ROWS.map((row) => (
              <div
                key={row.key}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <p className="mb-3 text-sm font-bold text-gray-900">
                  {t(`compare.rows.${row.key}`)}
                </p>
                <dl className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2">
                    <dt className="text-gray-500">{t("compare.cols.wp")}</dt>
                    <dd className="font-medium text-gray-700">
                      {t(`compare.values.${row.wp}`)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2">
                    <dt className="text-gray-500">{t("compare.cols.agency")}</dt>
                    <dd className="font-medium text-gray-700">
                      {t(`compare.values.${row.agency}`)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="font-semibold text-emerald-700">
                      {t("compare.cols.moschee")}
                    </dt>
                    <dd className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      {t(`compare.values.${row.moschee}`)}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="bg-white px-4 py-16 sm:py-20" aria-labelledby="faq-heading">
        <div className="mx-auto max-w-3xl">
          <h2 id="faq-heading" className="mb-10 text-center text-3xl font-bold text-gray-900">
            {t("faq.title")}
          </h2>

          <div className="space-y-3">
            {FAQ_ITEMS.map((key) => (
              <details
                key={key}
                className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md open:shadow-md"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-gray-900">
                  {t(`faq.items.${key}.q`)}
                  <span
                    className="ml-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-transform group-open:rotate-45 group-open:bg-emerald-100 group-open:text-emerald-600"
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
                      <path d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  {t(`faq.items.${key}.a`)}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pilot-Hinweis (dezent) ───────────────────────────────────── */}
      <section className="bg-gray-50 px-4 py-12" aria-labelledby="pilot-heading">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="pilot-heading" className="mb-1 text-lg font-bold text-gray-900">
                  {t("pilot.title")}
                </h2>
                <p className="text-sm leading-relaxed text-gray-600">
                  {t("pilot.body")}
                </p>
              </div>
              <Link
                href="/kontakt?topic=pilot"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Headphones className="h-4 w-4" aria-hidden="true" />
                {t("pilot.cta")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA-Banner ───────────────────────────────────────────────── */}
      <section className="bg-emerald-600 px-4 py-16" aria-labelledby="cta-heading">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="cta-heading" className="mb-4 text-3xl font-bold text-white">
            {t("ctaBanner.title")}
          </h2>
          <p className="mb-8 text-emerald-100">{t("ctaBanner.subtitle")}</p>
          <Link
            href="/kontakt?tarif=standard"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50"
          >
            {t("ctaBanner.cta")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
