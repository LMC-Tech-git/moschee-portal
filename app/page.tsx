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
  Shield,
  User,
  Copy,
  Check,
  PlayCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getClientPB } from "@/lib/pocketbase";
import { useTranslations } from "next-intl";

const DEMO_MOSQUE_ID = process.env.NEXT_PUBLIC_DEMO_MOSQUE_ID ?? "";

export default function HomePage() {
  const t = useTranslations("landing");
  const tFeature = useTranslations("feature");
  const tDemo = useTranslations("demo");
  const tNav = useTranslations("nav");

  const FEATURES = [
    {
      icon: Clock,
      title: tFeature("prayer.title"),
      description: tFeature("prayer.desc"),
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      icon: Bell,
      title: tFeature("announcements.title"),
      description: tFeature("announcements.desc"),
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      icon: Calendar,
      title: tFeature("events.title"),
      description: tFeature("events.desc"),
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
    },
    {
      icon: Heart,
      title: tFeature("donations.title"),
      description: tFeature("donations.desc"),
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
      icon: Users,
      title: tFeature("members.title"),
      description: tFeature("members.desc"),
      iconBg: "bg-rose-50",
      iconColor: "text-rose-600",
    },
    {
      icon: BookOpen,
      title: tFeature("madrasa.title"),
      description: tFeature("madrasa.desc"),
      iconBg: "bg-teal-50",
      iconColor: "text-teal-600",
    },
  ];

  const FOR_WHO = [
    t("forWho.item1"),
    t("forWho.item2"),
    t("forWho.item3"),
    t("forWho.item4"),
  ];

  const DEMO_ACCOUNTS = [
    {
      role: tDemo("role.admin"),
      loginRole: "admin",
      roleDesc: tDemo("roleDesc.admin"),
      email: "demo-admin@moschee.app",
      icon: Shield,
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      role: tDemo("role.teacher"),
      loginRole: "teacher",
      roleDesc: tDemo("roleDesc.teacher"),
      email: "demo-teacher@moschee.app",
      icon: BookOpen,
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      role: tDemo("role.member"),
      loginRole: "member",
      roleDesc: tDemo("roleDesc.member"),
      email: "demo-member@moschee.app",
      icon: User,
      badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
    },
  ];

  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [loadingSlug, setLoadingSlug] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  // Eingeloggte User → automatisch zum Moschee-Dashboard
  // Ausnahme: ?noredirect=1 (z.B. vom Demo-Banner "← Zur Startseite")
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("noredirect=1")) return;
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

  function copyEmail(email: string) {
    navigator.clipboard.writeText(email).catch(() => {});
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  }

  async function loginAsDemo(loginRole: string) {
    setLoadingRole(loginRole);
    try {
      const res = await fetch("/api/demo/auto-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: loginRole }),
      });
      const data = await res.json();
      if (data.token) {
        // Token via URL-Param übergeben, da localStorage zwischen Subdomains isoliert ist.
        // TokenReceiver auf demo.moschee.app liest die Params und speichert den Token lokal.
        const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "moschee.app";
        const encodedToken = encodeURIComponent(data.token);
        const encodedModel = encodeURIComponent(JSON.stringify(data.record));
        window.location.href = `https://demo.${rootDomain}?_token=${encodedToken}&_model=${encodedModel}`;
      }
    } finally {
      setLoadingRole(null);
    }
  }

  if (isLoading || loadingSlug) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <h1 className="sr-only">moschee.app</h1>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white px-4 pb-20 pt-16 sm:pt-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 z-0 transform-gpu overflow-hidden blur-3xl"
        >
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-emerald-100 to-emerald-50 opacity-60 sm:left-[calc(50%-30rem)] sm:w-[72rem]" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            {t("badge")}
          </div>

          <h1 className="mb-5 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            {t("heroTitle")}
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-gray-600">
            {t("heroSubtitle")}
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="mailto:kontakt@moschee.app?subject=Demo%20anfragen"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-7 py-3.5 text-base font-bold text-white shadow-sm transition-all duration-200 hover:bg-emerald-700 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              {t("cta.request")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            {!DEMO_MOSQUE_ID && (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-7 py-3.5 text-base font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                {tNav("login")}
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Demo ausprobieren ───────────────────────────────────────── */}
      {DEMO_MOSQUE_ID && (
        <section
          className="border-y border-emerald-100 bg-gradient-to-b from-emerald-50 to-white px-4 py-14 sm:py-16"
          aria-labelledby="demo-heading"
        >
          <div className="mx-auto max-w-4xl">
            <div className="mb-10 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-1.5 text-sm font-medium text-emerald-700">
                <PlayCircle className="h-4 w-4" aria-hidden="true" />
                {tDemo("badge")}
              </div>
              <h2 id="demo-heading" className="mb-3 text-3xl font-bold text-gray-900">
                {tDemo("title")}
              </h2>
              <p className="text-gray-600">
                {tDemo("subtitle")}{" "}
                <span className="font-semibold text-gray-800">
                  {tDemo("password")}{" "}
                  <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-emerald-700">
                    Demo1234!
                  </code>
                </span>
              </p>
            </div>

            {/* Account-Karten */}
            <div className="mb-8 grid gap-4 sm:grid-cols-3">
              {DEMO_ACCOUNTS.map((account) => {
                const Icon = account.icon;
                const isCopied = copiedEmail === account.email;
                return (
                  <div
                    key={account.loginRole}
                    className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <div
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${account.badgeClass}`}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{account.role}</p>
                        <p className="text-xs text-gray-500">{account.roleDesc}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyEmail(account.email)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-left transition-colors hover:bg-gray-100"
                      title={tDemo("copyEmail")}
                    >
                      <span className="truncate font-mono text-xs text-gray-600">
                        {account.email}
                      </span>
                      {isCopied ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => loginAsDemo(account.loginRole)}
                      disabled={loadingRole !== null}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {loadingRole === account.loginRole
                        ? tDemo("loggingIn")
                        : tDemo("loginAs", { role: account.role })}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* CTAs */}
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={`https://demo.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "moschee.app"}`}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                <PlayCircle className="h-4 w-4" aria-hidden="true" />
                {tDemo("openPortal")}
              </a>
            </div>
            <p className="mt-4 text-center text-xs text-gray-400">
              {tDemo("resetNote")}
            </p>
          </div>
        </section>
      )}

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="bg-gray-50 px-4 py-16 sm:py-20" aria-labelledby="features-heading">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 id="features-heading" className="text-3xl font-bold text-gray-900">
              {t("features.title")}
            </h2>
            <p className="mt-3 text-gray-500">
              {t("features.subtitle")}
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
                  <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ${feature.iconBg}`}>
                    <Icon className={`h-5 w-5 ${feature.iconColor}`} aria-hidden="true" />
                  </div>
                  <h3 className="mb-2 text-base font-bold text-gray-900">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-500">{feature.description}</p>
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
                {t("forWho.title")}
              </h2>
              <p className="mb-6 text-gray-600 leading-relaxed">
                {t("forWho.body")}
              </p>
              <ul className="space-y-3">
                {FOR_WHO.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
                    <span className="text-sm text-gray-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center justify-center">
              <div className="flex h-64 w-64 items-center justify-center rounded-3xl bg-emerald-50">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-32 w-32 text-emerald-200" aria-hidden="true">
                  {/* Linkes Minarett */}
                  <path d="M2 22V11l1.5-4L5 11V22H2Z" />
                  {/* Rechtes Minarett */}
                  <path d="M19 22V11l1.5-4L22 11V22H19Z" />
                  {/* Zentraler Körper mit Kuppel */}
                  <path d="M6 22V13C6 8.5 9 5 12 5C15 5 18 8.5 18 13V22H6Z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────── */}
      <section className="bg-emerald-600 px-4 py-16" aria-labelledby="cta-heading">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="cta-heading" className="mb-4 text-3xl font-bold text-white">
            {t("cta.ready")}
          </h2>
          <p className="mb-8 text-emerald-100">
            {t("cta.readySubtitle")}
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="mailto:kontakt@moschee.app?subject=Demo%20anfragen"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50"
            >
              {t("cta.request")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400 px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              {t("cta.alreadyRegistered")}
            </Link>
          </div>
          <p className="mt-6 text-sm text-emerald-200">{t("contact")}</p>
        </div>
      </section>

    </div>
  );
}
