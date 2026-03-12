import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Datenschutzerklärung | moschee.app",
  description: "Datenschutzerklärung von moschee.app: Informationen zur DSGVO-konformen Verarbeitung personenbezogener Daten.",
  alternates: {
    canonical: "https://moschee.app/datenschutz",
  },
  openGraph: {
    title: "Datenschutzerklärung | moschee.app",
    description: "Datenschutzerklärung von moschee.app: DSGVO-konforme Datenverarbeitung.",
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
              LMC Tech<br />
              Inhaber: Neslihan Elmaci<br />
              Schillerstr. 20<br />
              89231 Neu-Ulm<br />
              E-Mail:{" "}
              <a href="mailto:kontakt@lmctech.de" className="text-primary-600 underline hover:text-primary-700">
                kontakt@lmctech.de
              </a>
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">
              3. Hosting &amp; Infrastruktur
            </h2>
            <p className="mt-2">
              <strong>Hosting:</strong> Diese Website und alle zugehörigen Dienste werden auf Servern der
              Hetzner Online GmbH (Industriestr. 25, 91710 Gunzenhausen, Deutschland) betrieben.
              Die Datenbank läuft auf einem dedizierten Hetzner-Server in Nürnberg, Deutschland (DSGVO-konform).
            </p>
            <p className="mt-2">
              <strong>Cookies:</strong> Wir verwenden nur technisch notwendige
              Cookies für die Authentifizierung. Es werden keine
              Tracking- oder Werbe-Cookies eingesetzt.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">
              4. Erhobene Daten
            </h2>
            <p className="mt-2">
              Bei der Registrierung und Nutzung des Portals werden folgende Daten erfasst:
            </p>
            <ul className="mt-2 list-disc pl-6 space-y-1">
              <li>Name, E-Mail-Adresse, ggf. Telefonnummer (bei Registrierung)</li>
              <li>Mitgliedsnummer (vergeben durch die jeweilige Gemeinde)</li>
              <li>Nutzungsaktivitäten innerhalb der Plattform (Veranstaltungsregistrierungen, Spenden)</li>
              <li>Bei Madrasa-Nutzung: Schülerdaten (Name, Geburtsdatum, Anwesenheit)</li>
            </ul>
            <p className="mt-2">
              Alle Daten werden ausschließlich für den Betrieb des Portals und die
              Verwaltung der jeweiligen Gemeinde verwendet. Eine Weitergabe an Dritte
              erfolgt nicht, außer soweit gesetzlich vorgeschrieben oder zur
              Zahlungsabwicklung erforderlich.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">
              5. Zahlungsabwicklung
            </h2>
            <p className="mt-2">
              Spendenzahlungen werden über Stripe (Stripe Payments Europe Ltd.,
              1 Grand Canal Street Lower, Grand Canal Dock, Dublin, Irland) abgewickelt.
              Stripe verarbeitet Zahlungsdaten gemäß der DSGVO. Weitere Informationen:{" "}
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
              6. Speicherdauer
            </h2>
            <p className="mt-2">
              Personenbezogene Daten werden nur so lange gespeichert, wie es für den
              jeweiligen Zweck erforderlich ist oder gesetzliche Aufbewahrungsfristen
              bestehen. Auf Anfrage werden Daten gelöscht, sofern keine gesetzliche
              Pflicht zur Aufbewahrung entgegensteht.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">
              7. Ihre Rechte
            </h2>
            <p className="mt-2">
              Sie haben jederzeit das Recht auf Auskunft, Berichtigung, Löschung
              und Einschränkung der Verarbeitung Ihrer personenbezogenen Daten
              gemäß DSGVO Art. 15–22. Wenden Sie sich dazu an:{" "}
              <a
                href="mailto:kontakt@lmctech.de"
                className="text-primary-600 underline hover:text-primary-700"
              >
                kontakt@lmctech.de
              </a>
            </p>
            <p className="mt-2">
              Sie haben außerdem das Recht, bei einer Aufsichtsbehörde Beschwerde
              einzulegen. Zuständige Aufsichtsbehörde in Baden-Württemberg:
              Landesbeauftragter für Datenschutz und Informationsfreiheit (LfDI BW).
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
