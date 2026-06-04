/**
 * KI-Kategorievorschlag via Anthropic Messages API (Sprint 6).
 *
 * KEIN "use server" — async-Helper, aus Server-Actions importiert.
 *
 * Graceful: ohne ANTHROPIC_API_KEY, bei jedem Fehler/Timeout → null.
 * KI ist NUR Vorschlag, nie buchhaltungskritisch.
 */

import {
  FINANCE_INCOME_CATEGORY_IDS,
  FINANCE_EXPENSE_CATEGORY_IDS,
  FINANCE_CATEGORY_VALUES,
} from "@/lib/constants";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const PRIMARY_MODEL = "claude-haiku-4-5";
const FALLBACK_MODEL = "claude-3-5-haiku-latest";
const TIMEOUT_MS = 5000;

/** True wenn ANTHROPIC_API_KEY gesetzt (Server-Env). */
export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const VALID_CATEGORY_SET = new Set<string>(FINANCE_CATEGORY_VALUES);

export type SuggestResult = {
  category: string | null;
  model: string;
  durationMs: number;
};

function buildSystemPrompt(typ: "einnahme" | "ausgabe"): string {
  const ids = typ === "einnahme" ? FINANCE_INCOME_CATEGORY_IDS : FINANCE_EXPENSE_CATEGORY_IDS;
  return (
    "Du bist ein Buchhaltungs-Klassifizierer für eine Moschee-Gemeinde. " +
    `Ordne die Buchung GENAU EINER dieser Kategorie-IDs zu (${typ}): ` +
    ids.join(", ") +
    ". Antworte AUSSCHLIESSLICH mit der Kategorie-ID. Keine Erklärung, kein Satz, kein Punkt."
  );
}

async function callAnthropic(
  model: string,
  apiKey: string,
  system: string,
  userText: string
): Promise<{ status: number; text: string | null }> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 20,
      temperature: 0,
      system,
      messages: [{ role: "user", content: userText }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return { status: res.status, text: null };
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((c) => c.type === "text")?.text ?? null;
  return { status: res.status, text };
}

/** Extrahiert die erste gültige Kategorie-ID aus dem Modelltext. */
function extractCategory(text: string | null, typ: "einnahme" | "ausgabe"): string | null {
  if (!text) return null;
  const allowed = typ === "einnahme" ? FINANCE_INCOME_CATEGORY_IDS : FINANCE_EXPENSE_CATEGORY_IDS;
  const lower = text.toLowerCase();
  for (const id of allowed) {
    if (lower.includes(id)) return id;
  }
  // Fallback: irgendeine gültige ID (falls Modell income/expense vertauscht)
  for (const id of FINANCE_CATEGORY_VALUES) {
    if (VALID_CATEGORY_SET.has(id) && lower.includes(id)) return id;
  }
  return null;
}

/**
 * Schlägt eine Kategorie vor. `sanitizedText` MUSS vorher durch sanitizeForAI.
 * Ohne Key / bei Fehler / Timeout → category=null (graceful).
 */
export async function suggestCategory(
  sanitizedText: string,
  betragCents: number,
  typ: "einnahme" | "ausgabe"
): Promise<SuggestResult> {
  const start = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { category: null, model: "none", durationMs: 0 };

  const system = buildSystemPrompt(typ);
  const userText = `Betrag: ${(betragCents / 100).toFixed(2)} EUR. Beschreibung: ${sanitizedText}`;

  let usedModel = PRIMARY_MODEL;
  try {
    let resp = await callAnthropic(PRIMARY_MODEL, apiKey, system, userText);
    // Modell nicht gefunden → Fallback-Modell
    if (resp.status === 404) {
      usedModel = FALLBACK_MODEL;
      resp = await callAnthropic(FALLBACK_MODEL, apiKey, system, userText);
    }
    const category = extractCategory(resp.text, typ);
    return { category, model: usedModel, durationMs: Date.now() - start };
  } catch {
    // Netzwerk / Timeout / Abort → graceful null
    return { category: null, model: usedModel, durationMs: Date.now() - start };
  }
}
