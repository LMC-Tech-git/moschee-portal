"use client";

import { useState, useRef } from "react";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { importStudentsBulk } from "@/lib/actions/students";
import type { ImportStudentRow, ImportStudentsResult } from "@/lib/actions/students";
import { cn } from "@/lib/utils";

// ─── Column patterns for auto-detection ──────────────────────────────────────

const COL_PATTERNS = {
  first_name: ["vorname", "firstname", "first_name", "givenname", "vname"],
  last_name: ["nachname", "lastname", "last_name", "surname", "familienname", "nname"],
  date_of_birth: ["geburtstag", "geburtsdatum", "dateofbirth", "date_of_birth", "dob", "geb"],
  gender: ["geschlecht", "gender", "sex"],
  parent_name: ["elternname", "eltern_name", "parentname", "parent_name", "elternteil", "eltern"],
  parent_phone: ["telefon", "phone", "parent_phone", "tel", "handy", "mobilnummer"],
  notes: ["notizen", "notes", "anmerkungen", "bemerkungen", "hinweise"],
} as const;

type ColKey = keyof typeof COL_PATTERNS;

function findColIndex(headers: string[], key: ColKey): number {
  const patterns = COL_PATTERNS[key];
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] || "").toLowerCase().replace(/[\s_-]/g, "");
    for (const p of patterns) {
      if (h === p.replace(/[\s_-]/g, "")) return i;
    }
  }
  return -1;
}

// ─── Date normalization ───────────────────────────────────────────────────────

function normalizeDate(value: unknown): string {
  if (!value) return "";
  const str = String(value).trim();
  if (!str) return "";
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // DD.MM.YYYY
  const deMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (deMatch) {
    return `${deMatch[3]}-${deMatch[2].padStart(2, "0")}-${deMatch[1].padStart(2, "0")}`;
  }
  // DD/MM/YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[1].padStart(2, "0")}`;
  }
  return str;
}

// ─── Gender normalization ────────────────────────────────────────────────────

function normalizeGender(value: unknown): string {
  if (!value) return "";
  const v = String(value).toLowerCase().trim();
  if (["m", "male", "männlich", "mann", "junge", "knabe"].includes(v)) return "male";
  if (["w", "f", "female", "weiblich", "frau", "mädchen", "girl"].includes(v)) return "female";
  return "";
}

// ─── CSV Template download ───────────────────────────────────────────────────

const CSV_TEMPLATE =
  "Vorname,Nachname,Geburtstag,Geschlecht,Eltern_Name,Telefon,Notizen\n" +
  "Max,Mustermann,15.03.2010,m,Erika Mustermann,+49 731 123456,\n";

