import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Mail, Clock, MessageSquare, Sparkles } from "lucide-react";
import { ContactForm } from "@/components/contact/ContactForm";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Kontakt — moschee.app",
    description:
      "Kontaktieren Sie das moschee.app-Team. Demo anfragen, Support erhalten oder eine Kooperation besprechen.",
    alternates: {
      canonical: "https://moschee.app/kontakt",
    },
    openGraph: {
      title: "Kontakt — moschee.app",
      description:
        "Kontaktieren Sie das moschee.app-Team. Demo anfragen, Support erhalten oder eine Kooperation besprechen.",
    },
  };
}

type SearchParams = { tarif?: string; billing?: string; topic?: string };

export default async function KontaktPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const t = await getTranslations("contact");
  const tp = await getTranslations("pricing.tarifBanner");
  const params = await searchParams;

  const tarifKey =
    params.tarif === "small" || params.tarif === "standard"
      ? params.tarif
      : params.topic === "pilot"
        ? "pilot"
        : null;
  const isYearly = params.billing === "yearly";

  return (
    <section className="py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="mb-3 text-3xl font-bold text-gray-900 sm:text-4xl">
            {t("pageTitle")}
          </h1>
          <p className="mx-auto max-w-xl text-lg text-gray-600">
            {t("pageSubtitle")}
          </p>
        </div>

        {/* Tarif-Banner (wenn ?tarif=... oder ?topic=pilot) */}
        {tarifKey && (
          <div className="mb-10 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-sm leading-relaxed text-emerald-900">
                {tp(tarifKey)}
                {isYearly && tarifKey !== "pilot" && (
                  <>
                    {" "}
                    <span className="font-semibold">{tp("yearly")}</span>
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-5">

          {/* Info-Spalte */}
          <div className="lg:col-span-2 space-y-6">

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                  <Mail className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                </div>
                <h2 className="font-semibold text-gray-900">{t("info.emailTitle")}</h2>
              </div>
              <a
                href="mailto:kontakt@moschee.app"
                className="text-emerald-600 hover:text-emerald-700 hover:underline text-sm font-medium"
              >
                kontakt@moschee.app
              </a>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  <Clock className="h-5 w-5 text-blue-600" aria-hidden="true" />
                </div>
                <h2 className="font-semibold text-gray-900">{t("info.responseTitle")}</h2>
              </div>
              <p className="text-sm text-gray-600">{t("info.responseText")}</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                  <MessageSquare className="h-5 w-5 text-purple-600" aria-hidden="true" />
                </div>
                <h2 className="font-semibold text-gray-900">{t("info.topicsTitle")}</h2>
              </div>
              <ul className="space-y-1.5 text-sm text-gray-600">
                <li>✓ {t("info.topics.demo")}</li>
                <li>✓ {t("info.topics.support")}</li>
                <li>✓ {t("info.topics.partnership")}</li>
                <li>✓ {t("info.topics.feedback")}</li>
              </ul>
            </div>

          </div>

          {/* Formular-Spalte */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
              <ContactForm />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
