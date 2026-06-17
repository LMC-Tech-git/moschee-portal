"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, X, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  ACCEPT_ATTACHMENTS,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  THUMB_SIZES,
  buildFileUrl,
  isImage,
} from "@/lib/attachments";

/**
 * Zustand der Anhang-Auswahl. Wird vom Eltern-Formular gehalten und beim
 * Speichern via {@link attachmentsToFormData} in eine FormData übersetzt.
 */
export interface AttachmentState {
  /** Verbleibende Bestands-Dateinamen (nach evtl. Entfernungen). */
  existing: string[];
  /** Entfernte Bestands-Dateinamen (PB löscht diese via `attachments-`). */
  removed: string[];
  /** Neu hinzugefügte, noch nicht hochgeladene Dateien. */
  newFiles: File[];
}

export function emptyAttachmentState(existing: string[] = []): AttachmentState {
  return { existing: [...existing], removed: [], newFiles: [] };
}

/** Baut die Files-FormData (`attachments` + `attachments-`) für Server Actions. */
export function attachmentsToFormData(state: AttachmentState): FormData {
  const fd = new FormData();
  state.newFiles.forEach((file) => fd.append("attachments", file, file.name));
  state.removed.forEach((name) => fd.append("attachments-", name));
  return fd;
}

interface AttachmentUploaderProps {
  collection: string;
  recordId?: string;
  value: AttachmentState;
  onChange: (next: AttachmentState) => void;
  disabled?: boolean;
}

export function AttachmentUploader({
  collection,
  recordId,
  value,
  onChange,
  disabled,
}: AttachmentUploaderProps) {
  const t = useTranslations("attachments");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  // Preview-URLs für neue Bilder; sauber wieder freigeben.
  const previews = useMemo(
    () =>
      value.newFiles.map((f) =>
        f.type.startsWith("image/") ? URL.createObjectURL(f) : ""
      ),
    [value.newFiles]
  );
  useEffect(() => {
    return () => previews.forEach((url) => url && URL.revokeObjectURL(url));
  }, [previews]);

  const total = value.existing.length + value.newFiles.length;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // gleiche Datei erneut wählbar
    if (!files.length) return;

    const accepted: File[] = [];
    for (const f of files) {
      if (f.size > MAX_ATTACHMENT_BYTES) {
        setError(t("tooLarge"));
        continue;
      }
      if (total + accepted.length >= MAX_ATTACHMENTS) {
        setError(t("tooManyFiles", { max: MAX_ATTACHMENTS }));
        break;
      }
      accepted.push(f);
    }
    if (accepted.length) {
      onChange({ ...value, newFiles: [...value.newFiles, ...accepted] });
    }
  }

  function removeNewFile(index: number) {
    onChange({
      ...value,
      newFiles: value.newFiles.filter((_, i) => i !== index),
    });
  }

  function removeExisting(filename: string) {
    onChange({
      ...value,
      existing: value.existing.filter((f) => f !== filename),
      removed: [...value.removed, filename],
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>
          {t("label")}{" "}
          <span className="text-xs font-normal text-gray-400">{t("hint")}</span>
        </Label>
        {!disabled && total < MAX_ATTACHMENTS && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {t("add")}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ATTACHMENTS}
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      {total > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {/* Bestehende Anhänge */}
          {value.existing.map((filename) => (
            <PreviewTile
              key={filename}
              isImg={isImage(filename)}
              src={
                recordId
                  ? buildFileUrl(collection, recordId, filename, THUMB_SIZES.grid)
                  : ""
              }
              name={filename}
              onRemove={disabled ? undefined : () => removeExisting(filename)}
              removeLabel={t("removeAria", { name: filename })}
            />
          ))}

          {/* Neue Anhänge */}
          {value.newFiles.map((file, i) => (
            <PreviewTile
              key={`${file.name}-${i}`}
              isImg={file.type.startsWith("image/")}
              src={previews[i]}
              name={file.name}
              badge={t("newBadge")}
              onRemove={disabled ? undefined : () => removeNewFile(i)}
              removeLabel={t("removeAria", { name: file.name })}
            />
          ))}
        </div>
      )}

      {total === 0 && !disabled && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 py-8 text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-500"
        >
          <ImagePlus className="h-8 w-8" />
          <span className="text-sm">{t("select")}</span>
        </button>
      )}
    </div>
  );
}

interface PreviewTileProps {
  isImg: boolean;
  src: string;
  name: string;
  badge?: string;
  onRemove?: () => void;
  removeLabel: string;
}

function PreviewTile({ isImg, src, name, badge, onRemove, removeLabel }: PreviewTileProps) {
  return (
    <div
      className={`group relative aspect-square overflow-hidden rounded-lg border bg-gray-50 ${
        badge ? "border-violet-200" : "border-gray-200"
      }`}
    >
      {isImg && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
          <FileText className="h-7 w-7 text-gray-400" />
          <span className="line-clamp-2 break-all text-[10px] text-gray-500">{name}</span>
        </div>
      )}
      {badge && (
        <div className="absolute inset-x-0 bottom-0 bg-violet-600/80 py-0.5 text-center text-[10px] text-white">
          {badge}
        </div>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1 top-1 rounded-full bg-red-600 p-0.5 text-white opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
          aria-label={removeLabel}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