function downloadTemplate() {
  const blob = new Blob(["\uFEFF" + CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "schueler-vorlage.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ParsedRow extends ImportStudentRow {
  _rowNum: number;
  _warn?: string;
}

type Step = "upload" | "preview" | "result";

// ─── Component ───────────────────────────────────────────────────────────────

interface StudentImportDialogProps {
  open: boolean;
  onClose: () => void;
  mosqueId: string;
  courseId?: string | null;
  courseTitle?: string;
  onSuccess: () => void;
}

export function StudentImportDialog({
  open,
  onClose,
  mosqueId,
  courseId = null,
  courseTitle,
  onSuccess,
}: StudentImportDialogProps) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportStudentsResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function reset() {
    setStep("upload");
    setFileName("");
    setRows([]);
    setParseError("");
    setResult(null);
    setIsImporting(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function parseFile(file: File) {
    setParseError("");
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: false,
        dateNF: "yyyy-mm-dd",
      });

      if (!raw || raw.length < 2) {
        setParseError(
          "Die Datei enthält keine Daten. Mindestens eine Kopfzeile und eine Datenzeile werden benötigt."
        );
        return;
      }

      const headers = (raw[0] as unknown[]).map((h) => String(h ?? "").trim());

      const colIdx: Record<ColKey, number> = {
        first_name: findColIndex(headers, "first_name"),
        last_name: findColIndex(headers, "last_name"),
        date_of_birth: findColIndex(headers, "date_of_birth"),
        gender: findColIndex(headers, "gender"),
        parent_name: findColIndex(headers, "parent_name"),
        parent_phone: findColIndex(headers, "parent_phone"),
        notes: findColIndex(headers, "notes"),
      };

      if (colIdx.first_name === -1 || colIdx.last_name === -1) {
        setParseError(
          `Spalten "Vorname" und "Nachname" konnten nicht gefunden werden.\n` +
            `Erkannte Spalten: ${headers.filter(Boolean).join(", ")}.\n` +
            `Bitte verwenden Sie die Vorlage.`
        );
        return;
      }

      const parsed: ParsedRow[] = [];
      for (let i = 1; i < raw.length; i++) {
        const rowArr = raw[i] as unknown[];
        const get = (idx: number): string => {
          if (idx === -1 || idx >= rowArr.length) return "";
          return String(rowArr[idx] ?? "").trim();
        };

        const firstName = get(colIdx.first_name);
        const lastName = get(colIdx.last_name);
        if (!firstName && !lastName) continue; // skip empty rows

        const rawDob = colIdx.date_of_birth >= 0 ? rowArr[colIdx.date_of_birth] : "";
        const dob = normalizeDate(rawDob);

        parsed.push({
          _rowNum: i + 1,
          _warn: !dob ? "Geburtstag fehlt oder unbekanntes Format" : undefined,
          first_name: firstName,
          last_name: lastName,
          date_of_birth: dob,
          gender: normalizeGender(get(colIdx.gender)),
          parent_name: get(colIdx.parent_name),
          parent_phone: get(colIdx.parent_phone),
          notes: get(colIdx.notes),
        });
      }

      if (parsed.length === 0) {
        setParseError("Keine Datenzeilen gefunden.");
        return;
      }

      setRows(parsed);
      setStep("preview");
    } catch (err: unknown) {
      console.error(err);
      setParseError(
        "Datei konnte nicht gelesen werden. Bitte stellen Sie sicher, dass es sich um eine gültige CSV- oder Excel-Datei handelt."
      );
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  }

  async function handleImport() {
    if (!user || rows.length === 0) return;
    setIsImporting(true);

    const cleanRows: ImportStudentRow[] = rows
      .filter((r) => !r._warn || r.date_of_birth)
      .map((r) => ({
        first_name: r.first_name,
        last_name: r.last_name,
        date_of_birth: r.date_of_birth,
        gender: r.gender,
        parent_name: r.parent_name,
        parent_phone: r.parent_phone,
        notes: r.notes,
      }));

    const actionResult = await importStudentsBulk(mosqueId, user.id, courseId, cleanRows);

    if (actionResult.success && actionResult.data) {
      setResult(actionResult.data);
      setStep("result");
      onSuccess();
    } else {
      setParseError(actionResult.error || "Import fehlgeschlagen");
      setIsImporting(false);
    }
    setIsImporting(false);
  }

  const validRowCount = rows.filter((r) => !r._warn || r.date_of_birth).length;
  const warnRowCount = rows.filter((r) => r._warn).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Schüler importieren
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {courseTitle
                ? <>Importieren Sie Schüler aus einer CSV- oder Excel-Datei in den Kurs{" "}<strong>&quot;{courseTitle}&quot;</strong>.</>
                : "Importieren Sie Schüler aus einer CSV- oder Excel-Datei in die Schülerliste."}
            </p>

            {/* Dropzone */}
            <div
              className={cn(
                "cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                isDragging
                  ? "border-emerald-400 bg-emerald-50"
                  : "border-gray-300 hover:border-emerald-400 hover:bg-emerald-50/30"
              )}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
              }}
              aria-label="Datei hochladen"
            >
              <Upload className="mx-auto mb-3 h-10 w-10 text-gray-400" />
              <p className="font-medium text-gray-700">Datei hierher ziehen oder klicken</p>
              <p className="mt-1 text-sm text-gray-500">
                Unterstützte Formate: .csv, .xlsx, .xls
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {parseError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="whitespace-pre-line">{parseError}</span>
              </div>
            )}

            {/* Template download */}
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
              <Download className="h-4 w-4 shrink-0 text-gray-500" />
              <span className="text-sm text-gray-600">Noch keine Vorlage?&nbsp;</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadTemplate();
                }}
                className="text-sm font-medium text-emerald-600 hover:underline"
              >
                CSV-Vorlage herunterladen
              </button>
            </div>

            {/* Column hints */}
            <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
              <p className="mb-1 font-medium">Erwartete Spalten:</p>
              <p>
                <span className="font-medium">Pflicht:</span> Vorname, Nachname, Geburtstag
              </p>
              <p>
                <span className="font-medium">Optional:</span> Geschlecht (m/w), Eltern_Name,
                Telefon, Notizen
              </p>
              <p className="mt-1">Datumsformat: TT.MM.JJJJ oder JJJJ-MM-TT</p>
            </div>
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <span className="font-medium text-gray-800">
                  {rows.length} {rows.length === 1 ? "Schüler" : "Schüler"} erkannt
                </span>
                <span className="truncate text-gray-500">aus {fileName}</span>
              </div>
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
              >
                <X className="h-3.5 w-3.5" />
                Datei wechseln
              </button>
            </div>

            {warnRowCount > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {warnRowCount} {warnRowCount === 1 ? "Zeile hat" : "Zeilen haben"} fehlende
                  Daten und {warnRowCount === 1 ? "wird" : "werden"} übersprungen.
                </span>
              </div>
            )}

            {/* Preview Table */}
            <div className="max-h-64 overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b text-left font-medium text-gray-500">
                    <th className="px-3 py-2">Vorname</th>
                    <th className="px-3 py-2">Nachname</th>
                    <th className="px-3 py-2">Geburtstag</th>
                    <th className="hidden px-3 py-2 sm:table-cell">Geschlecht</th>
                    <th className="hidden px-3 py-2 md:table-cell">Eltern</th>
                    <th className="w-6 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => (
                    <tr
                      key={row._rowNum}
                      className={row._warn ? "bg-amber-50" : "bg-white hover:bg-gray-50"}
                    >
                      <td className="px-3 py-2 font-medium">{row.first_name || "—"}</td>
                      <td className="px-3 py-2">{row.last_name || "—"}</td>
                      <td className="px-3 py-2">
                        {row.date_of_birth ? (
                          row.date_of_birth
                        ) : (
                          <span className="text-red-500">fehlt</span>
                        )}
                      </td>
                      <td className="hidden px-3 py-2 text-gray-500 sm:table-cell">
                        {row.gender === "male" ? "M" : row.gender === "female" ? "W" : "—"}
                      </td>
                      <td className="hidden max-w-[120px] truncate px-3 py-2 text-gray-500 md:table-cell">
                        {row.parent_name || "—"}
                      </td>
                      <td className="px-2 py-2">
                        {row._warn && (
                          <span title={row._warn}>
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.length > 8 && (
              <p className="text-center text-xs text-gray-400">
                {rows.length} Einträge werden importiert
              </p>
            )}

            <div className="flex items-center gap-3 border-t pt-4">
              <Button onClick={handleImport} disabled={isImporting || validRowCount === 0}>
                {isImporting ? (
                  <>
                    <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />
                    Importiere…
                  </>
                ) : (
                  `${validRowCount} ${validRowCount === 1 ? "Schüler" : "Schüler"} importieren`
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  reset();
                  onClose();
                }}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Result ── */}
        {step === "result" && result && (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 p-5 text-center">
              <CheckCircle className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
              <p className="text-lg font-semibold text-emerald-800">Import abgeschlossen</p>
              <div className="mt-3 flex justify-center gap-8 text-sm">
                <div>
                  <p className="text-2xl font-bold tabular-nums text-emerald-700">
                    {result.created}
                  </p>
                  <p className="text-emerald-600">Schüler erstellt</p>
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums text-emerald-700">
                    {result.enrolled}
                  </p>
                  <p className="text-emerald-600">Eingeschrieben</p>
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-800">
                  <AlertCircle className="h-4 w-4" />
                  {result.errors.length} Fehler beim Import
                </p>
                <ul className="max-h-40 space-y-0.5 overflow-auto">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-xs text-amber-700">
                      • {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border-t pt-4">
              <Button
                onClick={() => {
                  reset();
                  onClose();
                }}
              >
                Fertig
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
