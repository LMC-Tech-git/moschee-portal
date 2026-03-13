"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ImagePlus, X } from "lucide-react";
import type { Post } from "@/types";
import type { PostInput } from "@/lib/validations";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface PostFormProps {
  initialData?: Post;
  onSubmit: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
  isEdit?: boolean;
  backPath?: string;
  defaultVisibility?: string;
}

export function PostForm({ initialData, onSubmit, isEdit, backPath = "/admin/posts", defaultVisibility }: PostFormProps) {
  const router = useRouter();
  const tL = useTranslations("labels");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoryOptions = [
    { value: "announcement", label: tL("post.category.announcement") },
    { value: "youth", label: tL("post.category.youth") },
    { value: "campaign", label: tL("post.category.campaign") },
    { value: "event", label: tL("post.category.event") },
    { value: "general", label: tL("post.category.general") },
  ];

  const visibilityOpts = [
    { value: "public", label: tL("visibility.public") },
    { value: "members", label: tL("visibility.members") },
  ];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState(initialData?.title || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [category, setCategory] = useState<PostInput["category"]>(
    initialData?.category || "general"
  );
  const [visibility, setVisibility] = useState<PostInput["visibility"]>(
    initialData?.visibility ?? (defaultVisibility as PostInput["visibility"]) ?? "public"
  );
  const [pinned, setPinned] = useState(initialData?.pinned || false);

  // Wenn defaultVisibility nachgeladen wird (Settings-Fetch in der Elternseite), übernehmen
  useEffect(() => {
    if (!initialData && defaultVisibility) {
      setVisibility(defaultVisibility as PostInput["visibility"]);
    }
  }, [defaultVisibility, initialData]);

  // Existing images (from saved post) — filenames
  const [existingImages, setExistingImages] = useState<string[]>(
    initialData?.attachments || []
  );
  // New images selected by user (not yet uploaded)
  const [newImages, setNewImages] = useState<File[]>([]);
  // Preview URLs for new images
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);

  const pbUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL || "";

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const previews = files.map((f) => URL.createObjectURL(f));
    setNewImages((prev) => [...prev, ...files]);
    setNewImagePreviews((prev) => [...prev, ...previews]);

    // Reset input so same file can be selected again
    e.target.value = "";
  }

  function removeNewImage(index: number) {
    URL.revokeObjectURL(newImagePreviews[index]);
    setNewImages((prev) => prev.filter((_, i) => i !== index));
    setNewImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function removeExistingImage(filename: string) {
    setExistingImages((prev) => prev.filter((f) => f !== filename));
  }

  async function handleSubmit(status: "published" | "draft") {
    setError("");
    setIsSubmitting(true);

    try {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("content", content);
      fd.append("category", category);
      fd.append("visibility", visibility);
      fd.append("pinned", String(pinned));
      fd.append("status", status);

      // Neue Bilder anhängen
      newImages.forEach((file) => fd.append("images", file));

      // Bei Bearbeitung: welche bestehenden Bilder wurden entfernt?
      if (isEdit && initialData?.attachments) {
        initialData.attachments.forEach((filename) => {
          if (!existingImages.includes(filename)) {
            fd.append("removedImages", filename);
          }
        });
      }

      const result = await onSubmit(fd);

      if (result.success) {
        router.push(backPath);
        router.refresh();
      } else {
        setError(result.error || "Ein Fehler ist aufgetreten");
      }
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten");
    } finally {
      setIsSubmitting(false);
    }
  }

  const totalImages = existingImages.length + newImages.length;

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" aria-live="polite" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Titel */}
      <div className="space-y-2">
        <Label htmlFor="title">Titel *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titel des Beitrags"
          required
        />
      </div>

      {/* Inhalt */}
      <div className="space-y-2">
        <Label htmlFor="content">Inhalt *</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Schreiben Sie hier Ihren Beitrag..."
          rows={10}
          required
        />
      </div>

      {/* Kategorie + Sichtbarkeit */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Kategorie</Label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as PostInput["category"])}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="visibility">Sichtbarkeit</Label>
          <select
            id="visibility"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as PostInput["visibility"])}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {visibilityOpts.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Angepinnt */}
      <div className="flex items-center gap-2">
        <input
          id="pinned"
          type="checkbox"
          checked={pinned}
          onChange={(e) => setPinned(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-ring"
        />
        <Label htmlFor="pinned" className="font-normal">
          Beitrag oben anpinnen
        </Label>
      </div>

      {/* Bilder */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>
            Bilder{" "}
            <span className="text-xs font-normal text-gray-400">(max. 10, je max. 10 MB)</span>
          </Label>
          {totalImages < 10 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              Bilder hinzufügen
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {(existingImages.length > 0 || newImages.length > 0) && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {/* Bestehende Bilder */}
            {existingImages.map((filename) => (
              <div key={filename} className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${pbUrl}/api/files/posts/${initialData?.id}/${filename}`}
                  alt={filename}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeExistingImage(filename)}
                  className="absolute right-1 top-1 rounded-full bg-red-600 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  aria-label={`Bild ${filename} entfernen`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {/* Neue (noch nicht hochgeladene) Bilder */}
            {newImagePreviews.map((preview, i) => (
              <div key={preview} className="group relative aspect-square rounded-lg overflow-hidden border border-violet-200 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt={`Neues Bild ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-violet-600/80 py-0.5 text-center text-[10px] text-white">
                  Neu
                </div>
                <button
                  type="button"
                  onClick={() => removeNewImage(i)}
                  className="absolute right-1 top-1 rounded-full bg-red-600 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  aria-label={`Neues Bild ${i + 1} entfernen`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {totalImages === 0 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 py-8 text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors"
          >
            <ImagePlus className="h-8 w-8" />
            <span className="text-sm">Bilder per Klick auswählen</span>
          </button>
        )}
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4">
        <Button
          type="button"
          onClick={() => handleSubmit("published")}
          disabled={isSubmitting || !title || !content}
        >
          {isSubmitting ? "Wird gespeichert..." : isEdit ? "Aktualisieren & Veröffentlichen" : "Veröffentlichen"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleSubmit("draft")}
          disabled={isSubmitting || !title || !content}
        >
          {isEdit ? "Als Entwurf speichern" : "Entwurf speichern"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(backPath)}
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
