/**
 * Eingefrorene Rechtstexte ("frozen texts").
 *
 * Warum: Eine Klick-Zustimmung ist rechtlich nur nachweisbar, wenn der exakte
 * Wortlaut der akzeptierten Fassung rekonstruierbar ist (DSGVO Art. 7 Abs. 1,
 * Art. 28). Daher liegt jeder Vertragstext je Version unveränderlich im Code
 * (git = Beweis-Anker). Beim Akzeptieren wird der sha256-Hash des kanonisch
 * serialisierten Texts gespeichert — er erkennt spätere Abweichungen und bindet
 * den Datensatz an die exakte Fassung.
 *
 * WICHTIG: Inhalt einer veröffentlichten Version NIE ändern — stattdessen neue
 * Version anlegen (z. B. avv-v2.ts) und LEGAL_VERSIONS hochzählen.
 */

/** Ein optionaler Link innerhalb eines Absatzes (Platzhalter `{link}` im Text). */
export interface LegalLink {
  label: string;
  href: string;
}

export interface LegalSection {
  heading?: string;
  /** Absätze. `{link}` wird durch `link` ersetzt (falls gesetzt). */
  paragraphs?: string[];
  /** Aufzählungspunkte. */
  list?: string[];
  /** Optionaler Link, der in einem Absatz via `{link}` referenziert wird. */
  link?: LegalLink;
}

export interface FrozenDoc {
  title: string;
  /** Optionaler Hinweis-/Entwurfsbanner oben (z. B. „Entwurf – anwaltlich prüfen"). */
  notice?: string;
  /** Stand/Datum der Fassung (rein informativ, fließt in den Hash ein). */
  effective: string;
  sections: LegalSection[];
}

export interface FrozenDocByLocale {
  de: FrozenDoc;
  tr: FrozenDoc;
}

/**
 * Kanonische, deterministische Serialisierung eines FrozenDoc für das Hashing.
 * Reihenfolge der Felder ist fix → stabiler Hash über Builds hinweg.
 */
export function serializeDoc(doc: FrozenDoc): string {
  const parts: string[] = [];
  parts.push(`TITLE:${doc.title}`);
  parts.push(`EFFECTIVE:${doc.effective}`);
  if (doc.notice) parts.push(`NOTICE:${doc.notice}`);
  doc.sections.forEach((s, i) => {
    parts.push(`#${i}`);
    if (s.heading) parts.push(`H:${s.heading}`);
    (s.paragraphs || []).forEach((p) => parts.push(`P:${p}`));
    (s.list || []).forEach((li) => parts.push(`L:${li}`));
    if (s.link) parts.push(`LINK:${s.link.label}|${s.link.href}`);
  });
  return parts.join("\n");
}
