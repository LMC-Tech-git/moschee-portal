"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Course, User, AcademicYear } from "@/types";
import type { CourseInput } from "@/lib/validations";
import { getTeachersByMosque } from "@/lib/actions/courses";
import { getAcademicYearsByMosque } from "@/lib/actions/academic-years";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface CourseFormProps {
  mosqueId: string;
  initialData?: Course;
  onSubmit: (data: CourseInput) => Promise<{ success: boolean; error?: string }>;
  isEdit?: boolean;
}

export function CourseForm({ mosqueId, initialData, onSubmit, isEdit }: CourseFormProps) {
  const router = useRouter();
  const tL = useTranslations("labels");

  const courseCategoryOptions = [
    { value: "quran", label: tL("course.category.quran") },
    { value: "tajweed", label: tL("course.category.tajweed") },
    { value: "fiqh", label: tL("course.category.fiqh") },
    { value: "arabic", label: tL("course.category.arabic") },
    { value: "sira", label: tL("course.category.sira") },
    { value: "islamic_studies", label: tL("course.category.islamic_studies") },
    { value: "other", label: tL("course.category.other") },
  ];

  const courseLevelOptions = [
    { value: "beginner", label: tL("course.level.beginner") },
    { value: "intermediate", label: tL("course.level.intermediate") },
    { value: "advanced", label: tL("course.level.advanced") },
    { value: "mixed", label: tL("course.level.mixed") },
  ];

  const dayOfWeekOptions = [
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
  const [teachers, setTeachers] = useState<User[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);

  const [academicYearId, setAcademicYearId] = useState(initialData?.academic_year_id || "");
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [category, setCategory] = useState<CourseInput["category"]>(
    initialData?.category || "quran"
  );
  const [level, setLevel] = useState<CourseInput["level"]>(
    initialData?.level || "mixed"
  );
  const [teacherId, setTeacherId] = useState(initialData?.teacher_id || "");
  const [dayOfWeek, setDayOfWeek] = useState<CourseInput["day_of_week"]>(
    initialData?.day_of_week || "monday"
  );
  const [startTime, setStartTime] = useState(initialData?.start_time || "");
  const [endTime, setEndTime] = useState(initialData?.end_time || "");
  const [locationName, setLocationName] = useState(initialData?.location_name || "");
  const [maxStudents, setMaxStudents] = useState<number | "">(
    initialData?.max_students ? initialData.max_students : ""
  );

  useEffect(() => {
    async function loadData() {
      const [teacherResult, yearsResult] = await Promise.all([
        getTeachersByMosque(mosqueId),
        getAcademicYearsByMosque(mosqueId),
      ]);
      if (teacherResult.success && teacherResult.data) {
        setTeachers(teacherResult.data);
      }
      if (yearsResult.success && yearsResult.data) {
        setAcademicYears(yearsResult.data);
        // Auto-select active year if not editing
        if (!initialData?.academic_year_id) {
          const activeYear = yearsResult.data.find((y) => y.status === "active");
          if (activeYear) setAcademicYearId(activeYear.id);
        }
      }
    }
    loadData();
  }, [mosqueId, initialData?.academic_year_id]);

  async function handleSubmit(status: "active" | "paused" | "archived") {
    setError("");
    setIsSubmitting(true);

    try {
      const result = await onSubmit({
        academic_year_id: academicYearId,
        title,
        description,
        category,
        level,
        teacher_id: teacherId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        location_name: locationName,
        max_students: maxStudents === "" ? 0 : maxStudents,
        status,
      });

      if (result.success) {
        router.push("/admin/madrasa");
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

  const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => { e.preventDefault(); handleSubmit("active"); }}
    >
      {error && (
        <div role="alert" aria-live="polite" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Schuljahr */}
      <div className="space-y-2">
        <Label htmlFor="academic_year">Schuljahr *</Label>
        {academicYears.length === 0 ? (
          <p className="text-sm text-amber-600">
            Noch kein Schuljahr vorhanden. Bitte erstellen Sie zuerst ein Schuljahr unter Madrasa &rarr; Schuljahre.
          </p>
        ) : (
          <select
            id="academic_year"
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
            className={selectClass}
          >
            <option value="">— Schuljahr auswählen —</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} {y.status === "active" ? "(aktiv)" : "(archiviert)"}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Titel */}
      <div className="space-y-2">
        <Label htmlFor="title">Kursname *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="z.B. Quran-Kurs für Anfänger"
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
          placeholder="Beschreiben Sie den Kurs..."
          rows={4}
        />
      </div>

      {/* Kategorie + Level */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Kategorie *</Label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as CourseInput["category"])}
            className={selectClass}
          >
            {courseCategoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="level">Niveau</Label>
          <select
            id="level"
            value={level}
            onChange={(e) => setLevel(e.target.value as CourseInput["level"])}
            className={selectClass}
          >
            {courseLevelOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lehrer */}
      <div className="space-y-2">
        <Label htmlFor="teacher">Lehrer *</Label>
        {teachers.length === 0 ? (
          <p className="text-sm text-amber-600">
            Noch keine Lehrer vorhanden. Bitte weisen Sie einem Mitglied die Rolle &quot;Lehrer&quot; zu.
          </p>
        ) : (
          <select
            id="teacher"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className={selectClass}
          >
            <option value="">— Lehrer auswählen —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.first_name} {t.last_name} ({t.email})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Wochentag + Uhrzeit */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="day_of_week">Wochentag *</Label>
          <select
            id="day_of_week"
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(e.target.value as CourseInput["day_of_week"])}
            className={selectClass}
          >
            {dayOfWeekOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="start_time">Beginn *</Label>
          <Input
            id="start_time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_time">Ende</Label>
          <Input
            id="end_time"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      </div>

      {/* Ort + Max. Schüler */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="location">Ort</Label>
          <Input
            id="location"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="z.B. Raum 1, Untergeschoss"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="max_students">Max. Schüler (0 = unbegrenzt)</Label>
          <Input
            id="max_students"
            type="number"
            min={0}
            placeholder="0 = unbegrenzt"
            value={maxStudents}
            onChange={(e) => {
              const val = e.target.value;
              setMaxStudents(val === "" ? "" : parseInt(val) || 0);
            }}
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4">
        <Button
          type="button"
          onClick={() => handleSubmit("active")}
          disabled={isSubmitting || !title || !teacherId || !startTime || !academicYearId}
        >
          {isSubmitting ? "Wird gespeichert…" : isEdit ? "Aktualisieren" : "Kurs erstellen"}
        </Button>
        {isEdit && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSubmit("paused")}
              disabled={isSubmitting}
            >
              Pausieren
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => handleSubmit("archived")}
              disabled={isSubmitting}
            >
              Archivieren
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/admin/madrasa")}
        >
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
