/**
 * Gemeinsame Helfer für Datei-Anhänge (Bilder + PDFs) von
 * Events, Beiträgen und Kampagnen.
 *
 * PB file-Felder heißen überall `attachments` (Mehrfach-Datei).
 * Anzeige nutzt server-seitige Thumbnails (`?thumb=WxH`) — die Größen
 * müssen in der Collection als `thumbs` registriert sein (alte PB < 0.23
 * generiert nur registrierte Größen), siehe scripts/migrate-attachments.mjs.
 */

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || "";

/** Maximale Anzahl Anhänge pro Datensatz (Bilder + PDFs zusammen). */
export const MAX_ATTACHMENTS = 10;

/** Maximale Dateigröße je Anhang (10 MB). */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** accept-Attribut für File-Inputs (nur Hint — Schutz via PB mimeTypes). */
export const ACCEPT_ATTACHMENTS =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf";

/**
 * In der Collection registrierte Thumbnail-Größen.
 * MUSS synchron zu `thumbs` in scripts/migrate-attachments.mjs bleiben,
 * sonst liefert PB still das Original statt eines Thumbnails.
 */
export const THUMB_SIZES = {
  /** Quadratischer Karten-Thumbnail (crop). */
  card: "100x100",
  /** Galerie-Grid (Höhe 300, Breite proportional). */
  grid: "0x300",
} as const;

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "avif", "svg"];
const PDF_EXTENSIONS = ["pdf"];

function extension(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
}

export function isImage(filename: string): boolean {
  return IMAGE_EXTENSIONS.includes(extension(filename));
}

export function isPdf(filename: string): boolean {
  return PDF_EXTENSIONS.includes(extension(filename));
}

/**
 * Baut die PocketBase-Datei-URL.
 * `thumb` nur bei Bildern setzen (PDFs ignorieren es ohnehin).
 */
export function buildFileUrl(
  collection: string,
  recordId: string,
  filename: string,
  thumb?: string
): string {
  const base = `${PB_URL}/api/files/${collection}/${recordId}/${filename}`;
  if (thumb && isImage(filename)) {
    return `${base}?thumb=${thumb}`;
  }
  return base;
}

/**
 * Prüft, ob eine Files-FormData überhaupt Anhang-Eingaben enthält
 * (neue Uploads oder eine Reihenfolge-Angabe). Wenn nicht, kann die
 * Attachment-Verarbeitung komplett übersprungen werden.
 */
export function hasAttachmentInput(files?: FormData | null): boolean {
  if (!files) return false;
  return files.getAll("attachments").length > 0 || files.getAll("order").length > 0;
}

type PBLike<T> = {
  collection: (name: string) => {
    update: (id: string, data: FormData | Record<string, unknown>) => Promise<T>;
  };
};

/**
 * Wendet Anhang-Änderungen inkl. benutzerdefinierter Reihenfolge auf einen
 * bereits existierenden Record an (Skalare müssen vorher gespeichert sein).
 *
 * Contract aus dem Client (attachmentsToFormData):
 *   - `attachments`: neue Dateien in gewünschter Reihenfolge
 *   - `order`: Tokens für die Endreihenfolge — "E:<dateiname>" (Bestand) | "N" (nächste neue Datei)
 *   Weggelassene Bestands-Dateien werden gelöscht.
 *
 * Zwei Phasen, da PB neue Uploads immer ans Ende hängt und ihren finalen
 * Dateinamen erst danach kennt:
 *   1. neue Dateien hochladen + entfernte löschen
 *   2. Endreihenfolge per JSON-Update setzen
 */
export async function applyAttachments<T extends { id: string; attachments?: string[] }>(
  pb: PBLike<T>,
  collection: string,
  record: T,
  files: FormData
): Promise<T> {
  const existing: string[] = record.attachments || [];
  const orderTokens = (files.getAll("order") as string[]).map((t) => String(t));
  const newFiles = files
    .getAll("attachments")
    .filter((f) => f && typeof f !== "string" && (f as File).size > 0) as File[];

  // Welche Bestands-Dateien bleiben (laut order) → Rest wird gelöscht.
  const keptExisting = orderTokens
    .filter((t) => t.startsWith("E:"))
    .map((t) => t.slice(2))
    .filter((n) => existing.includes(n));
  const removed = existing.filter((n) => !keptExisting.includes(n));

  let current: T = record;

  // Phase 1: hochladen + löschen
  if (newFiles.length > 0 || removed.length > 0) {
    const fd = new FormData();
    newFiles.forEach((f) => fd.append("attachments", f, f.name));
    removed.forEach((n) => fd.append("attachments-", n));
    current = await pb.collection(collection).update(record.id, fd);
  }

  // Phase 2: Endreihenfolge bestimmen + setzen
  if (orderTokens.length > 0) {
    const afterUpload = current.attachments || [];
    const newNames = afterUpload.filter((n) => !existing.includes(n)); // neue in Upload-Reihenfolge
    let ni = 0;
    const finalOrder = orderTokens
      .map((t) => (t === "N" ? newNames[ni++] : t.slice(2)))
      .filter((n): n is string => !!n);

    if (finalOrder.length > 0 && finalOrder.join("\n") !== afterUpload.join("\n")) {
      current = await pb.collection(collection).update(record.id, { attachments: finalOrder });
    }
  }

  return current;
}

/** Teilt Dateinamen in Bilder und PDFs (Reihenfolge bleibt erhalten). */
export function splitAttachments(filenames: string[]): {
  images: string[];
  pdfs: string[];
} {
  const images: string[] = [];
  const pdfs: string[] = [];
  filenames.forEach((name) => {
    if (isImage(name)) images.push(name);
    else if (isPdf(name)) pdfs.push(name);
  });
  return { images, pdfs };
}
