/**
 * Unit-Test sanitizeForAI (Sprint 6). Kein PB, kein Key nötig.
 *
 * Lauf: npx tsx scripts/test-ai-sanitize.mts
 */

import { sanitizeForAI } from "@/lib/ai/sanitize";

let failures = 0;
function ok(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ✅ ${label}`);
  } else {
    console.error(`  ❌ ${label}`);
    failures++;
  }
}

console.log("=== test-ai-sanitize ===\n");

// E-Mail
{
  const out = sanitizeForAI("Spende von ahmed.test@example.com erhalten");
  ok(out.includes("[EMAIL]") && !out.includes("@example.com"), `Email maskiert: "${out}"`);
}

// Telefon +49
{
  const out = sanitizeForAI("Rückruf unter +49 170 1234567 vereinbart");
  ok(out.includes("[PHONE]") && !/\d{6,}/.test(out), `Tel +49 maskiert: "${out}"`);
}

// Telefon 0…
{
  const out = sanitizeForAI("Tel 0171-2345678 Reparatur");
  ok(out.includes("[PHONE]"), `Tel 0… maskiert: "${out}"`);
}

// IBAN
{
  const out = sanitizeForAI("Überweisung DE89 3704 0044 0532 0130 00 Miete");
  ok(out.includes("[IBAN]") && !out.includes("3704"), `IBAN maskiert: "${out}"`);
}

// Name
{
  const out = sanitizeForAI("Barspende von Mehmet bei Freitagsgebet");
  ok(out.includes("[NAME]") && !out.includes("Mehmet"), `Name maskiert: "${out}"`);
}

// Kombi
{
  const out = sanitizeForAI("Ali zahlte per IBAN DE89370400440532013000, Mail ali@x.de, Tel 017012345678");
  ok(
    out.includes("[NAME]") && out.includes("[IBAN]") && out.includes("[EMAIL]") && out.includes("[PHONE]"),
    `Kombi alle 4 maskiert: "${out}"`
  );
}

// KEIN False-Positive auf Kategorie-Namen
{
  const out = sanitizeForAI("Miete Gebetsraum, Nebenkosten Strom, Spenden Freitagsgebet");
  ok(
    out.includes("Miete") && out.includes("Nebenkosten") && out.includes("Spenden") && !out.includes("[NAME]"),
    `Kategorie-Namen unberührt: "${out}"`
  );
}

// Leer
{
  ok(sanitizeForAI("") === "", "Leerstring → leer");
}

console.log("");
if (failures > 0) {
  console.error(`❌ ${failures} Test(s) fehlgeschlagen.`);
  process.exit(1);
}
console.log("✅ Alle sanitize-Tests grün.");
process.exit(0);
