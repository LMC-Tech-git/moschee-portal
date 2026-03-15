"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Campaign } from "@/types";
import type { CampaignInput } from "@/lib/validations";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface CampaignFormProps {
  initialData?: Campaign;
  onSubmit: (data: CampaignInput) => Promise<{ success: boolean; error?: string }>;
  isEdit?: boolean;
}

export function CampaignForm({ initialData, onSubmit, isEdit }: CampaignFormProps) {
  const router = useRouter();
  const tL = useTranslations("labels");
  const tC = useTranslations("campaigns.form");
  const tCommon = useTranslations("common");

  const categoryOptions = [
    { value: "ramadan", label: tL("campaign.category.ramadan") },
    { value: "construction", label: tL("campaign.category.construction") },
    { value: "aid", label: tL("campaign.category.aid") },
    { value: "maintenance", label: tL("campaign.category.maintenance") },
    { value: "general", label: tL("campaign.category.general") },
  ];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [category, setCategory] = useState<CampaignInput["category"]>(
    initialData?.category || "general"
  );
  const [goalEuro, setGoalEuro] = useState(
    initialData?.goal_amount_cents ? (initialData.goal_amount_cents / 100).toString() : ""
  );
  const [startAt, setStartAt] = useState(
    initialData?.start_at ? initialData.start_at.slice(0, 10) : ""
  );
  const [endAt, setEndAt] = useState(
    initialData?.end_at ? initialData.end_at.slice(0, 10) : ""
  );

  async function handleSubmit(status: "active" | "paused" | "completed") {
    setError("");
    setIsSubmitting(true);

    const goalCents = Math.round(parseFloat(goalEuro || "0") * 100);

    try {
      const result = await onSubmit({
        title,
        description,
        category,
        goal_amount_cents: goalCents,
        start_at: startAt || "",
        end_at: endAt || "",
        status,
      });

      if (result.success) {
        router.push("/admin/kampagnen");
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
        <Label htmlFor="title">{tC("titleLabel")}</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={tC("titlePlaceholder")}
          required
        />
      </div>

      {/* Beschreibung */}
      <div className="space-y-2">
        <Label htmlFor="description">{tC("descriptionLabel")}</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={tC("descriptionPlaceholder")}
          rows={5}
        />
      </div>

      {/* Kategorie + Ziel */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">{tC("categoryLabel")}</Label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as CampaignInput["category"])}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="goal">{tC("goalLabel")}</Label>
          <Input
            id="goal"
            type="number"
            min={1}
            step={0.01}
            value={goalEuro}
            onChange={(e) => setGoalEuro(e.target.value)}
            placeholder={tC("goalPlaceholder")}
            required
          />
        </div>
      </div>

      {/* Zeitraum */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start_at">{tC("startDateLabel")}</Label>
          <Input
            id="start_at"
            type="date"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_at">{tC("endDateLabel")}</Label>
          <Input
            id="end_at"
            type="date"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4">
        <Button
          type="button"
          onClick={() => handleSubmit("active")}
          disabled={isSubmitting || !title || !goalEuro}
        >
          {isSubmitting ? tCommon("saving") : isEdit ? tCommon("update") : tC("btnStart")}
        </Button>
        {isEdit && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSubmit("paused")}
              disabled={isSubmitting}
            >
              {tCommon("pause")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleSubmit("completed")}
              disabled={isSubmitting}
            >
              {tCommon("complete")}
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/admin/kampagnen")}
        >
          {tCommon("cancel")}
        </Button>
      </div>
    </div>
  );
}
