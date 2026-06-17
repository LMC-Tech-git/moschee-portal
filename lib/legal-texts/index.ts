import type { FrozenDoc, FrozenDocByLocale } from "./types";
import AGB_V1 from "./agb-v1";
import DATENSCHUTZ_V1 from "./datenschutz-v1";
import NUTZUNGSVEREINBARUNG_V1 from "./nutzungsvereinbarung-v1";
import AVV_V1 from "./avv-v1";

export type { FrozenDoc, LegalSection, LegalLink } from "./types";
export { serializeDoc } from "./types";

export type LegalDocType =
  | "agb"
  | "datenschutz"
  | "nutzungsvereinbarung"
  | "avv";

export type LegalLocale = "de" | "tr";

/**
 * Registry: docType → version → Text (de+tr).
 * Neue Version = neuer Eintrag; alte Fassungen NIE entfernen (Bestands-Records).
 */
const FROZEN: Record<LegalDocType, Record<number, FrozenDocByLocale>> = {
  agb: { 1: AGB_V1 },
  datenschutz: { 1: DATENSCHUTZ_V1 },
  nutzungsvereinbarung: { 1: NUTZUNGSVEREINBARUNG_V1 },
  avv: { 1: AVV_V1 },
};

/**
 * Liefert den eingefrorenen Text einer bestimmten Fassung in der gewünschten
 * Sprache. Fällt auf Deutsch zurück (rechtlich maßgeblich), wenn die Locale
 * fehlt. Gibt null zurück, wenn die Version unbekannt ist.
 */
export function getFrozenDoc(
  docType: LegalDocType,
  version: number,
  locale: LegalLocale = "de"
): FrozenDoc | null {
  const byLocale = FROZEN[docType]?.[version];
  if (!byLocale) return null;
  return byLocale[locale] || byLocale.de;
}
