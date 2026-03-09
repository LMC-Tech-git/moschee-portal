import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impressum | Moschee-Portal",
  description: "Impressum und rechtliche Angaben gemäß § 5 TMG zum Moschee-Portal – der digitalen Plattform für muslimische Gemeinden.",
  openGraph: {
    title: "Impressum | Moschee-Portal",
    description: "Impressum und rechtliche Angaben gemäß § 5 TMG zum Moschee-Portal.",
  },
};

export default function ImpressumPage() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">Impressum</h1>

        <div className="prose prose-gray max-w-none space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Angaben gemäß § 5 TMG</h2>
            <p className="mt-2 text-gray-600">
              Islamische Gemeinde Musterstadt e.V.<br />
              Musterstraße 1<br />
              12345 Musterstadt
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">Vertreten durch</h2>
            <p className="mt-2 text-gray-600">
              Vorstandsvorsitzender: [Name eintragen]
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">Kontakt</h2>
            <p className="mt-2 text-gray-600">
              Telefon: [Telefonnummer]<br />
              E-Mail: info@moschee-portal.de
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">Registereintrag</h2>
            <p className="mt-2 text-gray-600">
              Eingetragen im Vereinsregister.<br />
              Registergericht: Amtsgericht Musterstadt<br />
              Registernummer: VR [Nummer]
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">Haftungsausschluss</h2>
            <p className="mt-2 text-gray-600">
              Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine
              Haftung für die Inhalte externer Links. Für den Inhalt der
              verlinkten Seiten sind ausschließlich deren Betreiber
              verantwortlich.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
