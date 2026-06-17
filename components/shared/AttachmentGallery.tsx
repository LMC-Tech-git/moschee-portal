"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import {
  THUMB_SIZES,
  buildFileUrl,
  splitAttachments,
} from "@/lib/attachments";
import type { LightboxItem } from "./AttachmentLightbox";

const AttachmentLightbox = dynamic(() => import("./AttachmentLightbox"), {
  ssr: false,
});

interface AttachmentGalleryProps {
  collection: string;
  recordId: string;
  attachments: string[];
  /** Fallback für Altdaten (events/campaigns mit nur cover_image). */
  coverImageFallback?: string;
  /** Für alt-Texte / Lightbox-Titel. */
  title: string;
}

export function AttachmentGallery({
  collection,
  recordId,
  attachments,
  coverImageFallback,
  title,
}: AttachmentGalleryProps) {
  const t = useTranslations("attachments");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const { images, pdfs } = splitAttachments(attachments || []);
  // Fallback: kein Bild im neuen Feld, aber Alt-Cover vorhanden.
  const imageNames =
    images.length > 0 ? images : coverImageFallback ? [coverImageFallback] : [];

  if (imageNames.length === 0 && pdfs.length === 0) return null;

  const lightboxItems: LightboxItem[] = imageNames.map((name, i) => ({
    src: buildFileUrl(collection, recordId, name),
    alt: `${title} – ${t("imageAlt", { index: i + 1 })}`,
  }));

  return (
    <div className="space-y-4">
      {imageNames.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {imageNames.map((name, i) => (
            <button
              key={name}
              type="button"
              onClick={() => setOpenIndex(i)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={buildFileUrl(collection, recordId, name, THUMB_SIZES.grid)}
                alt={`${title} – ${t("imageAlt", { index: i + 1 })}`}
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            </button>
          ))}
        </div>
      )}

      {pdfs.length > 0 && (
        <ul className="space-y-2">
          {pdfs.map((name) => (
            <li key={name}>
              <a
                href={buildFileUrl(collection, recordId, name)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
              >
                <FileText className="h-4 w-4 shrink-0 text-red-500" />
                <span className="truncate">{name}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {openIndex !== null && lightboxItems.length > 0 && (
        <AttachmentLightbox
          items={lightboxItems}
          startIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  );
}

interface AttachmentThumbProps {
  collection: string;
  recordId: string;
  attachments: string[];
  coverImageFallback?: string;
  title: string;
  className?: string;
}

/**
 * Kompakter Karten-Thumbnail: erstes Bild + `+N`-Badge.
 * Rendert nichts, wenn kein Bild vorhanden ist.
 */
export function AttachmentThumb({
  collection,
  recordId,
  attachments,
  coverImageFallback,
  title,
  className,
}: AttachmentThumbProps) {
  const { images } = splitAttachments(attachments || []);
  const first = images[0] || coverImageFallback;
  if (!first) return null;

  const extra = Math.max(0, images.length - 1);

  return (
    <div className={`relative overflow-hidden rounded-lg bg-gray-100 ${className || ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={buildFileUrl(collection, recordId, first, THUMB_SIZES.card)}
        alt={title}
        loading="lazy"
        className="h-full w-full object-cover"
      />
      {extra > 0 && (
        <div className="absolute bottom-1 right-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          +{extra}
        </div>
      )}
    </div>
  );
}
