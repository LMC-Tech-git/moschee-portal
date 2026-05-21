/**
 * Finance — PocketBase-Fehler-Helfer (plain-Modul, KEIN "use server").
 *
 * DRY-Extraktion aus `finance-events.ts`: erkennt Unique-Constraint-
 * Verletzungen. Genutzt von Event-Emit (idempotenter Doppel-Emit) und
 * Belegnummer-Sequencer (UNIQUE-Retry-Schleife).
 */

/**
 * Erkennt eine PocketBase-Unique-Constraint-Verletzung an Marker im Response.
 * PB-SDK wirft strukturierte Fehler; wir prüfen defensiv mehrere Signale.
 */
export function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    status?: number;
    message?: string;
    data?: { data?: Record<string, unknown> };
  };
  if (e.status !== 400) return false;
  const msg = (e.message || "").toLowerCase();
  if (msg.includes("unique") || msg.includes("duplicate")) return true;
  // PB-Validation-Fehler: data.data.<field>.code === "validation_not_unique"
  const fieldErrors = e.data?.data;
  if (fieldErrors && typeof fieldErrors === "object") {
    for (const v of Object.values(fieldErrors)) {
      const code = (v as { code?: string })?.code;
      if (code === "validation_not_unique") return true;
    }
  }
  return false;
}

/**
 * Wie `isUniqueViolation`, aber nur true wenn die Verletzung ein bestimmtes
 * Feld betrifft (z.B. `beleg_nummer`). Erlaubt dem Sequencer, eine Kollision
 * auf der Belegnummer von anderen Unique-Konflikten zu unterscheiden.
 */
export function isUniqueViolationOnField(err: unknown, field: string): boolean {
  if (!isUniqueViolation(err)) return false;
  const e = err as {
    message?: string;
    data?: { data?: Record<string, unknown> };
  };
  const fieldErrors = e.data?.data;
  if (fieldErrors && typeof fieldErrors === "object" && field in fieldErrors) {
    const code = (fieldErrors[field] as { code?: string })?.code;
    if (code === "validation_not_unique") return true;
  }
  // Manche alten PB-Versionen liefern keine feld-granularen data-Fehler,
  // sondern nur die Index-Meldung im Text. Dann konservativ am Feldnamen matchen.
  const msg = (e.message || "").toLowerCase();
  return msg.includes(field.toLowerCase());
}
