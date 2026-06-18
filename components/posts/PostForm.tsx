"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Post } from "@/types";
import type { PostInput } from "@/lib/validations";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  AttachmentUploader,
  attachmentsToFormData,
  emptyAttachmentState,
  type AttachmentState,
} from "@/components/shared/AttachmentUploader";

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
  const tP = useTranslations("posts.form");
  const tCommon = useTranslations("common");
  const tPush = useTranslations("push");

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
  const [notifyPush, setNotifyPush] = useState(false);

  // Wenn defaultVisibility nachgeladen wird (Settings-Fetch in der Elternseite), übernehmen
  useEffect(() => {
    if (!initialData && defaultVisibility) {
      setVisibility(defaultVisibility as PostInput["visibility"]);
    }
  }, [defaultVisibility, initialData]);

  const [attachments, setAttachments] = useState<AttachmentState>(
    emptyAttachmentState(initialData?.attachments || [])
  );

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
      fd.append("notify_push", String(notifyPush && status === "published"));

      // Anhänge (Bilder + PDFs): neue Dateien + Endreihenfolge übernehmen
      const filesFd = attachmentsToFormData(attachments);
      filesFd.getAll("attachments").forEach((f) => fd.append("attachments", f));
      filesFd.getAll("order").forEach((o) => fd.append("order", o as string));

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

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" aria-live="polite" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Titel */}
      <div className="space-y-2">
        <Label htmlFor="title">{tP("titleLabel")}</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={tP("titlePlaceholder")}
          required
        />
      </div>

      {/* Inhalt */}
      <div className="space-y-2">
        <Label htmlFor="content">{tP("contentLabel")}</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={tP("contentPlaceholder")}
          rows={10}
          required
        />
      </div>

      {/* Kategorie + Sichtbarkeit */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">{tP("categoryLabel")}</Label>
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
          <Label htmlFor="visibility">{tP("visibilityLabel")}</Label>
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
          {tP("pinnedLabel")}
        </Label>
      </div>

      {/* Push-Benachrichtigung (nur bei Neuanlage) */}
      {!isEdit && (
        <div className="flex items-center gap-2">
          <input
            id="notify_push"
            type="checkbox"
            checked={notifyPush}
            onChange={(e) => setNotifyPush(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-ring"
          />
          <Label htmlFor="notify_push" className="font-normal">
            {tPush("send.optIn")}
          </Label>
        </div>
      )}

      {/* Anhänge (Bilder + PDFs) */}
      <AttachmentUploader
        collection="posts"
        recordId={initialData?.id}
        value={attachments}
        onChange={setAttachments}
      />

      {/* Buttons */}
      <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4">
        <Button
          type="button"
          onClick={() => handleSubmit("published")}
          disabled={isSubmitting || !title || !content}
        >
          {isSubmitting ? tCommon("saving") : isEdit ? tCommon("updatePublish") : tCommon("publish")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleSubmit("draft")}
          disabled={isSubmitting || !title || !content}
        >
          {isEdit ? tCommon("saveAsDraft") : tCommon("saveDraft")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(backPath)}
        >
          {tCommon("cancel")}
        </Button>
      </div>
    </div>
  );
}
