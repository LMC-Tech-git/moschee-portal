"use server";

import { getFinancePB } from "@/lib/finance-pb";
import { safeAudit } from "@/lib/audit";
import { transactionNoteSchema } from "@/lib/validations";
import { toLedgerAtom } from "@/lib/finance-to-ledger-atom";
import type { Transaction, LedgerAtom } from "@/types";

/**
 * Finance — Read- + Note-Update-Layer (Sprint 3).
 *
 * Bewusst klein gehalten: voller Ledger-Merge (Events + manuelle Buchungen) +
 * EÜR/Kassenbericht = Sprint 4a. Hier nur:
 *  - `updateTransactionNote` — EINZIGE erlaubte Mutation auf einer Buchung.
 *  - `getManualTransactions` — manuelle Buchungen als LedgerAtoms (Vorstufe Merge).
 */

/** Einzige editierbare Spalte einer (immutablen) Buchung. */
const TRANSACTION_NOTE_ALLOWLIST = ["interne_notiz"] as const;

/**
 * Aktualisiert ausschließlich `interne_notiz`. Jedes andere Feld im patch →
 * `throw "transaction_immutable"`. Buchungen sind append-only/immutable;
 * Korrektur nur via Storno (`stornoTransaction`).
 */
export async function updateTransactionNote(
  mosqueId: string,
  transactionId: string,
  patch: Record<string, unknown>
): Promise<{ id: string }> {
  const forbidden = Object.keys(patch).filter(
    (k) => !(TRANSACTION_NOTE_ALLOWLIST as readonly string[]).includes(k)
  );
  if (forbidden.length > 0) {
    throw new Error(`transaction_immutable: ${forbidden.join(",")}`);
  }

  const parsed = transactionNoteSchema.safeParse({ interne_notiz: patch.interne_notiz });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}:${i.message}`).join("; ");
    throw new Error(`updateTransactionNote: Validierung fehlgeschlagen — ${issues}`);
  }

  const fp = await getFinancePB(mosqueId);

  // Tenant-Check
  const existing = (await fp.collection("transactions").getOne(transactionId)) as Transaction;
  if (existing.mosque_id !== mosqueId) {
    throw new Error("transaction_not_found");
  }

  await fp.collection("transactions").update(transactionId, {
    interne_notiz: parsed.data.interne_notiz,
  });

  await safeAudit({
    mosqueId,
    action: "transaction.note_updated",
    entityType: "transaction",
    entityId: transactionId,
  });

  return { id: transactionId };
}

/**
 * Liest manuelle Buchungen (`transactions`) als LedgerAtoms, tenant- und
 * optional jahr-gefiltert. Sortierung deterministisch
 * (`buchungsdatum ASC, beleg_nummer ASC, id ASC`). Voller Merge mit Events =
 * Sprint 4a.
 */
export async function getManualTransactions(
  mosqueId: string,
  opts?: { year?: number }
): Promise<LedgerAtom[]> {
  const fp = await getFinancePB(mosqueId);

  let filter = fp.tenantFilter();
  if (opts?.year) {
    const y = opts.year;
    filter = fp.tenantFilter(
      `buchungsdatum >= "${y}-01-01" && buchungsdatum <= "${y}-12-31 23:59:59"`
    );
  }

  const rows = (await fp.collection("transactions").getFullList({
    filter,
    sort: "+buchungsdatum,+beleg_nummer,+id",
  })) as unknown as Transaction[];

  return rows.map((tx) => toLedgerAtom(tx));
}
