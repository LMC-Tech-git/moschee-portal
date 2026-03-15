import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.agb");
  return {
    title: t("meta_title"),
    description: t("meta_desc"),
    openGraph: {
      title: t("meta_title"),
      description: t("meta_desc"),
    },
  };
}

export default async function AGBPage() {
  const t = await getTranslations("legal.agb");

  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">
          {t("title")}
        </h1>

        <div className="space-y-8 text-gray-600">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{t("s1_title")}</h2>
            <p className="mt-2">{t("s1_body")}</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">{t("s2_title")}</h2>
            <p className="mt-2">{t("s2_body")}</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">{t("s3_title")}</h2>
            <p className="mt-2">
              {t("s3_body_pre")}{" "}
              <a href="/datenschutz" className="text-primary-600 underline hover:text-primary-700">
                {t("s3_privacy_link")}
              </a>{" "}
              {t("s3_body_post")}
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">{t("s4_title")}</h2>
            <p className="mt-2">{t("s4_body")}</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">{t("s5_title")}</h2>
            <p className="mt-2">{t("s5_body")}</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">{t("s6_title")}</h2>
            <p className="mt-2">{t("s6_body")}</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">{t("s7_title")}</h2>
            <p className="mt-2">{t("s7_body")}</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">{t("s8_title")}</h2>
            <p className="mt-2">{t("s8_body")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
