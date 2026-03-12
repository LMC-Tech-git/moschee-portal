import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Allgemeine Geschäftsbedingungen | moschee.app",
  description: "Nutzungsbedingungen und AGB für moschee.app – das digitale Portal für muslimische Gemeinden in Deutschland.",
  openGraph: {
    title: "Allgemeine Geschäftsbedingungen | moschee.app",
    description: "Nutzungsbedingungen und AGB für moschee.app.",
  },
};

export default function AGBPage() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">
          Allgemeine Geschäftsbedingungen
        </h1>

        <div className="space-y-8 text-gray-600">
          <div>
            <h2 className="text-xl font-bold text-gray-900">1. Geltungsbereich</h2>
            <p className="mt-2">
              Diese Nutzungsbedingungen gelten für die Nutzung der SaaS-Plattform
              moschee.app, betrieben von LMC Tech (Inhaber: Neslihan Elmaci,
              Schillerstr. 20, 89231 Neu-Ulm). moschee.app stellt digitale
              Verwaltungslösungen für muslimische Gemeinden in Deutschland bereit.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">2. Leistungsumfang</h2>
            <p className="mt-2">
              Die Plattform moschee.app bietet Gemeinden Funktionen wie Mitgliederverwaltung,
              Veranstaltungsplanung, Gebetszeiten, Spendenverwaltung und Madrasa-Verwaltung.
              Die Nutzung des Portals durch Gemeindemitglieder ist kostenlos. Die
              Bereitstellung der Plattform für Gemeinden erfolgt separat vertraglich.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">3. Registrierung &amp; Portal-Zugang</h2>
            <p className="mt-2">
              Der Zugang zum Portal erfolgt auf Einladung der jeweiligen Gemeinde.
              Mit der Registrierung stimmen Sie der Verarbeitung Ihrer Daten gemäß
              unserer{" "}
              <a href="/datenschutz" className="text-primary-600 underline hover:text-primary-700">
                Datenschutzerklärung
              </a>{" "}
              zu. Missbräuchliche Nutzung kann zum Ausschluss führen.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">4. Spenden</h2>
            <p className="mt-2">
              Spendenzahlungen über die Plattform sind freiwillige Zuwendungen an die
              jeweilige Gemeinde. Die Abwicklung erfolgt über Stripe. Rückerstattungen
              sind nur in Ausnahmefällen und nach Rücksprache mit der betreffenden
              Gemeinde möglich. Spendenbescheinigungen werden durch die Gemeinde
              ausgestellt, sofern diese dazu berechtigt ist.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">5. Verfügbarkeit</h2>
            <p className="mt-2">
              Wir bemühen uns um eine hohe Verfügbarkeit der Plattform, übernehmen
              jedoch keine Garantie für ununterbrochenen Zugang. Wartungsarbeiten
              werden nach Möglichkeit außerhalb der Stoßzeiten durchgeführt.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">6. Haftung</h2>
            <p className="mt-2">
              LMC Tech haftet nicht für Schäden, die durch die Nutzung der Plattform
              entstehen, soweit keine vorsätzliche oder grob fahrlässige Pflichtverletzung
              vorliegt. Für Inhalte, die von Gemeinden oder Mitgliedern eingestellt werden,
              übernimmt LMC Tech keine Haftung.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">7. Änderungen</h2>
            <p className="mt-2">
              LMC Tech behält sich vor, diese Nutzungsbedingungen jederzeit zu ändern.
              Wesentliche Änderungen werden den Nutzern rechtzeitig mitgeteilt.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">8. Anwendbares Recht</h2>
            <p className="mt-2">
              Es gilt deutsches Recht. Gerichtsstand ist Neu-Ulm, sofern gesetzlich
              zulässig.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
