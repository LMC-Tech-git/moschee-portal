"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, X, FileText, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
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
 * Ein Anhang in der sortierbaren Liste — entweder eine bereits gespeicherte
 * Datei (`name`) oder eine neu ausgewählte, noch nicht hochgeladene (`file`).
 */
export interface AttachmentItem {
  id: string;
  name?: string;
  file?: File;
}

/**
 * Zustand der Anhang-Auswahl: eine geordnete Liste. Die Reihenfolge in `items`
 * ist die gewünschte Endreihenfolge und wird beim Speichern übernommen.
 */
export interface AttachmentState {
  items: AttachmentItem[];
}

export function emptyAttachmentState(existing: string[] = []): AttachmentState {
  return { items: existing.map((name) => ({ id: `e:${name}`, name })) };
}

/**
 * Übersetzt den Zustand in eine FormData für die Server Actions:
 *   - `order`: Token je Position — "E:<dateiname>" (Bestand) | "N" (nächste neue Datei)
 *   - `attachments`: neue Dateien in Reihenfolge ihrer "N"-Tokens
 * Weggelassene Bestands-Dateien werden serverseitig gelöscht.
 */
export function attachmentsToFormData(state: AttachmentState): FormData {
  const fd = new FormData();
  state.items.forEach((it) => {
    if (it.file) {
      fd.append("order", "N");
      fd.append("attachments", it.file, it.file.name);
    } else if (it.name) {
      fd.append("order", `E:${it.name}`);
    }
  });
  return fd;
}

interface AttachmentUploaderProps {
  collection: string;
  recordId?: string;
  value: AttachmentState;
  onChange: (next: AttachmentState) => void;
  disabled?: boolean;
}

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `n:${Date.now()}:${idCounter}`;
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
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const items = value.items;
  const total = items.length;

  // Preview-URLs für neue Bilder (key = item.id), sauber freigeben.
  const previews = useMemo(() => {
    const map: Record<string, string> = {};
    items.forEach((it) => {
      if (it.file && it.file.type.startsWith("image/")) {
        map[it.id] = URL.createObjectURL(it.file);
      }
    });
    return map;
  }, [items]);
  useEffect(() => {
    return () => Object.values(previews).forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;

    const added: AttachmentItem[] = [];
    for (const f of files) {
      if (f.size > MAX_ATTACHMENT_BYTES) {
        setError(t("tooLarge"));
        continue;
      }
      if (total + added.length >= MAX_ATTACHMENTS) {
        setError(t("tooManyFiles", { max: MAX_ATTACHMENTS }));
        break;
      }
      added.push({ id: nextId(), file: f });
    }
    if (added.length) onChange({ items: [...items, ...added] });
  }

  function removeAt(index: number) {
    onChange({ items: items.filter((_, i) => i !== index) });
  }

  function moveItem(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange({ items: next });
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
        <>
          {total > 1 && <p className="text-xs text-gray-400">{t("reorderHint")}</p>}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {items.map((it, i) => {
              const isImg = it.file
                ? it.file.type.startsWith("image/")
                : it.name
                ? isImage(it.name)
                : false;
              const src = it.file
                ? previews[it.id] || ""
                : it.name && recordId
                ? buildFileUrl(collection, recordId, it.name, THUMB_SIZES.grid)
                : "";
              const label = it.name || it.file?.name || "";
              return (
                <PreviewTile
                  key={it.id}
                  index={i}
                  total={total}
                  isImg={isImg}
                  src={src}
                  name={label}
                  badge={it.file ? t("newBadge") : undefined}
                  disabled={disabled}
                  isDragging={dragIndex === i}
                  onRemove={() => removeAt(i)}
                  onMovePrev={() => moveItem(i, i - 1)}
                  onMoveNext={() => moveItem(i, i + 1)}
                  onDragStart={() => setDragIndex(i)}
                  onDragEnd={() => setDragIndex(null)}
                  onDropOn={() => {
                    if (dragIndex !== null) moveItem(dragIndex, i);
                    setDragIndex(null);
                  }}
                  t={t}
                />
              );
            })}
          </div>
        </>
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
  index: number;
  total: number;
  isImg: boolean;
  src: string;
  name: string;
  badge?: string;
  disabled?: boolean;
  isDragging: boolean;
  onRemove: () => void;
  onMovePrev: () => void;
  onMoveNext: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropOn: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

function PreviewTile({
  index,
  total,
  isImg,
  src,
  name,
  badge,
  disabled,
  isDragging,
  onRemove,
  onMovePrev,
  onMoveNext,
  onDragStart,
  onDragEnd,
  onDropOn,
  t,
}: PreviewTileProps) {
  return (
    <div
      draggable={!disabled && total > 1}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDropOn();
      }}
      className={`group relative aspect-square overflow-hidden rounded-lg border bg-gray-50 ${
        badge ? "border-violet-200" : "border-gray-200"
      } ${isDragging ? "opacity-40" : ""} ${!disabled && total > 1 ? "cursor-move" : ""}`}
    >
      {isImg && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
          <FileText className="h-7 w-7 text-gray-400" />
          <span className="line-clamp-2 break-all text-[10px] text-gray-500">{name}</span>
        </div>
      )}

      {/* Positionsnummer */}
      <div className="absolute left-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/60 px-1 text-[10px] font-medium text-white">
        {index + 1}
      </div>

      {badge && (
        <div className="absolute inset-x-0 top-0 bg-violet-600/80 py-0.5 text-center text-[10px] text-white">
          {badge}
        </div>
      )}

      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1 top-1 rounded-full bg-red-600 p-0.5 text-white opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
          aria-label={t("removeAria", { name })}
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Sortier-Steuerung (Touch/A11y); Drag zusätzlich für Desktop */}
      {!disabled && total > 1 && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/55 px-1 py-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={onMovePrev}
            disabled={index === 0}
            aria-label={t("moveLeft")}
            className="rounded p-0.5 text-white disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <GripVertical className="h-3.5 w-3.5 text-white/70" />
          <button
            type="button"
            onClick={onMoveNext}
            disabled={index === total - 1}
            aria-label={t("moveRight")}
            className="rounded p-0.5 text-white disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
