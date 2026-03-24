"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import type { Event } from "@/types";
import type { EventInput } from "@/lib/validations";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const TOGGLE_BASE =
  "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const TOGGLE_ACTIVE = "bg-white shadow-sm text-gray-900";
const TOGGLE_INACTIVE = "text-gray-500 hover:text-gray-700";

interface EventFormProps {
  initialData?: Event;
  onSubmit: (data: EventInput) => Promise<{ success: boolean; error?: string }>;
  isEdit?: boolean;
  defaultVisibility?: string;
}

export function EventForm({ initialData, onSubmit, isEdit, defaultVisibility }: EventFormProps) {
  const router = useRouter();
  const tL = useTranslations("labels");
  const tE = useTranslations("events.form");
  const tCommon = useTranslations("common");

  const categoryOptions = [
    { value: "youth", label: tL("event.category.youth") },
    { value: "lecture", label: tL("event.category.lecture") },
    { value: "quran", label: tL("event.category.quran") },
    { value: "community", label: tL("event.category.community") },
    { value: "ramadan", label: tL("event.category.ramadan") },
    { value: "other", label: tL("event.category.other") },
  ];

  const visibilityOpts = [
    { value: "public", label: tL("visibility.public") },
    { value: "members", label: tL("visibility.members") },
  ];

  const prayerOptions = [
    { value: "fajr",    label: tL("prayer.fajr") },
    { value: "dhuhr",   label: tL("prayer.dhuhr") },
    { value: "asr",     label: tL("prayer.asr") },
    { value: "maghrib", label: tL("prayer.maghrib") },
    { value: "isha",    label: tL("prayer.isha") },
  ];

  const dayOptions = [
    { value: "monday",    label: tL("day.monday") },
    { value: "tuesday",   label: tL("day.tuesday") },
    { value: "wednesday", label: tL("day.wednesday") },
    { value: "thursday",  label: tL("day.thursday") },
    { value: "friday",    label: tL("day.friday") },
    { value: "saturday",  label: tL("day.saturday") },
    { value: "sunday",    label: tL("day.sunday") },
  ];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Basis-Felder
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [category, setCategory] = useState<EventInput["category"]>(
    initialData?.category || "other"
  );
  const [locationName, setLocationName] = useState(initialData?.location_name || "");
  const [visibility, setVisibility] = useState<EventInput["visibility"]>(
    initialData?.visibility ?? (defaultVisibility as EventInput["visibility"]) ?? "public"
  );
  const [capacity, setCapacity] = useState<number | "">(
    initialData?.capacity || ""
  );

  // Wenn defaultVisibility nachgeladen wird (Settings-Fetch in der Elternseite), übernehmen
  useEffect(() => {
    if (!initialData && defaultVisibility) {
      setVisibility(defaultVisibility as EventInput["visibility"]);
    }
  }, [defaultVisibility, initialData]);

  // --- Beginn ---
  const [startMode, setStartMode] = useState<"time" | "prayer">(
    initialData?.start_prayer ? "prayer" : "time"
  );
  const [startAt, setStartAt] = useState(
    initialData?.start_at && !initialData?.start_prayer
      ? initialData.start_at.slice(0, 16)
      : ""
  );
  const [startDate, setStartDate] = useState(
    initialData?.start_at && initialData?.start_prayer
      ? initialData.start_at.slice(0, 10)
      : ""
  );
  const [startPrayer, setStartPrayer] = useState(
    initialData?.start_prayer || "maghrib"
  );

  // --- Ende ---
  const [endMode, setEndMode] = useState<"time" | "duration">(
    (initialData?.duration_minutes || 0) > 0 ? "duration" : "time"
  );
  const [endAt, setEndAt] = useState(
    initialData?.end_at ? initialData.end_at.slice(0, 16) : ""
  );
  const [durationHours, setDurationHours] = useState(
    Math.floor((initialData?.duration_minutes || 0) / 60)
  );
  const [durationMins, setDurationMins] = useState(
    (initialData?.duration_minutes || 0) % 60
  );

  // --- Wiederholung ---
  const [isRecurring, setIsRecurring] = useState(initialData?.is_recurring || false);
  const [recurrenceType, setRecurrenceType] = useState(
    initialData?.recurrence_type || "weekly"
  );
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState(
    initialData?.recurrence_day_of_week || "friday"
  );
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState(
    initialData?.recurrence_day_of_month || 1
  );
  const [recurrenceMonthMode, setRecurrenceMonthMode] = useState<"day" | "weekday">(
    initialData?.recurrence_month_mode || "day"
  );
  const [recurrenceMonthWeek, setRecurrenceMonthWeek] = useState(
    initialData?.recurrence_month_week ?? 1
  );
  const [recurrenceMonthWeekday, setRecurrenceMonthWeekday] = useState(
    initialData?.recurrence_month_weekday || "friday"
  );
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(
    initialData?.recurrence_end_date ? initialData.recurrence_end_date.slice(0, 10) : ""
  );

  // Berechnetes Ende (nur Uhrzeit-Modus + Dauer)
  const totalDurationMinutes = durationHours * 60 + durationMins;
  let computedEndPreview: Date | null = null;
  if (endMode === "duration" && startMode === "time" && startAt && totalDurationMinutes > 0) {
    computedEndPreview = new Date(startAt);
    computedEndPreview.setMinutes(computedEndPreview.getMinutes() + totalDurationMinutes);
  }

  const monthlyValid = recurrenceType === "monthly"
    ? (recurrenceMonthMode === "day" ? recurrenceDayOfMonth > 0 : !!recurrenceMonthWeekday)
    : true;
  const startIsValid = isRecurring
    ? (recurrenceType === "weekly" ? !!recurrenceDayOfWeek : monthlyValid)
    : (startMode === "time" ? !!startAt : !!startDate);

  async function handleSubmit(status: "published" | "draft" | "cancelled") {
    setError("");
    setIsSubmitting(true);

    try {
      let computedStartAt = "";
      if (startMode === "time") {
        computedStartAt = startAt ? new Date(startAt).toISOString() : "";
      } else {
        computedStartAt = startDate ? new Date(startDate + "T00:00:00").toISOString() : "";
      }

      let computedEndAt = "";
      if (endMode === "duration" && startMode === "time" && startAt && totalDurationMinutes > 0) {
        const end = new Date(startAt);
        end.setMinutes(end.getMinutes() + totalDurationMinutes);
        computedEndAt = end.toISOString();
      } else if (endMode === "time" && endAt) {
        computedEndAt = new Date(endAt).toISOString();
      }

      const result = await onSubmit({
        title,
        description,
        category,
        location_name: locationName,
        start_at: computedStartAt,
        start_prayer: startMode === "prayer" ? startPrayer : "",
        end_at: computedEndAt,
        duration_minutes: totalDurationMinutes,
        visibility,
        capacity: capacity === "" ? 0 : capacity,
        status,
        is_recurring: isRecurring,
        recurrence_type: isRecurring ? recurrenceType : "",
        recurrence_day_of_week: isRecurring && recurrenceType === "weekly" ? recurrenceDayOfWeek : "",
        recurrence_day_of_month: isRecurring && recurrenceType === "monthly" && recurrenceMonthMode === "day" ? recurrenceDayOfMonth : 0,
        recurrence_month_mode: isRecurring && recurrenceType === "monthly" ? recurrenceMonthMode : "day",
        recurrence_month_week: isRecurring && recurrenceType === "monthly" && recurrenceMonthMode === "weekday" ? recurrenceMonthWeek : 1,
        recurrence_month_weekday: isRecurring && recurrenceType === "monthly" && recurrenceMonthMode === "weekday" ? recurrenceMonthWeekday : "",
        recurrence_end_date: isRecurring && recurrenceEndDate ? new Date(recurrenceEndDate).toISOString() : "",
      });

      if (result.success) {
        router.push("/admin/events");
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
        <Label htmlFor="title">{tE("titleLabel")}</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={tE("titlePlaceholder")}
          required
        />
      </div>

      {/* Beschreibung */}
      <div className="space-y-2">
        <Label htmlFor="description">{tE("descriptionLabel")}</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={tE("descriptionPlaceholder")}
          rows={5}
        />
      </div>

      {/* Kategorie + Sichtbarkeit */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">{tE("categoryLabel")}</Label>
          <select id="category" value={category} onChange={(e) => setCategory(e.target.value as EventInput["category"])} className={SELECT_CLASS}>
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="visibility">{tE("visibilityLabel")}</Label>
          <select id="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as EventInput["visibility"])} className={SELECT_CLASS}>
            {visibilityOpts.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Ort */}
      <div className="space-y-2">
        <Label htmlFor="location">{tE("locationLabel")}</Label>
        <Input
          id="location"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          placeholder={tE("locationPlaceholder")}
        />
      </div>

      {/* ── BEGINN ── */}
      <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-sm font-semibold text-gray-700">{tE("startLabel")}</Label>
          <div className="flex gap-1 rounded-lg bg-gray-200 p-1">
            <button
              type="button"
              onClick={() => setStartMode("time")}
              className={`${TOGGLE_BASE} ${startMode === "time" ? TOGGLE_ACTIVE : TOGGLE_INACTIVE}`}
            >
              {tE("startModeTime")}
            </button>
            <button
              type="button"
              onClick={() => setStartMode("prayer")}
              className={`${TOGGLE_BASE} ${startMode === "prayer" ? TOGGLE_ACTIVE : TOGGLE_INACTIVE}`}
            >
              {tE("startModePrayer")}
            </button>
          </div>
        </div>

        {startMode === "time" ? (
          <div>
            <Input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
            {startAt && (
              <p className="mt-1 text-xs text-gray-500">
                {new Date(startAt).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <div>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-44"
              />
              {startDate && (
                <p className="mt-1 text-xs text-gray-500">
                  {new Date(startDate + "T12:00:00").toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
            </div>
            <span className="shrink-0 text-sm text-gray-500">{tE("afterPrayer")}</span>
            <select
              value={startPrayer}
              onChange={(e) => setStartPrayer(e.target.value)}
              className={`${SELECT_CLASS} max-w-xs`}
            >
              {prayerOptions.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── ENDE ── */}
      <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-sm font-semibold text-gray-700">
            {tE("endLabel")} <span className="text-xs font-normal text-gray-400">{tE("endOptional")}</span>
          </Label>
          <div className="flex gap-1 rounded-lg bg-gray-200 p-1">
            <button
              type="button"
              onClick={() => setEndMode("time")}
              className={`${TOGGLE_BASE} ${endMode === "time" ? TOGGLE_ACTIVE : TOGGLE_INACTIVE}`}
            >
              {tE("endModeTime")}
            </button>
            <button
              type="button"
              onClick={() => setEndMode("duration")}
              className={`${TOGGLE_BASE} ${endMode === "duration" ? TOGGLE_ACTIVE : TOGGLE_INACTIVE}`}
            >
              {tE("endModeDuration")}
            </button>
          </div>
        </div>

        {endMode === "time" ? (
          <Input
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
          />
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={durationHours || ""}
                  onChange={(e) => setDurationHours(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="w-20 text-center"
                />
                <span className="text-sm text-gray-500">{tE("durationHours")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={durationMins || ""}
                  onChange={(e) => setDurationMins(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  placeholder="0"
                  className="w-20 text-center"
                />
                <span className="text-sm text-gray-500">{tE("durationMins")}</span>
              </div>
            </div>
            {computedEndPreview && (
              <p className="text-xs font-medium text-emerald-700">
                → Ende:{" "}
                {computedEndPreview.toLocaleDateString("de-DE", {
                  weekday: "short", day: "2-digit", month: "2-digit",
                })}{" "}
                um {computedEndPreview.toLocaleTimeString("de-DE", {
                  hour: "2-digit", minute: "2-digit",
                })} Uhr
              </p>
            )}
            {endMode === "duration" && startMode === "prayer" && totalDurationMinutes > 0 && (
              <p className="text-xs text-gray-400">
                {tE("durationSavedHint")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Kapazität */}
      <div className="space-y-2">
        <Label htmlFor="capacity">{tE("capacityLabel")}</Label>
        <Input
          id="capacity"
          type="number"
          min={0}
          placeholder={tE("capacityPlaceholder")}
          value={capacity}
          onChange={(e) => {
            const val = e.target.value;
            setCapacity(val === "" ? "" : parseInt(val) || 0);
          }}
        />
      </div>

      {/* ── WIEDERHOLUNG ── */}
      <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="is_recurring"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <Label htmlFor="is_recurring" className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-700">
            <RefreshCw className="h-4 w-4 text-purple-600" />
            {tE("recurringLabel")}
          </Label>
        </div>

        {isRecurring && (
          <div className="space-y-3 pl-7">
            {/* Intervall */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">{tE("intervalLabel")}</Label>
              <select
                value={recurrenceType}
                onChange={(e) => setRecurrenceType(e.target.value as "daily" | "weekly" | "monthly")}
                className={SELECT_CLASS}
              >
                <option value="daily">{tL("recurrence.daily")}</option>
                <option value="weekly">{tL("recurrence.weekly")}</option>
                <option value="monthly">{tL("recurrence.monthly")}</option>
              </select>
            </div>

            {/* Wochentag */}
            {recurrenceType === "weekly" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">{tE("weekdayLabel")}</Label>
                <select
                  value={recurrenceDayOfWeek}
                  onChange={(e) => setRecurrenceDayOfWeek(e.target.value)}
                  className={SELECT_CLASS}
                >
                  {dayOptions.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Monatliche Optionen */}
            {recurrenceType === "monthly" && (
              <div className="space-y-3">
                {/* Modus-Auswahl */}
                <div className="flex gap-1 rounded-lg bg-gray-200 p-1">
                  <button
                    type="button"
                    onClick={() => setRecurrenceMonthMode("day")}
                    className={`${TOGGLE_BASE} ${recurrenceMonthMode === "day" ? TOGGLE_ACTIVE : TOGGLE_INACTIVE}`}
                  >
                    {tE("monthModeDay")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecurrenceMonthMode("weekday")}
                    className={`${TOGGLE_BASE} ${recurrenceMonthMode === "weekday" ? TOGGLE_ACTIVE : TOGGLE_INACTIVE}`}
                  >
                    {tE("monthModeWeekday")}
                  </button>
                </div>

                {/* Fester Tag des Monats */}
                {recurrenceMonthMode === "day" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">{tE("monthDayLabel")}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={recurrenceDayOfMonth}
                        onChange={(e) => setRecurrenceDayOfMonth(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                        className="w-24 text-center"
                      />
                      <span className="text-sm text-gray-500">{tE("ofMonth")}</span>
                    </div>
                  </div>
                )}

                {/* N. Wochentag des Monats */}
                {recurrenceMonthMode === "weekday" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">{tE("monthWeekdayLabel")}</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={recurrenceMonthWeek}
                        onChange={(e) => setRecurrenceMonthWeek(parseInt(e.target.value))}
                        className={`${SELECT_CLASS} w-36`}
                      >
                        <option value={1}>{tE("monthWeek1")}</option>
                        <option value={2}>{tE("monthWeek2")}</option>
                        <option value={3}>{tE("monthWeek3")}</option>
                        <option value={4}>{tE("monthWeek4")}</option>
                        <option value={-1}>{tE("monthWeekLast")}</option>
                      </select>
                      <select
                        value={recurrenceMonthWeekday}
                        onChange={(e) => setRecurrenceMonthWeekday(e.target.value)}
                        className={`${SELECT_CLASS} w-36`}
                      >
                        {dayOptions.map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                      <span className="text-sm text-gray-500">{tE("ofMonth")}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Enddatum */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">{tE("recurringEndLabel")}</Label>
              <Input
                type="date"
                value={recurrenceEndDate}
                onChange={(e) => setRecurrenceEndDate(e.target.value)}
                className="w-48"
              />
            </div>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4">
        <Button
          type="button"
          onClick={() => handleSubmit("published")}
          disabled={isSubmitting || !title || !startIsValid}
        >
          {isSubmitting ? tCommon("saving") : isEdit ? tCommon("update") : tCommon("publish")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleSubmit("draft")}
          disabled={isSubmitting || !title || !startIsValid}
        >
          {tCommon("saveDraft")}
        </Button>
        {isEdit && (
          <Button
            type="button"
            variant="destructive"
            onClick={() => handleSubmit("cancelled")}
            disabled={isSubmitting}
          >
            {tE("btnCancel")}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/admin/events")}
        >
          {tCommon("cancel")}
        </Button>
      </div>
    </div>
  );
}
