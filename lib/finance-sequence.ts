/**
 * Finance — Belegnummer-Sequencer (plain-Modul, KEIN "use server").
 *
 * Mechanik (PB <0.23 hat KEIN atomares Inkrement, keine Multi-Doc-Tx):
 *  - `finance_sequences.next_number` ist nur ein **Hint** (Performance-Start).
 *  - Die **harte Garantie** liefert der UNIQUE-Index `idx_tx_beleg
 *    (mosque_id, beleg_nummer)`: zwei parallele Inserts mit derselben Nummer
 *    → einer schlägt mit Unique-Verletzung fehl → Retry mit n+1.
 *
 * Garantie ehrlich: Belegnummern sind **monoton steigend + kollisionsfrei**,
 * NICHT garantiert lückenlos (Crash zwischen Insert und Hint-Bump ⇒ seltene
 * Lücke; bei Vereinsbuchhaltung unkritisch). Atomares Inkrement / version-CAS
 * = Phase 2.
 *
 * Dieses Modul exportiert KEINE async-only-Pflicht (kein "use server"), damit
 * `formatBelegNummer` als reine Funktion auch in Tests/Reports nutzbar ist.
 */

import type { FinancePB } from "@/lib/finance-pb";
import { isUniqueViolationOnField } from "@/lib/finance-pb-errors";

const MAX_BELEG_ATTEMPTS = 6;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Belegnummer-Format `JJJJ-NNNN` (4-stellig null-gepadded, wächst bei >9999). */
export function formatBelegNummer(year: number, n: number): string {
  return `${year}-${String(n).padStart(4, "0")}`;
}

/**
 * Liest den Belegnummer-Hint für (mosque, year). Fehlt die Zeile, wird sie
 * idempotent mit `next_number=1` angelegt. Bei Unique-Race auf `idx_seq`
 * (paralleles Anlegen) → re-read. Rückgabe = Start-Hint für den Insert-Loop.
 */
export async function getNextBelegHint(
  fp: FinancePB,
  mosqueId: string,
  year: number
): Promise<number> {
  try {
    const row = await fp
      .collection("finance_sequences")
      .getFirstListItem(fp.tenantFilter(`year = ${year}`));
    const n = Number((row as { next_number?: number }).next_number);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  } catch {
    // Zeile fehlt (404) — idempotent anlegen.
    try {
      await fp.collection("finance_sequences").create({
        mosque_id: mosqueId,
        year,
        next_number: 1,
        version: 0,
      });
      return 1;
    } catch (createErr) {
      // Race: ein paralleler Aufruf hat die Zeile gerade angelegt → re-read.
      if (isUniqueViolationOnField(createErr, "year") || isUniqueViolationOnField(createErr, "mosque_id")) {
        try {
          const row = await fp
            .collection("finance_sequences")
            .getFirstListItem(fp.tenantFilter(`year = ${year}`));
          const n = Number((row as { next_number?: number }).next_number);
          return Number.isFinite(n) && n >= 1 ? n : 1;
        } catch {
          return 1;
        }
      }
      // Anderer Fehler beim Anlegen — Hint ist unkritisch, mit 1 starten.
      return 1;
    }
  }
}

/**
 * Schreibt `next_number = usedNumber + 1` best-effort (nur Hint).
 * Monotonie-Schutz: nie kleiner schreiben als der aktuelle Wert. Fehler werden
 * geschluckt — ein verlorener Hint führt nur zu Retries beim nächsten Insert.
 */
export async function bumpBelegHint(
  fp: FinancePB,
  mosqueId: string,
  year: number,
  usedNumber: number
): Promise<void> {
  try {
    const row = await fp
      .collection("finance_sequences")
      .getFirstListItem(fp.tenantFilter(`year = ${year}`));
    const current = Number((row as { next_number?: number }).next_number) || 0;
    const target = usedNumber + 1;
    if (target > current) {
      await fp.collection("finance_sequences").update((row as { id: string }).id, {
        next_number: target,
      });
    }
  } catch {
    // Hint-Verlust unkritisch.
  }
}

/** Wandelt einen Record in FormData (für File-Upload). null/undefined → skip. */
function recordToFormData(record: Record<string, unknown>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "boolean") {
      fd.append(key, value ? "true" : "false");
    } else {
      fd.append(key, String(value));
    }
  }
  return fd;
}

export type BelegFile = { blob: Blob; filename: string };

/**
 * Zentrale UNIQUE-Retry-Schleife für `transactions`-Inserts mit fortlaufender
 * Belegnummer. Genutzt von `createManualTransaction` (mit Beleg) und
 * `stornoTransaction` (ohne Beleg).
 *
 *  1. Start-Hint via `getNextBelegHint`.
 *  2. Bis zu 6 Versuche: Nummer bilden, Insert; bei Unique-Verletzung auf
 *     `beleg_nummer` → n++ + kurzes Backoff (50·attempt ms) → retry.
 *  3. Erfolg → `bumpBelegHint` best-effort, Record zurück.
 *  4. Erschöpft → `throw "beleg_nummer_collision_exhausted"`.
 *
 * `baseRecord` enthält ALLE Felder außer `beleg_nummer` (und außer der Datei).
 */
export async function insertTransactionWithBelegNummer<T extends { id: string; beleg_nummer: string }>(
  fp: FinancePB,
  mosqueId: string,
  year: number,
  baseRecord: Record<string, unknown>,
  belegFile?: BelegFile
): Promise<T> {
  let n = await getNextBelegHint(fp, mosqueId, year);

  for (let attempt = 0; attempt < MAX_BELEG_ATTEMPTS; attempt++) {
    const beleg_nummer = formatBelegNummer(year, n);
    const record = { ...baseRecord, beleg_nummer };
    try {
      let created: unknown;
      if (belegFile) {
        // FormData pro Versuch neu bauen (Blob ist wiederlesbar, FormData nicht).
        const fd = recordToFormData(record);
        fd.append("beleg_datei", belegFile.blob, belegFile.filename);
        created = await fp.collection("transactions").create(fd);
      } else {
        created = await fp.collection("transactions").create(record);
      }
      // Erfolg — Hint best-effort hochschreiben.
      await bumpBelegHint(fp, mosqueId, year, n);
      return created as T;
    } catch (err) {
      if (isUniqueViolationOnField(err, "beleg_nummer")) {
        n++;
        await sleep(50 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }

  throw new Error("beleg_nummer_collision_exhausted");
}
