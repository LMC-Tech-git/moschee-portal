"use server";

import * as XLSX from "xlsx";
import { getFinancePB } from "@/lib/finance-pb";
import { safeAudit } from "@/lib/audit";
import { transactionNoteSchema } from "@/lib/validations";
import { toLedgerAtom, toSignedAmount } from "@/lib/finance-to-ledger-atom";
import { assertFinanceAccess, assertFinancePermission } from "@/lib/finance-permissions";
import { sanitizeForAI } from "@/lib/ai/sanitize";
import { suggestCategory, isAiConfigured } from "@/lib/ai/categorize";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  createManualTransaction,
  stornoTransaction,
  type CreateManualTransactionInput,
  type ManualTransactionResult,
} from "@/lib/actions/finance-domain";
import {
  FINANCE_INCOME_CATEGORY_IDS,
  FINANCE_EXPENSE_CATEGORY_IDS,
} from "@/lib/constants";
import type {
  Transaction,
  FinanceSourceEvent,
  LedgerAtom,
  LedgerPage,
  FinanceKPIs,
  EURReport,
  JahresberichtReport,
  KassenberichtReport,
  KontoBlock,
} from "@/types";

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

// ===========================================================================
// Sprint 4 — Read/Report-Layer (Merge + KPI + EÜR + Jahresbericht + Kassenbericht)
//
// Aggregation AUSSCHLIESSLICH über persistiertes `classification`/`kategorie`
// (nie event_type/typ). PB <0.23 kein GROUP BY → fetch-filtered + JS-Σ (forEach).
// EIN Lade-Pfad `loadAtomsForYear` (V-B) speist getLedgerAtoms/KPI/EUR/Jahresbericht
// → KPI == Σ(atoms), keine Filter-Drift. Σ nie über die UI-gekappte Liste (V-C).
// ===========================================================================

/** UI-Hard-Limit für gemergte Atoms/Jahr (Phase 1; Keyset = Phase 3). */
const LEDGER_UI_CAP = 10000;

const INCOME_KAT = new Set<string>(FINANCE_INCOME_CATEGORY_IDS);
const EXPENSE_KAT = new Set<string>(FINANCE_EXPENSE_CATEGORY_IDS);

