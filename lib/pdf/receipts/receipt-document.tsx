/**
 * react-pdf Rendering der Spendenbescheinigung — NUR Layout.
 *
 * WICHTIG: server-only. Ausschließlich aus dem Route Handler importieren,
 * niemals aus Client-Komponenten (kein Bundle-Leak).
 */
import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToStream,
} from "@react-pdf/renderer";
import { formatCurrencyCents, formatReceiptDate } from "@/lib/utils";
import {
  RECEIPT_SCHEMA_VERSION,
  type ReceiptPdfData,
} from "./receipt-types";

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
    lineHeight: 1.4,
  },
  vereinName: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  vereinAddr: { fontSize: 9, color: "#444", marginTop: 2 },
  ruleEmitter: {
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    marginTop: 6,
    marginBottom: 22,
    fontSize: 8,
    color: "#555",
    paddingBottom: 2,
  },
  title: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    textAlign: "center",
    color: "#444",
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 8,
    color: "#666",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  block: { marginBottom: 16 },
  donorName: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  donorLine: { fontSize: 10, color: "#333", maxWidth: 320 },
  addressMissing: {
    fontSize: 9,
    color: "#b45309",
    marginTop: 2,
  },
  amountBox: {
    borderWidth: 1,
    borderColor: "#222",
    padding: 10,
    marginBottom: 16,
  },
  amountFigure: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  amountWords: { fontSize: 9, color: "#333", marginTop: 3 },
  paragraph: { marginBottom: 10, fontSize: 9.5, textAlign: "justify" },
  strong: { fontFamily: "Helvetica-Bold" },
  // Tabelle: fixe Spaltenbreiten, einfache Rows
  table: { marginBottom: 16 },
  tHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    paddingBottom: 3,
  },
  tRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
    paddingVertical: 3,
  },
  tFoot: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#222",
    paddingTop: 4,
    marginTop: 2,
  },
  cNr: { width: "8%", fontSize: 9 },
  cDate: { width: "27%", fontSize: 9 },
  cArt: { width: "45%", fontSize: 9 },
  cAmount: { width: "20%", fontSize: 9, textAlign: "right" },
  cHead: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#444" },
  checkboxRow: { flexDirection: "row", marginBottom: 4, fontSize: 9.5 },
  checkbox: {
    width: 9,
    height: 9,
    borderWidth: 1,
    borderColor: "#222",
    marginRight: 6,
    marginTop: 1,
  },
  signature: { marginTop: 36, flexDirection: "row", justifyContent: "space-between" },
  sigLineBox: { width: 200, alignItems: "center" },
  sigLine: {
    borderTopWidth: 1,
    borderTopColor: "#555",
    width: 200,
    marginBottom: 3,
  },
  sigCaption: { fontSize: 8, color: "#555" },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: "#888",
    borderTopWidth: 0.5,
    borderTopColor: "#ddd",
    paddingTop: 4,
  },
});

function multiline(text: string): React.ReactNode {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((line, i) => <Text key={i}>{line}</Text>);
}

