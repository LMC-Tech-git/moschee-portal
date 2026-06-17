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
 * Prüft, ob eine Files-FormData echte Änderungen enthält
 * (neue Uploads unter `attachments` oder Entfernungen unter `attachments-`).
 */
export function hasAttachmentChanges(files?: FormData | null): boolean {
  if (!files) return false;
  const added = files
    .getAll("attachments")
    .some((f) => f && typeof f !== "string" && (f as File).size > 0);
  const removed = files.getAll("attachments-").some((n) => !!n);
  return added || removed;
}

/**
 * Baut eine PocketBase-FormData aus validierten Skalar-Feldern plus den
 * Datei-Operationen aus `files` (neue `attachments` + zu löschende
 * `attachments-`). Für create/update von Records mit Datei-Uploads.
 * `undefined`/`null` werden übersprungen, Objekte/Arrays als JSON serialisiert.
 */
export function buildRecordFormData(
  fields: Record<string, unknown>,
  files?: FormData | null
): FormData {
  const fd = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (value instanceof Date) fd.append(key, value.toISOString());
    else if (typeof value === "object") fd.append(key, JSON.stringify(value));
    else fd.append(key, String(value));
  });
  if (files) {
    files.getAll("attachments").forEach((f) => {
      if (f && typeof f !== "string" && (f as File).size > 0) {
        fd.append("attachments", f as Blob, (f as File).name || "file");
      }
    });
    files.getAll("attachments-").forEach((name) => {
      if (name) fd.append("attachments-", name as string);
    });
  }
  return fd;
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
