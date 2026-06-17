import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { LegalDocView } from "@/components/legal/LegalDocView";
import { getFrozenDoc, LEGAL_VERSIONS, type LegalLocale } from "@/lib/legal";

const DOC = "nutzungsvereinbarung" as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as LegalLocale;
  const doc = getFrozenDoc(DOC, LEGAL_VERSIONS[DOC], locale);
  return {
    title: doc?.title ?? "Nutzungsvereinbarung",
    description: doc?.title,
  };
}

export default async function NutzungsvereinbarungPage() {
  const locale = (await getLocale()) as LegalLocale;
  const doc = getFrozenDoc(DOC, LEGAL_VERSIONS[DOC], locale);
  if (!doc) return null;
  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <LegalDocView doc={doc} />
      </div>
    </section>
  );
}
