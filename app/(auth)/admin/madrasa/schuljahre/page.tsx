"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Calendar, Archive, Pencil, X, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import {
  getAcademicYearsByMosque,
  createAcademicYear,
  updateAcademicYear,
  archiveAcademicYear,
  activateAcademicYear,
} from "@/lib/actions/academic-years";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { academicYearStatusColors } from "@/lib/constants";
import type { AcademicYear } from "@/types";

export default function SchuljahrePage() {
  const { mosqueId } = useMosque();
  const { user } = useAuth();
  const t = useTranslations("madrasa.schuljahre");
  const tCommon = useTranslations("common");
  const tL = useTranslations("labels");
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!mosqueId) return;
    loadYears();
  }, [mosqueId]);

  async function loadYears() {
    setIsLoading(true);
    const result = await getAcademicYearsByMosque(mosqueId);
    if (result.success && result.data) {
      setYears(result.data);
    }
    setIsLoading(false);
  }

  function openCreateForm() {
    setEditingYear(null);
    setName("");
    setStartDate("");
    setEndDate("");
    setFormError("");
    setShowForm(true);
  }

  function openEditForm(year: AcademicYear) {
    setEditingYear(year);
    setName(year.name);
    setStartDate(year.start_date.slice(0, 10));
    setEndDate(year.end_date.slice(0, 10));
    setFormError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingYear(null);
  }

  async function handleSave() {
    if (!user) return;
    setFormError("");
    setIsSaving(true);

    const input = {
      name,
      start_date: startDate,
      end_date: endDate,
      status: "active" as const,
    };

    let result;
    if (editingYear) {
      result = await updateAcademicYear(editingYear.id, mosqueId, user.id, {
        ...input,
        status: editingYear.status,
      });
    } else {
      result = await createAcademicYear(mosqueId, user.id, input);
    }

    if (result.success) {
      closeForm();
      await loadYears();
    } else {
      setFormError(result.error || t("saveFailed"));
    }
    setIsSaving(false);
  }

  async function handleArchive(year: AcademicYear) {
    if (!user) return;
    if (!confirm(t("archiveConfirm"))) return;

    const result = await archiveAcademicYear(year.id, mosqueId, user.id);
    if (result.success) {
      await loadYears();
    }
  }

  async function handleActivate(year: AcademicYear) {
    if (!user) return;
    if (!confirm(t("activateConfirm"))) return;

    const result = await activateAcademicYear(year.id, mosqueId, user.id);
    if (result.success) {
      await loadYears();
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openCreateForm} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("newBtn")}
          </Button>
          <Link
            href="/admin/madrasa"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Zur Madrasa-Übersicht
          </Link>
        </div>
      </div>

      {/* Inline Form */}
      {showForm && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {editingYear ? t("formTitleEdit") : t("formTitleCreate")}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                className="rounded p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="year_name">{t("nameLabel")}</Label>
                <Input
                  id="year_name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year_start">{t("startLabel")}</Label>
                <Input
                  id="year_start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year_end">{t("endLabel")}</Label>
                <Input
                  id="year_end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving || !name || !startDate || !endDate}
                size="sm"
              >
                {isSaving ? tCommon("saving") : editingYear ? tCommon("update") : tCommon("create")}
              </Button>
              <Button variant="ghost" size="sm" onClick={closeForm}>
                {tCommon("cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-0 divide-y">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : years.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Calendar className="mb-3 h-10 w-10 text-gray-300" />
              <p className="mb-1 text-sm font-medium text-gray-600">
                {t("emptyTitle")}
              </p>
              <p className="mb-4 text-xs text-gray-400">
                {t("emptyHint")}
              </p>
              <Button onClick={openCreateForm} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                {t("newBtn")}
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {years.map((year) => (
                <div
                  key={year.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => openEditForm(year)}
                >
                  <div className="flex items-center gap-4">
                    <Calendar className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">{year.name}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(year.start_date).toLocaleDateString("de-DE")} –{" "}
                        {new Date(year.end_date).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        academicYearStatusColors[year.status]
                      )}
                    >
                      {tL(`academicYear.status.${year.status}`)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => openEditForm(year)}
                      className="rounded p-1.5 text-gray-600 hover:bg-gray-100"
                      title={t("editTitle")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {year.status === "active" && (
                      <button
                        type="button"
                        onClick={() => handleArchive(year)}
                        className="rounded p-1.5 text-amber-600 hover:bg-amber-50"
                        title={t("archiveTitle")}
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    )}
                    {year.status === "archived" && (
                      <button
                        type="button"
                        onClick={() => handleActivate(year)}
                        className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"
                        title={t("activateTitle")}
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
