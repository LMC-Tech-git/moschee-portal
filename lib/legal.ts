/**
 * Rechtstexte-Verwaltung: Versionen, Rechtsgrundlage, Hash und Gate-Logik.
 *
 * Single Source of Truth für „welche Fassung ist aktuell". Bei Textänderung
 * neue Version anlegen (lib/legal-texts/<doc>-vN.ts) und hier hochzählen →
 * Gate erzwingt Neu-Zustimmung.
 */

import {
  getFrozenDoc,
  serializeDoc,
  type LegalDocType,
  type LegalLocale,
} from "./legal-texts";

export type { LegalDocType, LegalLocale } from "./legal-texts";
export { getFrozenDoc } from "./legal-texts";

/** Aktuelle Version je Dokument. Bei Textänderung hochzählen. */
export const LEGAL_VERSIONS: Record<LegalDocType, number> = {
  agb: 1,
  datenschutz: 1,
  nutzungsvereinbarung: 1,
  avv: 1,
};

/**
 * Rechtsgrundlage je Dokument. Vertrag (Art. 6 Abs. 1 lit. b) wird *akzeptiert*
 * und ist nicht frei widerrufbar; eine Information (notice) wird lediglich zur
 * *Kenntnis genommen*. Steuert das Gate-Verhalten (blockierend vs. abweisbar).
 */
export const LEGAL_BASIS: Record<LegalDocType, "contract" | "notice"> = {
  agb: "contract",
  nutzungsvereinbarung: "contract",
  avv: "contract",
  datenschutz: "notice",
};

/** Dokumente, denen der Vorstand der Gemeinde zustimmen muss. */
export const MOSQUE_DOCS: LegalDocType[] = ["nutzungsvereinbarung", "avv"];
/** Dokumente, die Einzelnutzer akzeptieren/zur Kenntnis nehmen. */
export const USER_DOCS: LegalDocType[] = ["agb", "datenschutz"];

export type LegalScope = "mosque" | "user";

export function docsForScope(scope: LegalScope): LegalDocType[] {
  return scope === "mosque" ? MOSQUE_DOCS : USER_DOCS;
}

/**
 * sha256 des kanonisch serialisierten eingefrorenen Texts. Bindet einen
 * Acceptance-Record an die exakte Fassung und erkennt spätere Abweichungen.
 * Web-Crypto → läuft server-seitig wie in Edge-Runtime.
 */
export async function docHash(
  docType: LegalDocType,
  version: number,
  locale: LegalLocale
): Promise<string> {
  const doc = getFrozenDoc(docType, version, locale);
  if (!doc) return "";
  const encoder = new TextEncoder();
  const data = encoder.encode(serializeDoc(doc));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Minimaler Datensatz, wie ihn die Gate-Abfrage zurückliefert. */
export interface AcceptedDocRef {
  doc_type: LegalDocType;
  doc_version: number;
}

/**
 * Ermittelt, welche Dokumente eines Scopes noch fehlen oder veraltet sind
 * (akzeptierte Version < aktuelle Version).
 */
export function outstandingDocs(
  scope: LegalScope,
  accepted: AcceptedDocRef[]
): LegalDocType[] {
  const latestAccepted = new Map<LegalDocType, number>();
  for (const a of accepted) {
    const cur = latestAccepted.get(a.doc_type) ?? 0;
    if (a.doc_version > cur) latestAccepted.set(a.doc_type, a.doc_version);
  }
  return docsForScope(scope).filter(
    (doc) => (latestAccepted.get(doc) ?? 0) < LEGAL_VERSIONS[doc]
  );
}
