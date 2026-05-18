/**
 * Deutsche Zahl-zu-Wort-Umwandlung für Spendenbescheinigungen.
 *
 * BMF-Pflicht: Betrag zusätzlich in Worten. Bereich 0–999.999.999,99 €.
 * Bewusst eigene Implementierung (keine Dependency, volle Kontrolle über
 * deutsche Schreibweise inkl. "ein"/"eins"-Sonderfall).
 */

const ONES = [
  "null", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht",
  "neun", "zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn",
  "sechzehn", "siebzehn", "achtzehn", "neunzehn",
];
const TENS = [
  "", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig",
  "achtzig", "neunzig",
];

/** 1–999 in Worten (ohne führendes "und"). */
function belowThousand(n: number): string {
  let out = "";
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;

  if (hundreds > 0) {
    out += `${hundreds === 1 ? "ein" : ONES[hundreds]}hundert`;
  }

  if (rest === 0) {
    return out;
  }

  if (rest < 20) {
    out += ONES[rest];
  } else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    if (o > 0) {
      out += `${ONES[o]}und${TENS[t]}`;
    } else {
      out += TENS[t];
    }
  }
  return out;
}

/** Ganze Zahl 0–999.999.999 in Worten. */
function integerToWords(n: number): string {
  if (n === 0) return "null";

  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;

  let out = "";

  if (millions > 0) {
    out +=
      millions === 1
        ? "eine Million "
        : `${belowThousand(millions)} Millionen `;
  }

  if (thousands > 0) {
    out += `${belowThousand(thousands)}tausend`;
  }

  if (rest > 0) {
    out += belowThousand(rest);
  }

  return out.trim();
}

/**
 * Cent-Betrag → deutscher Wortlaut, z.B.
 *  15000  → "einhundertfünfzig Euro"
 *  15050  → "einhundertfünfzig Euro und fünfzig Cent"
 *  100    → "ein Euro"
 */
export function euroInWords(cents: number): string {
  const safe = Math.max(0, Math.round(cents));
  const euros = Math.floor(safe / 100);
  const restCents = safe % 100;

  const euroWord =
    euros === 1 ? "ein Euro" : `${integerToWords(euros)} Euro`;

  if (restCents === 0) {
    return euroWord;
  }

  const centWord =
    restCents === 1 ? "ein Cent" : `${integerToWords(restCents)} Cent`;

  return `${euroWord} und ${centWord}`;
}
