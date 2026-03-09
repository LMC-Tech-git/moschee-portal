import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Allgemeine Geschäftsbedingungen | Moschee-Portal",
  description: "Nutzungsbedingungen und AGB für das Moschee-Portal – das digitale Portal für muslimische Gemeinden in Deutschland.",
  openGraph: {
    title: "Allgemeine Geschäftsbedingungen | Moschee-Portal",
    description: "Nutzungsbedingungen und AGB für das Moschee-Portal.",
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
              Diese AGB gelten für die Nutzung des Moschee-Portals, betrieben
              von der Islamischen Gemeinde Musterstadt e.V.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">2. Spenden</h2>
            <p className="mt-2">
              Spenden sind freiwillige Zuwendungen. Eine Rückerstattung ist nur
              in Ausnahmefällen und nach Rücksprache mit der Verwaltung möglich.
              Spendenbescheinigungen werden auf Anfrage ausgestellt.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">3. Mitgliedschaft</h2>
            <p className="mt-2">
              Die Mitgliedschaft in der Gemeinde ist freiwillig. Mit der
              Registrierung stimmen Sie der Verarbeitung Ihrer Daten gemäß
              unserer Datenschutzerklärung zu.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">4. Nutzungsbedingungen</h2>
            <p className="mt-2">
              Die Nutzung des Portals ist für Gemeindemitglieder kostenlos.
              Missbräuchliche Nutzung kann zum Ausschluss führen.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">5. Haftung</h2>
            <p className="mt-2">
              Die Islamische Gemeinde haftet nicht für Schäden, die durch die
              Nutzung des Portals entstehen, soweit keine vorsätzliche oder grob
              fahrlässige Pflichtverletzung vorliegt.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
