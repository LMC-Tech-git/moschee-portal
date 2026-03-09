"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { Event } from "@/types";
import type { EventInput } from "@/lib/validations";
import { eventCategoryOptions, visibilityOptions } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const PRAYER_OPTIONS = [
  { value: "fajr",    label: "Fajr (Morgengebet)" },
  { value: "dhuhr",   label: "Dhuhr (Mittagsgebet)" },
  { value: "asr",     label: "Asr (Nachmittagsgebet)" },
  { value: "maghrib", label: "Maghrib (Abendgebet)" },
  { value: "isha",    label: "Isha (Nachtgebet)" },
] as const;

const DAY_OPTIONS = [
  { value: "monday",    label: "Montag" },
  { value: "tuesday",   label: "Dienstag" },
  { value: "wednesday", label: "Mittwoch" },
  { value: "thursday",  label: "Donnerstag" },
  { value: "friday",    label: "Freitag" },
  { value: "saturday",  label: "Samstag" },
  { value: "sunday",    label: "Sonntag" },
] as const;

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

  const startIsValid = isRecurring
    ? (recurrenceType === "weekly" ? !!recurrenceDayOfWeek : recurrenceType === "monthly" ? recurrenceDayOfMonth > 0 : true)
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
        recurrence_day_of_month: isRecurring && recurrenceType === "monthly" ? recurrenceDayOfMonth : 0,
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
        <Label htmlFor="title">Titel *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titel der Veranstaltung"
          required
        />
      </div>

      {/* Beschreibung */}
      <div className="space-y-2">
        <Label htmlFor="description">Beschreibung</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Beschreiben Sie die Veranstaltung..."
          rows={5}
        />
      </div>

      {/* Kategorie + Sichtbarkeit */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Kategorie</Label>
          <select id="category" value={category} onChange={(e) => setCategory(e.target.value as EventInput["category"])} className={SELECT_CLASS}>
            {eventCategoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="visibility">Sichtbarkeit</Label>
          <select id="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as EventInput["visibility"])} className={SELECT_CLASS}>
            {visibilityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Ort */}
      <div className="space-y-2">
        <Label htmlFor="location">Veranstaltungsort</Label>
        <Input
          id="location"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          placeholder="z.B. Gemeindesaal, Moschee Hauptgebäude"
        />
      </div>

      {/* ── BEGINN ── */}
      <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-sm font-semibold text-gray-700">Beginn *</Label>
          <div className="flex gap-1 rounded-lg bg-gray-200 p-1">
            <button
              type="button"
              onClick={() => setStartMode("time")}
              className={`${TOGGLE_BASE} ${startMode === "time" ? TOGGLE_ACTIVE : TOGGLE_INACTIVE}`}
            >
              Uhrzeit
            </button>
            <button
              type="button"
              onClick={() => setStartMode("prayer")}
              className={`${TOGGLE_BASE} ${startMode === "prayer" ? TOGGLE_ACTIVE : TOGGLE_INACTIVE}`}
            >
              Gebetszeit
            </button>
          </div>
        </div>

        {startMode === "time" ? (
          <Input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-44"
            />
            <span className="shrink-0 text-sm text-gray-500">nach</span>
            <select
              value={startPrayer}
              onChange={(e) => setStartPrayer(e.target.value)}
              className={`${SELECT_CLASS} max-w-xs`}
            >
              {PRAYER_OPTIONS.map((p) => (
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
            Ende <span className="text-xs font-normal text-gray-400">(optional)</span>
          </Label>
          <div className="flex gap-1 rounded-lg bg-gray-200 p-1">
            <button
              type="button"
              onClick={() => setEndMode("time")}
              className={`${TOGGLE_BASE} ${endMode === "time" ? TOGGLE_ACTIVE : TOGGLE_INACTIVE}`}
            >
              Endzeit
            </button>
            <button
              type="button"
              onClick={() => setEndMode("duration")}
              className={`${TOGGLE_BASE} ${endMode === "duration" ? TOGGLE_ACTIVE : TOGGLE_INACTIVE}`}
            >
              Dauer
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
                <span className="text-sm text-gray-500">Std</span>
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
                <span className="text-sm text-gray-500">Min</span>
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
                Dauer wird gespeichert. Automatische Berechnung des Endes nicht möglich (Gebetszeit-Beginn).
              </p>
            )}
          </div>
        )}
      </div>

      {/* Kapazität */}
      <div className="space-y-2">
        <Label htmlFor="capacity">Maximale Teilnehmer (0 = unbegrenzt)</Label>
        <Input
          id="capacity"
          type="number"
          min={0}
          placeholder="0 = unbegrenzt"
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
            Veranstaltung wiederholt sich
          </Label>
        </div>

        {isRecurring && (
          <div className="space-y-3 pl-7">
            {/* Intervall */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Intervall</Label>
              <select
                value={recurrenceType}
                onChange={(e) => setRecurrenceType(e.target.value as "daily" | "weekly" | "monthly")}
                className={SELECT_CLASS}
              >
                <option value="daily">Täglich</option>
                <option value="weekly">Wöchentlich</option>
                <option value="monthly">Monatlich</option>
              </select>
            </div>

            {/* Wochentag */}
            {recurrenceType === "weekly" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">Wochentag</Label>
                <select
                  value={recurrenceDayOfWeek}
                  onChange={(e) => setRecurrenceDayOfWeek(e.target.value)}
                  className={SELECT_CLASS}
                >
                  {DAY_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Tag des Monats */}
            {recurrenceType === "monthly" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">Am _. des Monats</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={recurrenceDayOfMonth}
                    onChange={(e) => setRecurrenceDayOfMonth(Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                    className="w-24 text-center"
                  />
                  <span className="text-sm text-gray-500">des Monats</span>
                </div>
              </div>
            )}

            {/* Enddatum */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Enddatum (optional)</Label>
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
          {isSubmitting ? "Wird gespeichert..." : isEdit ? "Aktualisieren" : "Veröffentlichen"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleSubmit("draft")}
          disabled={isSubmitting || !title || !startIsValid}
        >
          Als Entwurf speichern
        </Button>
        {isEdit && (
          <Button
            type="button"
            variant="destructive"
            onClick={() => handleSubmit("cancelled")}
            disabled={isSubmitting}
          >
            Absagen
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/admin/events")}
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
