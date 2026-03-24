export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { Mail, MessageSquare, Clock } from "lucide-react";
import { resolveMosqueWithSettings } from "@/lib/resolve-mosque";
import { ContactForm } from "@/components/contact/ContactForm";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const result = await resolveMosqueWithSettings(params.slug);
  if (!result) return { title: "Nicht gefunden" };
  const { mosque } = result;
  return {
    title: `Kontakt – ${mosque.name}`,
    description: `Nehmen Sie Kontakt mit ${mosque.name} auf. Wir freuen uns über Ihre Nachricht.`,
  };
}

export default async function MosqueKontaktPage({
  params,
}: {
  params: { slug: string };
}) {
  const result = await resolveMosqueWithSettings(params.slug);
  if (!result) notFound();

  const { mosque, settings } = result;

  // Feature-Guard — 404 statt Redirect (saubere Semantik, kein Duplicate Content)
  if (!settings.contact_enabled) notFound();

  const t = await getTranslations("contact");

  const contactEmail = settings.contact_email || mosque.email;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">

        {/* Page Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
            <MessageSquare className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("pageTitle")}</h1>
            <p className="text-sm text-gray-500">{mosque.name}</p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Info-Spalte */}
          <div className="space-y-4 lg:col-span-1">
            {/* Beschreibung */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-600 leading-relaxed">
                {t("pageSubtitle")}
              </p>
            </div>

            {/* E-Mail-Karte */}
            {contactEmail && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-gray-700">
                    {t("info.emailTitle")}
                  </span>
                </div>
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-sm text-emerald-600 hover:underline break-all"
                >
                  {contactEmail}
                </a>
              </div>
            )}

            {/* Antwortzeit */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-gray-700">
                  {t("info.responseTitle")}
                </span>
              </div>
              <p className="text-sm text-gray-600">{t("info.responseText")}</p>
            </div>
          </div>

          {/* Formular-Spalte */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <ContactForm
                apiPath={`/api/${params.slug}/contact`}
                mosqueName={mosque.name}
              />
            </div>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-10">
          <Link
            href={`/${params.slug}`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Zurück zur Startseite
          </Link>
        </div>

      </div>
    </div>
  );
}
