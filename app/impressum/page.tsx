import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impressum | moschee.app",
  description: "Impressum und rechtliche Angaben gemäß § 5 TMG zu moschee.app",
  openGraph: {
    title: "Impressum | moschee.app",
    description: "Impressum und rechtliche Angaben gemäß § 5 TMG zu moschee.app",
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
              LMC Tech<br />
              Inhaber: [Vorname Nachname]<br />
              [Straße und Hausnummer]<br />
              [PLZ] [Stadt]<br />
              Deutschland
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">Kontakt</h2>
            <p className="mt-2 text-gray-600">
              E-Mail: kontakt@moschee.app
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">Steuerliche Angaben</h2>
            <p className="mt-2 text-gray-600">
              Steuernummer: [wird nach Registrierung beim Finanzamt ergänzt]
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
