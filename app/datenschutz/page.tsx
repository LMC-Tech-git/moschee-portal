import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.datenschutz");
  return {
    title: t("meta_title"),
    description: t("meta_desc"),
    alternates: {
      canonical: "https://moschee.app/datenschutz",
    },
    openGraph: {
      title: t("meta_title"),
      description: t("meta_desc"),
    },
  };
}

export default async function DatenschutzPage() {
  const t = await getTranslations("legal.datenschutz");

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
            <p className="mt-2 whitespace-pre-line">
              {t("s2_body")}
              <br />
              E-Mail:{" "}
              <a href="mailto:kontakt@lmctech.de" className="text-primary-600 underline hover:text-primary-700">
                kontakt@lmctech.de
              </a>
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">{t("s3_title")}</h2>
            <p className="mt-2">{t("s3_hosting")}</p>
            <p className="mt-2">{t("s3_cookies")}</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">{t("s4_title")}</h2>
            <p className="mt-2">{t("s4_intro")}</p>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>{t("s4_li1")}</li>
              <li>{t("s4_li2")}</li>
              <li>{t("s4_li3")}</li>
              <li>{t("s4_li4")}</li>
            </ul>
            <p className="mt-2">{t("s4_outro")}</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">{t("s5_title")}</h2>
            <p className="mt-2">
              {t("s5_body")}{" "}
              <a
                href="https://stripe.com/de/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 underline hover:text-primary-700"
              >
                {t("s5_link")}
              </a>
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">{t("s6_title")}</h2>
            <p className="mt-2">{t("s6_body")}</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">{t("s7_title")}</h2>
            <p className="mt-2">
              {t("s7_body1")}{" "}
              <a
                href="mailto:kontakt@lmctech.de"
                className="text-primary-600 underline hover:text-primary-700"
              >
                kontakt@lmctech.de
              </a>
            </p>
            <p className="mt-2">{t("s7_body2")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