function ReceiptPage({ data }: { data: ReceiptPdfData }) {
  if (data.schemaVersion !== RECEIPT_SCHEMA_VERSION) {
    throw new Error(
      `Unbekannte ReceiptPdfData schemaVersion: ${data.schemaVersion}`
    );
  }

  const isSammel = data.mode === "sammel";
  const heading = isSammel
    ? "Sammelbestätigung über Geldzuwendungen"
    : "Bestätigung über Geldzuwendungen";

  const periodLabel =
    data.periodFrom && data.periodTo
      ? `${formatReceiptDate(data.periodFrom)} – ${formatReceiptDate(data.periodTo)}`
      : `Jahr ${data.year}`;

  return (
    <Page size="A4" style={styles.page} wrap>
      {/* Aussteller */}
      <View>
        <Text style={styles.vereinName}>{data.verein.name}</Text>
        {data.verein.anschrift ? (
          <View style={styles.vereinAddr}>{multiline(data.verein.anschrift)}</View>
        ) : null}
      </View>
      <Text style={styles.ruleEmitter}>
        {data.verein.name}
        {data.verein.steuernummer
          ? ` · Steuernummer: ${data.verein.steuernummer}`
          : ""}
      </Text>

      <Text style={styles.title}>{heading}</Text>
      <Text style={styles.subtitle}>
        im Sinne des § 10b EStG für das Jahr {data.year}
      </Text>

      {/* Spender */}
      <View style={styles.block}>
        <Text style={styles.sectionLabel}>Aussteller (Zuwendungsempfänger)</Text>
        <View style={styles.donorLine}>{multiline(data.verein.anschrift || data.verein.name)}</View>
      </View>

      <View style={styles.block}>
        <Text style={styles.sectionLabel}>Name und Anschrift des Zuwendenden</Text>
        <Text style={styles.donorName}>{data.donor.name}</Text>
        {data.donor.membershipNumber ? (
          <Text style={styles.donorLine}>
            Mitgliedsnr.: {data.donor.membershipNumber}
          </Text>
        ) : null}
        {data.donor.anschrift ? (
          <View style={styles.donorLine}>{multiline(data.donor.anschrift)}</View>
        ) : (
          <Text style={styles.addressMissing}>
            Anschrift nicht hinterlegt — bitte ergänzen (steuerlich erforderlich).
          </Text>
        )}
      </View>

      {/* Betrag */}
      <View style={styles.amountBox}>
        <Text style={styles.sectionLabel}>
          {isSammel
            ? `Gesamtbetrag der Zuwendung (Zeitraum ${periodLabel})`
            : "Betrag der Zuwendung"}
        </Text>
        <Text style={styles.amountFigure}>
          {formatCurrencyCents(data.totalCents)}
        </Text>
        <Text style={styles.amountWords}>
          in Worten: {data.totalInWords}
        </Text>
        <Text style={styles.amountWords}>
          Art der Zuwendung: Geldzuwendung
        </Text>
        {!isSammel && data.donations[0] ? (
          <Text style={styles.amountWords}>
            Tag der Zuwendung: {formatReceiptDate(data.donations[0].date)}
          </Text>
        ) : null}
      </View>

      {/* Einzelspenden-Tabelle (bei Sammelbestätigung verpflichtend) */}
      {isSammel && data.donations.length > 0 ? (
        <View style={styles.table}>
          <Text style={styles.sectionLabel}>
            Einzelaufstellung der Zuwendungen
          </Text>
          <View style={styles.tHead}>
            <Text style={[styles.cNr, styles.cHead]}>Nr.</Text>
            <Text style={[styles.cDate, styles.cHead]}>Datum</Text>
            <Text style={[styles.cArt, styles.cHead]}>Art</Text>
            <Text style={[styles.cAmount, styles.cHead]}>Betrag</Text>
          </View>
          {data.donations.map((d, i) => (
            <View key={i} style={styles.tRow} wrap={false}>
              <Text style={styles.cNr}>{i + 1}</Text>
              <Text style={styles.cDate}>{formatReceiptDate(d.date)}</Text>
              <Text style={styles.cArt}>{d.art}</Text>
              <Text style={styles.cAmount}>
                {formatCurrencyCents(d.amountCents)}
              </Text>
            </View>
          ))}
          <View style={styles.tFoot} wrap={false}>
            <Text style={[styles.cNr]} />
            <Text style={[styles.cDate]} />
            <Text style={[styles.cArt, styles.strong]}>
              Gesamtsumme {data.year}
            </Text>
            <Text style={[styles.cAmount, styles.strong]}>
              {formatCurrencyCents(data.totalCents)}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Verzicht auf Erstattung */}
      <View style={styles.checkboxRow} wrap={false}>
        <View style={styles.checkbox} />
        <Text>
          Es handelt sich <Text style={styles.strong}>nicht</Text> um den
          Verzicht auf Erstattung von Aufwendungen.
        </Text>
      </View>

      {isSammel ? (
        <Text style={styles.paragraph}>
          Es wird bestätigt, dass es sich nicht um Mitgliedsbeiträge,
          sonstige Mitgliedsumlagen oder Aufnahmegebühren handelt und die
          Zuwendungen ausschließlich zu dem unten genannten steuerbegünstigten
          Zweck verwendet werden.
        </Text>
      ) : null}

      {/* Förderzweck + Freistellung */}
      <View wrap={false}>
        <Text style={styles.paragraph}>
          {data.verein.foerderzweck
            ? data.verein.foerderzweck
            : "Die Zuwendung wird ausschließlich für die satzungsmäßigen steuerbegünstigten Zwecke verwendet."}
        </Text>
        <Text style={styles.paragraph}>
          {data.verein.freistellungsbescheidText
            ? data.verein.freistellungsbescheidText
            : "Angaben zum Freistellungsbescheid sind in den Vereinseinstellungen zu hinterlegen."}
        </Text>
        <Text style={[styles.paragraph, { color: "#555", fontSize: 8.5 }]}>
          Hinweis: Wer vorsätzlich oder grob fahrlässig eine unrichtige
          Zuwendungsbestätigung erstellt oder veranlasst, dass Zuwendungen
          nicht zu den angegebenen steuerbegünstigten Zwecken verwendet
          werden, haftet für die entgangene Steuer (§ 10b Abs. 4 EStG, § 9
          Abs. 3 KStG, § 9 Nr. 5 GewStG). Bei Zuwendungen bis 300 € genügt
          als Nachweis der Kontoauszug zusammen mit dieser Bestätigung
          (§ 50 Abs. 4 EStDV).
        </Text>
      </View>

      {/* Ort/Datum + Unterschrift */}
      <View style={styles.signature} wrap={false}>
        <View>
          <Text style={styles.sigCaption}>
            Ausgestellt am: {formatReceiptDate(data.issuedAt)}
          </Text>
        </View>
        <View style={styles.sigLineBox}>
          <View style={styles.sigLine} />
          <Text style={styles.sigCaption}>
            {data.verein.name} — Unterschrift / Stempel
          </Text>
        </View>
      </View>

      {/* Footer mit Seitenzahl */}
      <View style={styles.footer} fixed>
        <Text>
          {data.verein.name} — Zuwendungsbestätigung {data.year}
        </Text>
        <Text
          render={({ pageNumber, totalPages }) =>
            `Seite ${pageNumber} von ${totalPages}`
          }
        />
      </View>
    </Page>
  );
}

/** Ein Dokument mit einer oder mehreren Seiten (1 Seite pro Spender). */
export function ReceiptDocument({
  receipts,
  mosqueName,
  year,
}: {
  receipts: ReceiptPdfData[];
  mosqueName: string;
  year: number;
}) {
  return (
    <Document
      title={`Spendenbescheinigung ${year}`}
      author={mosqueName}
      subject="BMF-konforme Zuwendungsbestätigung"
      keywords="Spende,Zuwendungsbestätigung,Spendenbescheinigung"
      creator="moschee-portal"
      producer="moschee-portal"
    >
      {receipts.map((r, i) => (
        <ReceiptPage key={i} data={r} />
      ))}
    </Document>
  );
}

/**
 * Rendert das (mehrseitige) Bescheinigungs-PDF zu einem Node-Stream.
 * Hält die gesamte react-pdf-Nutzung in dieser server-only Datei.
 */
export function renderReceiptsToStream(
  receipts: ReceiptPdfData[],
  mosqueName: string,
  year: number
) {
  return renderToStream(
    <ReceiptDocument receipts={receipts} mosqueName={mosqueName} year={year} />
  );
}