function yearWindow(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year}-12-31 23:59:59` };
}

/** konto_typ → Kassenbericht-Topf. "other" wird zu "bank" gemergt (Plan §5/Entscheidung 3). */
function kontoBucket(kontoTyp: string): "bar" | "bank" {
  return kontoTyp === "cash" ? "bar" : "bank";
}

/**
 * EINZIGE Quelle gemergter LedgerAtoms eines Jahres (V-B/V-E). Lädt beide
 * immutable Streams jahrgefiltert (nur nötige Felder), mappt je via `toLedgerAtom`,
 * additive Union, deterministisch sortiert. Vollständig (kein Σ-Cap hier — V-C).
 */
async function loadAtomsForYear(mosqueId: string, year: number): Promise<LedgerAtom[]> {
  const fp = await getFinancePB(mosqueId);
  const { start, end } = yearWindow(year);

  const events = (await fp.collection("finance_source_events").getFullList({
    filter: fp.tenantFilter(`occurred_at >= "${start}" && occurred_at <= "${end}"`),
    fields:
      "event_uuid,mosque_id,occurred_at,betrag_cents,classification,kategorie,konto_typ,zahlungskanal,source_collection,source_id,event_type,original_amount_cents",
    sort: "+occurred_at",
  })) as unknown as FinanceSourceEvent[];

  const txs = (await fp.collection("transactions").getFullList({
    filter: fp.tenantFilter(`buchungsdatum >= "${start}" && buchungsdatum <= "${end}"`),
    fields:
      "id,mosque_id,buchungsdatum,betrag_cents,typ,classification,kategorie,konto_typ,zahlungskanal,beleg_nummer,beleg_datei",
    sort: "+buchungsdatum",
  })) as unknown as Transaction[];

  const atoms: LedgerAtom[] = [
    ...events.map((e) => toLedgerAtom(e)),
    ...txs.map((t) => toLedgerAtom(t)),
  ];

  // Standard-Journal-Sort: datum ASC, beleg_nummer ASC, id ASC
  atoms.sort((a, b) => {
    if (a.datum !== b.datum) return a.datum < b.datum ? -1 : 1;
    if (a.beleg_nummer !== b.beleg_nummer) return a.beleg_nummer < b.beleg_nummer ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return atoms;
}

/**
 * Paginierte, gefilterte Ledger-Sicht für die UI. `truncated=true` wenn das
 * Jahr das UI-Hard-Limit überschreitet (Banner). Filter post-merge in JS.
 */
export async function getLedgerAtoms(
  mosqueId: string,
  opts: {
    year: number;
    konto?: "bar" | "bank";
    typ?: "einnahme" | "ausgabe";
    kategorie?: string;
    page?: number;
    perPage?: number;
  }
): Promise<LedgerPage> {
  const page = opts.page && opts.page > 0 ? opts.page : 1;
  const perPage = opts.perPage && opts.perPage > 0 ? opts.perPage : 50;

  let atoms = await loadAtomsForYear(mosqueId, opts.year);
  if (opts.konto) atoms = atoms.filter((a) => kontoBucket(a.konto_typ) === opts.konto);
  if (opts.typ) {
    const cls = opts.typ === "einnahme" ? "income" : "expense";
    atoms = atoms.filter((a) => a.classification === cls);
  }
  if (opts.kategorie) atoms = atoms.filter((a) => a.kategorie === opts.kategorie);

  const total = atoms.length;
  const truncated = total > LEDGER_UI_CAP;
  const startIdx = (page - 1) * perPage;
  const pageAtoms = atoms.slice(startIdx, startIdx + perPage);
  const hasMore = startIdx + perPage < total;

  return { atoms: pageAtoms, total, hasMore, truncated };
}

/**
 * EÜR durch Netting per Kategorie (Σ signed_amount_cents je kategorie), gebucket
 * NACH Kategorie-Zugehörigkeit (income/expense IDs) — NICHT nach atom.classification.
 * So nettet ein Storno (invertiertes classification, gleiche kategorie) in der
 * Original-Kategorie statt ein Phantom im fremden Topf zu erzeugen.
 */
function buildEUR(atoms: LedgerAtom[]): EURReport {
  const net = new Map<string, number>();
  atoms.forEach((a) => net.set(a.kategorie, (net.get(a.kategorie) ?? 0) + a.signed_amount_cents));

  const einnahmen: { kategorie: string; cents: number }[] = [];
  const ausgaben: { kategorie: string; cents: number }[] = [];
  let einTotal = 0;
  let ausTotal = 0;

  FINANCE_INCOME_CATEGORY_IDS.forEach((k) => {
    const c = net.get(k) ?? 0; // income: signed bereits positiv
    einnahmen.push({ kategorie: k, cents: c });
    einTotal += c;
  });
  FINANCE_EXPENSE_CATEGORY_IDS.forEach((k) => {
    const c = -(net.get(k) ?? 0); // expense: signed negativ → als positiver Aufwand
    ausgaben.push({ kategorie: k, cents: c });
    ausTotal += c;
  });

  return {
    einnahmen,
    ausgaben,
    einnahmen_total_cents: einTotal,
    ausgaben_total_cents: ausTotal,
    ueberschuss_cents: einTotal - ausTotal,
  };
}

export async function getEUR(mosqueId: string, year: number): Promise<EURReport> {
  const atoms = await loadAtomsForYear(mosqueId, year);
  return buildEUR(atoms);
}

/**
 * Settings-Anfangsbestände + Startjahr. Liest `settings` via getFinancePB
 * (Whitelist erlaubt lesend). Fehlt der Record: alles 0.
 */
async function loadKassenSettings(mosqueId: string): Promise<{
  startYear: number;
  barStart: number;
  bankStart: number;
}> {
  const fp = await getFinancePB(mosqueId);
  try {
    const rec = await fp.collection("settings").getFirstListItem(fp.tenantFilter(), {
      fields: "kassenbuch_start_year,kassenbuch_bar_start_cents,kassenbuch_bank_start_cents",
    });
    return {
      startYear: Number((rec as { kassenbuch_start_year?: number }).kassenbuch_start_year) || 0,
      barStart: Number((rec as { kassenbuch_bar_start_cents?: number }).kassenbuch_bar_start_cents) || 0,
      bankStart: Number((rec as { kassenbuch_bank_start_cents?: number }).kassenbuch_bank_start_cents) || 0,
    };
  } catch {
    return { startYear: 0, barStart: 0, bankStart: 0 };
  }
}

/**
 * Endbestand Bar/Bank zum Jahresende `year` durch Carryover ab `kassenbuch_start_year`
 * (Settings-Startwerte) iterativ. EINE Quelle für KPI-Kassenstand UND Kassenbericht-
 * Endbestand → garantiert Anfang N == Ende N−1 + KPI-Konsistenz. "other"→bank.
 */
async function computeKontoBalancesUpToYearEnd(
  mosqueId: string,
  year: number
): Promise<{ bar: number; bank: number }> {
  const s = await loadKassenSettings(mosqueId);
  const startYear = s.startYear || year;
  let bar = s.barStart;
  let bank = s.bankStart;

  for (let y = startYear; y <= year; y++) {
    const atoms = await loadAtomsForYear(mosqueId, y);
    atoms.forEach((a) => {
      if (kontoBucket(a.konto_typ) === "bar") bar += a.signed_amount_cents;
      else bank += a.signed_amount_cents;
    });
  }
  return { bar, bank };
}

export async function getFinanceKPIs(mosqueId: string, year: number): Promise<FinanceKPIs> {
  const atoms = await loadAtomsForYear(mosqueId, year);
  const eur = buildEUR(atoms); // Netting-konsistent (kein Storno-Double-Count)
  const balances = await computeKontoBalancesUpToYearEnd(mosqueId, year);
  return {
    einnahmen_cents: eur.einnahmen_total_cents,
    ausgaben_cents: eur.ausgaben_total_cents,
    saldo_cents: eur.einnahmen_total_cents - eur.ausgaben_total_cents,
    kassenstand_bar_cents: balances.bar,
    kassenstand_bank_cents: balances.bank,
  };
}

export async function getJahresbericht(
  mosqueId: string,
  year: number
): Promise<JahresberichtReport> {
  const atoms = await loadAtomsForYear(mosqueId, year);
  const eur = buildEUR(atoms);
  const balances = await computeKontoBalancesUpToYearEnd(mosqueId, year);

  // 12 Monatsbuckets, Netting nach Kategorie-Zugehörigkeit (signed).
  const monate: { month: string; einnahmen_cents: number; ausgaben_cents: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    monate.push({ month: `${year}-${String(m).padStart(2, "0")}`, einnahmen_cents: 0, ausgaben_cents: 0 });
  }
  atoms.forEach((a) => {
    const idx = Number(a.datum.slice(5, 7)) - 1;
    if (idx < 0 || idx > 11) return;
    if (INCOME_KAT.has(a.kategorie)) monate[idx].einnahmen_cents += a.signed_amount_cents;
    else if (EXPENSE_KAT.has(a.kategorie)) monate[idx].ausgaben_cents += -a.signed_amount_cents;
  });

  const kpis: FinanceKPIs = {
    einnahmen_cents: eur.einnahmen_total_cents,
    ausgaben_cents: eur.ausgaben_total_cents,
    saldo_cents: eur.einnahmen_total_cents - eur.ausgaben_total_cents,
    kassenstand_bar_cents: balances.bar,
    kassenstand_bank_cents: balances.bank,
  };

  return { kpis, monate, eur };
}

/**
 * Kassenbericht mit Bestandsfortschreibung. Anfang N = Ende N−1 (Carryover via
 * computeKontoBalancesUpToYearEnd(year-1)). Cash-Flow-Sicht je Konto: positive
 * signed → Einnahme-Fluss, negative → Ausgabe-Fluss. Bar/Bank getrennt, other→bank.
 */
export async function getKassenbericht(
  mosqueId: string,
  year: number
): Promise<KassenberichtReport> {
  const anfang = await computeKontoBalancesUpToYearEnd(mosqueId, year - 1);
  const atoms = await loadAtomsForYear(mosqueId, year);

  let barIn = 0, barOut = 0, bankIn = 0, bankOut = 0;
  atoms.forEach((a) => {
    const isBar = kontoBucket(a.konto_typ) === "bar";
    if (a.signed_amount_cents >= 0) {
      if (isBar) barIn += a.signed_amount_cents;
      else bankIn += a.signed_amount_cents;
    } else {
      if (isBar) barOut += -a.signed_amount_cents;
      else bankOut += -a.signed_amount_cents;
    }
  });

  const bar: KontoBlock = {
    anfang_cents: anfang.bar,
    einnahmen_cents: barIn,
    ausgaben_cents: barOut,
    ende_cents: anfang.bar + barIn - barOut,
  };
  const bank: KontoBlock = {
    anfang_cents: anfang.bank,
    einnahmen_cents: bankIn,
    ausgaben_cents: bankOut,
    ende_cents: anfang.bank + bankIn - bankOut,
  };
  const gesamt: KontoBlock = {
    anfang_cents: bar.anfang_cents + bank.anfang_cents,
    einnahmen_cents: bar.einnahmen_cents + bank.einnahmen_cents,
    ausgaben_cents: bar.ausgaben_cents + bank.ausgaben_cents,
    ende_cents: bar.ende_cents + bank.ende_cents,
  };

  return { year, bar, bank, gesamt };
}

// ===========================================================================
// Sprint 4 — UI-Wrapper mit Q4-Guard (Rolle + mosque-match)
//
// UI ruft diese statt der Domain-Funktionen direkt: assertFinanceAccess prüft
// Rolle/Mandant serverseitig, userId kommt aus dem Cookie (nicht vom Client).
// Domain-Funktionen bleiben guard-frei für Test-/Seed-/System-Aufrufe.
// ===========================================================================

/**
 * Server Action wrapper: nimmt FormData entgegen (Next.js serialisiert File
 * nur über FormData, nicht als Plain-Object-Property).
 */
export async function createManualTransactionAction(
  formData: FormData
): Promise<ManualTransactionResult> {
  const mosqueId = formData.get("mosqueId") as string;
  const { userId } = await assertFinancePermission(mosqueId, "finance_create");

  const betragCents = parseInt(formData.get("betragCents") as string, 10);
  const belegEntry = formData.get("belegFile");
  const belegFile =
    belegEntry instanceof File && belegEntry.size > 0 ? belegEntry : undefined;

  return createManualTransaction({
    mosqueId,
    userId,
    buchungsdatum: formData.get("buchungsdatum") as string,
    betragCents,
    typ: formData.get("typ") as "einnahme" | "ausgabe",
    kategorie: formData.get("kategorie") as string,
    beschreibung: formData.get("beschreibung") as string,
    kontoTyp: formData.get("kontoTyp") as import("@/types").KontoTyp,
    zahlungskanal:
      (formData.get("zahlungskanal") as import("@/types").Zahlungskanal) ||
      undefined,
    belegFile,
  });
}

export async function stornoTransactionAction(
  mosqueId: string,
  transactionId: string,
  grund?: string
): Promise<ManualTransactionResult> {
  const { userId } = await assertFinancePermission(mosqueId, "finance_storno");
  return stornoTransaction({ mosqueId, userId, transactionId, grund });
}

// ===========================================================================
// Sprint 6 — XLSX-Steuerberater-Export
//
// Eigener Lade-Pfad (kein UI-Cap). Buchungen aus RAW transactions + events
// (LedgerAtom verliert beschreibung/leistungsdatum). Deterministische Sortierung
// datum ASC, beleg_nummer ASC, id ASC. Bezeichnung "Steuerberater-Export" —
// KEINE DATEV/SKR/EÜR-Konformitätsbehauptung.
// ===========================================================================

/** Deutsche Anzeige-Labels für den Export (server-seitig, keine i18n verfügbar). */
const KAT_LABEL_DE: Record<string, string> = {
  spenden: "Spenden",
  mitgliedsbeitraege: "Mitgliedsbeiträge",
  madrasa_gebuehren: "Madrasa-Gebühren",
  foerderpartner: "Förderpartner",
  veranstaltungen_einnahme: "Veranstaltungen (Einnahme)",
  zuschuesse: "Zuschüsse",
  sonstige_einnahmen: "Sonstige Einnahmen",
  miete: "Miete",
  nebenkosten: "Nebenkosten",
  gehaelter_honorare: "Gehälter/Honorare",
  instandhaltung: "Instandhaltung",
  veranstaltungen_ausgabe: "Veranstaltungen (Ausgabe)",
  verwaltung: "Verwaltung",
  zakat_weiterleitung: "Zakat-Weiterleitung",
  sonstige_ausgaben: "Sonstige Ausgaben",
};
const KONTO_LABEL_DE: Record<string, string> = { cash: "Kasse", bank: "Bank", other: "Sonstiges" };
const KANAL_LABEL_DE: Record<string, string> = {
  bar: "Bar",
  ueberweisung: "Überweisung",
  stripe: "Stripe",
  paypal: "PayPal",
  sonstige: "Sonstige",
};
const SOURCE_COLL_LABEL_DE: Record<string, string> = {
  donations: "Spende",
  student_fees: "Gebühr",
  sponsors: "Förderpartner",
};

function katLabel(id: string): string {
  return KAT_LABEL_DE[id] ?? id;
}

/** Eine Buchungszeile für das XLSX-Buchungen-Blatt. */
type ExportRow = {
  datum: string;
  leistungsdatum: string;
  beleg: string;
  typ: string;
  kategorie: string;
  konto: string;
  kanal: string;
  betrag: number; // positiv, in €
  vorzeichen: number; // signed, in €
  beschreibung: string;
  classification: string;
  quelle: string;
  sortDatum: string;
  sortId: string;
};

/**
 * Lädt RAW transactions + finance_source_events eines Jahres und mappt zu
 * Export-Zeilen. NICHT über LedgerAtom (verliert beschreibung/leistungsdatum).
 */
async function loadExportRows(mosqueId: string, year: number): Promise<ExportRow[]> {
  const fp = await getFinancePB(mosqueId);
  const { start, end } = yearWindow(year);

  const events = (await fp.collection("finance_source_events").getFullList({
    filter: fp.tenantFilter(`occurred_at >= "${start}" && occurred_at <= "${end}"`),
    fields:
      "id,occurred_at,betrag_cents,classification,kategorie,konto_typ,zahlungskanal,source_collection,event_type,payload_json",
    sort: "+occurred_at,+id",
  })) as unknown as FinanceSourceEvent[];

  const txs = (await fp.collection("transactions").getFullList({
    filter: fp.tenantFilter(`buchungsdatum >= "${start}" && buchungsdatum <= "${end}"`),
    fields:
      "id,buchungsdatum,leistungsdatum,betrag_cents,classification,kategorie,konto_typ,zahlungskanal,beleg_nummer,beschreibung",
    sort: "+buchungsdatum,+beleg_nummer,+id",
  })) as unknown as Transaction[];

  const rows: ExportRow[] = [];

  events.forEach((e) => {
    const signed = toSignedAmount(e.classification, e.betrag_cents);
    let beschreibung = "";
    try {
      const p = JSON.parse(e.payload_json || "{}") as { category?: string; reason?: string };
      beschreibung = p.reason || (p.category ? katLabel(p.category) : "");
    } catch {
      /* ignore */
    }
    rows.push({
      datum: e.occurred_at.slice(0, 10),
      leistungsdatum: "",
      beleg: "",
      typ: e.classification === "income" ? "Einnahme" : "Ausgabe",
      kategorie: katLabel(e.kategorie),
      konto: KONTO_LABEL_DE[e.konto_typ] ?? e.konto_typ,
      kanal: KANAL_LABEL_DE[e.zahlungskanal] ?? e.zahlungskanal,
      betrag: Math.abs(e.betrag_cents) / 100,
      vorzeichen: signed / 100,
      beschreibung,
      classification: e.classification,
      quelle: SOURCE_COLL_LABEL_DE[e.source_collection] ?? e.source_collection,
      sortDatum: e.occurred_at.slice(0, 10),
      sortId: e.id,
    });
  });

  txs.forEach((t) => {
    const signed = toSignedAmount(t.classification, t.betrag_cents);
    rows.push({
      datum: t.buchungsdatum.slice(0, 10),
      leistungsdatum: (t.leistungsdatum || t.buchungsdatum).slice(0, 10),
      beleg: t.beleg_nummer || "",
      typ: t.classification === "income" ? "Einnahme" : "Ausgabe",
      kategorie: katLabel(t.kategorie),
      konto: KONTO_LABEL_DE[t.konto_typ] ?? t.konto_typ,
      kanal: KANAL_LABEL_DE[t.zahlungskanal] ?? (t.zahlungskanal || "—"),
      betrag: Math.abs(t.betrag_cents) / 100,
      vorzeichen: signed / 100,
      beschreibung: t.beschreibung || "",
      classification: t.classification,
      quelle: "Manuell",
      sortDatum: t.buchungsdatum.slice(0, 10),
      sortId: t.beleg_nummer || t.id,
    });
  });

  // Deterministisch: datum ASC, beleg/sortId ASC, id ASC
  rows.sort((a, b) => {
    if (a.sortDatum !== b.sortDatum) return a.sortDatum < b.sortDatum ? -1 : 1;
    if (a.beleg !== b.beleg) return a.beleg < b.beleg ? -1 : 1;
    return a.sortId < b.sortId ? -1 : a.sortId > b.sortId ? 1 : 0;
  });

  return rows;
}

function buildBuchungenSheet(rows: ExportRow[]): XLSX.WorkSheet {
  const header = [
    "Buchungsdatum", "Leistungsdatum", "Beleg-Nr", "Typ", "Kategorie", "Konto",
    "Zahlungskanal", "Betrag (€)", "Vorzeichen (€)", "Beschreibung", "Klassifizierung", "Quelle",
  ];
  const aoa: (string | number)[][] = [header];
  rows.forEach((r) => {
    aoa.push([
      r.datum, r.leistungsdatum, r.beleg, r.typ, r.kategorie, r.konto, r.kanal,
      r.betrag, r.vorzeichen, r.beschreibung, r.classification, r.quelle,
    ]);
  });
  return XLSX.utils.aoa_to_sheet(aoa);
}

function buildEURSheet(eur: EURReport): XLSX.WorkSheet {
  const aoa: (string | number)[][] = [];
  aoa.push(["EINNAHMEN", ""]);
  aoa.push(["Kategorie", "Betrag (€)"]);
  eur.einnahmen.forEach((e) => aoa.push([katLabel(e.kategorie), e.cents / 100]));
  aoa.push(["SUMME EINNAHMEN", eur.einnahmen_total_cents / 100]);
  aoa.push(["", ""]);
  aoa.push(["AUSGABEN", ""]);
  aoa.push(["Kategorie", "Betrag (€)"]);
  eur.ausgaben.forEach((a) => aoa.push([katLabel(a.kategorie), a.cents / 100]));
  aoa.push(["SUMME AUSGABEN", eur.ausgaben_total_cents / 100]);
  aoa.push(["", ""]);
  aoa.push(["ÜBERSCHUSS", eur.ueberschuss_cents / 100]);
  return XLSX.utils.aoa_to_sheet(aoa);
}

function buildKassenberichtSheet(k: KassenberichtReport): XLSX.WorkSheet {
  const header = ["Konto", "Anfangsbestand (€)", "Einnahmen (€)", "Ausgaben (€)", "Endbestand (€)"];
  const row = (label: string, b: KontoBlock) => [
    label, b.anfang_cents / 100, b.einnahmen_cents / 100, b.ausgaben_cents / 100, b.ende_cents / 100,
  ];
  const aoa: (string | number)[][] = [
    [`Kassenbericht ${k.year}`, "", "", "", ""],
    header,
    row("Bar/Kasse", k.bar),
    row("Bank", k.bank),
    row("Gesamt", k.gesamt),
  ];
  return XLSX.utils.aoa_to_sheet(aoa);
}

function workbookToBase64(wb: XLSX.WorkBook): string {
  return XLSX.write(wb, { type: "base64", bookType: "xlsx" });
}

export async function exportBuchungenXLSX(mosqueId: string, year: number): Promise<string> {
  await assertFinancePermission(mosqueId, "finance_export");
  const rows = await loadExportRows(mosqueId, year);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildBuchungenSheet(rows), "Buchungen");
  await safeAudit({
    mosqueId, action: "finance.export", entityType: "finance_export", entityId: String(year),
    context: { kind: "buchungen", year, rows: rows.length },
  });
  return workbookToBase64(wb);
}

export async function exportEURXLSX(mosqueId: string, year: number): Promise<string> {
  await assertFinancePermission(mosqueId, "finance_export");
  const atoms = await loadAtomsForYear(mosqueId, year);
  const eur = buildEUR(atoms);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildEURSheet(eur), "EÜR");
  await safeAudit({
    mosqueId, action: "finance.export", entityType: "finance_export", entityId: String(year),
    context: { kind: "eur", year, rows: atoms.length },
  });
  return workbookToBase64(wb);
}

export async function exportKassenberichtXLSX(mosqueId: string, year: number): Promise<string> {
  await assertFinancePermission(mosqueId, "finance_export");
  const k = await getKassenbericht(mosqueId, year);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildKassenberichtSheet(k), "Kassenbericht");
  await safeAudit({
    mosqueId, action: "finance.export", entityType: "finance_export", entityId: String(year),
    context: { kind: "kassenbericht", year, rows: 3 },
  });
  return workbookToBase64(wb);
}

export async function exportKomplettXLSX(mosqueId: string, year: number): Promise<string> {
  await assertFinancePermission(mosqueId, "finance_export");
  const rows = await loadExportRows(mosqueId, year);
  const atoms = await loadAtomsForYear(mosqueId, year);
  const eur = buildEUR(atoms);
  const k = await getKassenbericht(mosqueId, year);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildBuchungenSheet(rows), "Buchungen");
  XLSX.utils.book_append_sheet(wb, buildEURSheet(eur), "EÜR");
  XLSX.utils.book_append_sheet(wb, buildKassenberichtSheet(k), "Kassenbericht");

  await safeAudit({
    mosqueId, action: "finance.export", entityType: "finance_export", entityId: String(year),
    context: { kind: "komplett", year, rows: rows.length },
  });
  return workbookToBase64(wb);
}

// ===========================================================================
// Sprint 6 — KI-Kategorisierung (optional, graceful ohne ANTHROPIC_API_KEY)
// ===========================================================================

/** Ob KI-Vorschlag verfügbar ist (Permission + Key gesetzt). UI-Gating. */
export async function getAiAvailability(mosqueId: string): Promise<{ available: boolean }> {
  await assertFinancePermission(mosqueId, "finance_ai_use");
  return { available: isAiConfigured() };
}

/**
 * Schlägt eine Kategorie für eine manuelle Buchung vor. sanitizeForAI PFLICHT
 * vor dem API-Call. Audit speichert NUR Metadaten (kein Klartext der Beschreibung).
 * Rate-Limit 30/h pro Moschee (in-memory). Ohne Key/Fehler → category=null.
 */
export async function suggestTransactionCategory(
  mosqueId: string,
  beschreibung: string,
  betragCents: number,
  typ: "einnahme" | "ausgabe"
): Promise<{ category: string | null }> {
  await assertFinancePermission(mosqueId, "finance_ai_use");

  if (!isAiConfigured()) return { category: null };

  const rl = checkRateLimit(`ai-suggest:${mosqueId}`, 30, 60 * 60 * 1000);
  if (!rl.allowed) return { category: null };

  const sanitized = sanitizeForAI(beschreibung);
  const result = await suggestCategory(sanitized, betragCents, typ);

  await safeAudit({
    mosqueId, action: "finance.ai_suggest", entityType: "finance_event", entityId: mosqueId,
    context: {
      model: result.model,
      duration_ms: result.durationMs,
      suggested_category: result.category,
      accepted: false,
    },
  });

  return { category: result.category };
}
