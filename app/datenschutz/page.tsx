import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Datenschutzerklärung | Moschee-Portal",
  description: "Datenschutzerklärung des Moschee-Portals: Informationen zur DSGVO-konformen Verarbeitung personenbezogener Daten.",
  openGraph: {
    title: "Datenschutzerklärung | Moschee-Portal",
    description: "Datenschutzerklärung des Moschee-Portals: DSGVO-konforme Datenverarbeitung.",
  },
};

export default function DatenschutzPage() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">
          Datenschutzerklärung
        </h1>

        <div className="space-y-8 text-gray-600">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              1. Datenschutz auf einen Blick
            </h2>
            <p className="mt-2">
              Die folgenden Hinweise geben einen einfachen Überblick darüber,
              was mit Ihren personenbezogenen Daten passiert, wenn Sie diese
              Website besuchen. Personenbezogene Daten sind alle Daten, mit
              denen Sie persönlich identifiziert werden können.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">
              2. Verantwortliche Stelle
            </h2>
            <p className="mt-2">
              Islamische Gemeinde Musterstadt e.V.<br />
              Musterstraße 1<br />
              12345 Musterstadt<br />
              E-Mail: datenschutz@moschee-portal.de
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">
              3. Datenerfassung auf dieser Website
            </h2>
            <p className="mt-2">
              <strong>Hosting:</strong> Diese Website wird bei Vercel Inc. gehostet.
              Die Datenbank läuft bei Supabase in der EU-Region Frankfurt (DSGVO-konform).
            </p>
            <p className="mt-2">
              <strong>Cookies:</strong> Wir verwenden nur technisch notwendige
              Cookies für die Authentifizierung. Es werden keine
              Tracking-Cookies eingesetzt.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">
              4. Zahlungsabwicklung
            </h2>
            <p className="mt-2">
              Spendenzahlungen werden über Stripe (Stripe Payments Europe Ltd.,
              Dublin, Irland) abgewickelt. Stripe verarbeitet Zahlungsdaten
              gemäß der DSGVO. Weitere Infos:{" "}
              <a
                href="https://stripe.com/de/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 underline hover:text-primary-700"
              >
                Stripe Datenschutzrichtlinie
              </a>
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">
              5. Ihre Rechte
            </h2>
            <p className="mt-2">
              Sie haben jederzeit das Recht auf Auskunft, Berichtigung, Löschung
              und Einschränkung der Verarbeitung Ihrer personenbezogenen Daten.
              Wenden Sie sich dazu an: datenschutz@moschee-portal.de
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
