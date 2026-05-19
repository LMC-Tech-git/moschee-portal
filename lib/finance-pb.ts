import type PocketBase from "pocketbase";
import { getAdminPB } from "./pocketbase-admin";

/**
 * Finance-PocketBase-Wrapper (Sprint 1).
 *
 * Umhüllt das bestehende `getAdminPB()` — dadurch erbt der Finance-Pfad
 * automatisch `autoCancellation(false)` und den alten-PB Fetch-Auth-Fallback
 * via `/api/admins/auth-with-password`. **Kein neuer/separater PB-Client.**
 *
 * Zweck:
 *  - Strukturelle Multi-Tenant-Isolation: jede Finance-Operation läuft mit
 *    bekanntem `mosqueId`. Filter-Helper `tenantFilter()` injiziert
 *    `mosque_id = "<id>"` immer, damit Service-Code Tenant-Scope nicht selbst
 *    in jeden Filter-String pasten muss.
 *  - Collection-Whitelist: nur die in Phase 1 erlaubten Finance-Collections.
 *    Versucht Service-Code, eine andere Collection über `pb.collection(...)`
 *    zu lesen, ist das ein Bug — gehört nicht in den Finance-Layer.
 *
 * Konvention (Lint/Grep-Gate, siehe Plan §2): roher `getAdminPB()` in
 * `lib/finance-*` / `lib/actions/finance-*` ist verboten.
 */

const FINANCE_COLLECTIONS = new Set([
  "finance_source_events",
  "transactions",
  "finance_sequences",
  // Lesender Zugriff auf settings ist erlaubt (Lock-Flags); Schreibzugriff nur
  // via dedizierter Settings-Action (außerhalb finance-pb).
  "settings",
  // Quell-Collections müssen lesbar sein (Drift-Sweeper/Recon, Lock-Setzen).
  "donations",
  "student_fees",
  "sponsors",
]);

export type FinancePB = {
  pb: PocketBase;
  mosqueId: string;
  /** Gibt `mosque_id = "<id>" && (<userFilter>)` zurück. Wenn `userFilter`
   *  leer, nur der Tenant-Scope. */
  tenantFilter(userFilter?: string): string;
  /** Wrappt `pb.collection(name)` mit Collection-Whitelist. */
  collection(name: string): ReturnType<PocketBase["collection"]>;
};

export async function getFinancePB(mosqueId: string): Promise<FinancePB> {
  if (!mosqueId || typeof mosqueId !== "string") {
    throw new Error("getFinancePB: mosqueId fehlt oder ungültig");
  }
  const pb = await getAdminPB();

  return {
    pb,
    mosqueId,
    tenantFilter(userFilter?: string) {
      // PB-Filter-Syntax: doppelte Anführungszeichen für String-Literale.
      // mosqueId stammt vom Server (resolveMosque/getAuth), niemals aus
      // ungetrustetem Input — daher kein Escaping nötig. Defensive Prüfung
      // verhindert offensichtliche Injektion durch Code-Bugs.
      if (mosqueId.includes('"') || mosqueId.includes("\\")) {
        throw new Error("getFinancePB: mosqueId enthält unerlaubte Zeichen");
      }
      const scope = `mosque_id = "${mosqueId}"`;
      if (!userFilter) return scope;
      return `${scope} && (${userFilter})`;
    },
    collection(name: string) {
      if (!FINANCE_COLLECTIONS.has(name)) {
        throw new Error(
          `getFinancePB: Collection "${name}" nicht in Finance-Whitelist. ` +
            "Wenn Cross-Domain-Zugriff nötig, gehört das nicht in den Finance-Layer."
        );
      }
      return pb.collection(name);
    },
  };
}
