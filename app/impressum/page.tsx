import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.impressum");
  return {
    title: t("meta_title"),
    description: t("meta_desc"),
    alternates: {
      canonical: "https://moschee.app/impressum",
    },
    openGraph: {
      title: t("meta_title"),
      description: t("meta_desc"),
    },
  };
}

export default async function ImpressumPage() {
  const t = await getTranslations("legal.impressum");

  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">{t("title")}</h1>

        <div className="prose prose-gray max-w-none space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{t("angaben_title")}</h2>
            <p className="mt-2 whitespace-pre-line text-gray-600">{t("angaben_body")}</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">{t("kontakt_title")}</h2>
            <p className="mt-2 text-gray-600">{t("kontakt_body")}</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">{t("steuer_title")}</h2>
            <p className="mt-2 text-gray-600">{t("steuer_body")}</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">{t("haftung_title")}</h2>
            <p className="mt-2 text-gray-600">{t("haftung_body")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
