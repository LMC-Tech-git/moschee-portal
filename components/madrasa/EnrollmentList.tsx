"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, UserPlus, UserMinus, X, Pencil, Upload } from "lucide-react";
import { StudentImportDialog } from "@/components/madrasa/StudentImportDialog";
import { useAuth } from "@/lib/auth-context";
import {
  getEnrollmentsByCourse,
  enrollStudent,
  updateEnrollmentStatus,
  getStudentCandidates,
} from "@/lib/actions/enrollments";
import {
  createStudent,
  updateStudent,
  getStudentById,
  getParentCandidates,
} from "@/lib/actions/students";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { enrollmentStatusLabels, enrollmentStatusColors } from "@/lib/constants";
import type { CourseEnrollment, Student } from "@/types";

interface EnrollmentListProps {
  courseId: string;
  mosqueId: string;
  courseTitle: string;
}

type EnrollmentWithStudent = CourseEnrollment & {
  student_name?: string;
  student_date_of_birth?: string;
  student_parent_id?: string;
  student_parent_user_name?: string;
  student_parent_name?: string;
  student_parent_phone?: string;
  student_father_name?: string;
  student_father_phone?: string;
  student_mother_name?: string;
  student_mother_phone?: string;
};

function getParentInfo(e: EnrollmentWithStudent): { name: string; phone: string } {
  // 1. Portal-Mitglied verknüpft
  if (e.student_parent_id && e.student_parent_user_name) {
    return {
      name: e.student_parent_user_name,
      phone: e.student_parent_phone || "—",
    };
  }
  // 2. Vater + Mutter separat eingetragen
  const fatherName = e.student_father_name?.trim();
  const motherName = e.student_mother_name?.trim();
  if (fatherName || motherName) {
    const nameParts = [fatherName, motherName].filter(Boolean);
    const phoneParts = [e.student_father_phone, e.student_mother_phone].filter(Boolean);
    return {
      name: nameParts.join(" / "),
      phone: phoneParts.join(" / ") || e.student_parent_phone || "—",
    };
  }
  // 3. Legacy parent_name Feld
  return {
    name: e.student_parent_name || "—",
    phone: e.student_parent_phone || "—",
  };
}

export function EnrollmentList({ courseId, mosqueId, courseTitle }: EnrollmentListProps) {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<EnrollmentWithStudent[]>([]);
  const [existingStudents, setExistingStudents] = useState<Student[]>([]);
  const [parentCandidates, setParentCandidates] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Import-Dialog
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Hinzufügen-Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<"new" | "existing">("new");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  // Bearbeiten-Form
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editStatus, setEditStatus] = useState<"active" | "inactive">("active");

  // Geteilte Formular-Felder (Hinzufügen + Bearbeiten)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<"" | "male" | "female">("");
  const [parentId, setParentId] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  // Erweiterte Felder (v2)
  const [address, setAddress] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolClass, setSchoolClass] = useState("");
  const [healthNotes, setHealthNotes] = useState("");
  const [motherName, setMotherName] = useState("");
  const [motherPhone, setMotherPhone] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [fatherPhone, setFatherPhone] = useState("");
  const [membershipStatus, setMembershipStatus] = useState<"" | "active" | "none" | "planned">("");
  const [notes, setNotes] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const result = await getEnrollmentsByCourse(courseId, mosqueId);
    if (result.success && result.data) {
      setEnrollments(result.data);
    }
    setIsLoading(false);
  }, [courseId, mosqueId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function loadParentCandidates() {
    if (parentCandidates.length > 0) return;
    const result = await getParentCandidates(mosqueId);
    if (result.success && result.data) {
      setParentCandidates(result.data);
    }
  }

  async function handleShowAdd() {
    setEditingStudentId(null);
    setShowAddForm(true);
    setError("");
    resetForm();

    const [studentsResult] = await Promise.all([
      getStudentCandidates(mosqueId),
      loadParentCandidates(),
    ]);

    if (studentsResult.success && studentsResult.data) {
      const enrolledIds = new Set(
        enrollments.filter((e) => e.status === "enrolled").map((e) => e.student_id)
      );
      setExistingStudents(studentsResult.data.filter((s) => !enrolledIds.has(s.id)));
    }
  }

  async function handleEditClick(enrollment: EnrollmentWithStudent) {
    setShowAddForm(false);
    setError("");
    setEditingStudentId(enrollment.student_id);
    setIsLoadingEdit(true);

    const [studentResult] = await Promise.all([
      getStudentById(enrollment.student_id, mosqueId),
      loadParentCandidates(),
    ]);

    if (studentResult.success && studentResult.data) {
      const s = studentResult.data;
      setFirstName(s.first_name);
      setLastName(s.last_name);
      setDateOfBirth(s.date_of_birth ? s.date_of_birth.slice(0, 10) : "");
      setGender((s.gender as "" | "male" | "female") || "");
      setParentId(s.parent_id || "");
      setParentName(s.parent_name || "");
      setParentPhone(s.parent_phone || "");
      setAddress(s.address || "");
      setSchoolName(s.school_name || "");
      setSchoolClass(s.school_class || "");
      setHealthNotes(s.health_notes || "");
      setMotherName(s.mother_name || "");
      setMotherPhone(s.mother_phone || "");
      setFatherName(s.father_name || "");
      setFatherPhone(s.father_phone || "");
      setMembershipStatus((s.membership_status as "" | "active" | "none" | "planned") || "");
      setNotes(s.notes || "");
      setEditStatus(s.status === "inactive" ? "inactive" : "active");
    } else {
      setError("Schüler konnte nicht geladen werden");
      setEditingStudentId(null);
    }
    setIsLoadingEdit(false);
  }

  function resetForm() {
    setFirstName("");
    setLastName("");
    setDateOfBirth("");
    setGender("");
    setParentId("");
    setParentName("");
    setParentPhone("");
    setAddress("");
    setSchoolName("");
    setSchoolClass("");
    setHealthNotes("");
    setMotherName("");
    setMotherPhone("");
    setFatherName("");
    setFatherPhone("");
    setMembershipStatus("");
    setNotes("");
    setSelectedStudentId("");
    setAddMode("new");
    setEditStatus("active");
  }

  async function handleEnrollNew() {
    if (!user || !firstName || !lastName || !dateOfBirth) return;
    setIsAdding(true);
    setError("");

    const studentResult = await createStudent(mosqueId, user.id, {
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dateOfBirth,
      gender,
      parent_id: parentId,
      parent_name: parentName,
      parent_phone: parentPhone,
      address,
      school_name: schoolName,
      school_class: schoolClass,
      health_notes: healthNotes,
      mother_name: motherName,
      mother_phone: motherPhone,
      father_name: fatherName,
      father_phone: fatherPhone,
      membership_status: membershipStatus,
      notes,
      status: "active",
    });

    if (!studentResult.success || !studentResult.data) {
      setError(studentResult.error || "Schüler konnte nicht erstellt werden");
      setIsAdding(false);
      return;
    }

    const enrollResult = await enrollStudent(mosqueId, user.id, {
      course_id: courseId,
      student_id: studentResult.data.id,
      status: "enrolled",
      notes: "",
    });

    if (enrollResult.success) {
      setShowAddForm(false);
      resetForm();
      await loadData();
    } else {
      setError(enrollResult.error || "Einschreibung fehlgeschlagen");
    }
    setIsAdding(false);
  }

  async function handleEnrollExisting() {
    if (!selectedStudentId || !user) return;
    setIsAdding(true);
    setError("");

    const result = await enrollStudent(mosqueId, user.id, {
      course_id: courseId,
      student_id: selectedStudentId,
      status: "enrolled",
      notes: "",
    });

    if (result.success) {
      setShowAddForm(false);
      resetForm();
      await loadData();
    } else {
      setError(result.error || "Einschreibung fehlgeschlagen");
    }
    setIsAdding(false);
  }

  async function handleSaveEdit() {
    if (!user || !editingStudentId || !firstName || !lastName || !dateOfBirth) return;
    setIsEditing(true);
    setError("");

    const result = await updateStudent(editingStudentId, mosqueId, user.id, {
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dateOfBirth,
      gender,
      parent_id: parentId,
      parent_name: parentName,
      parent_phone: parentPhone,
      address,
      school_name: schoolName,
      school_class: schoolClass,
      health_notes: healthNotes,
      mother_name: motherName,
      mother_phone: motherPhone,
      father_name: fatherName,
      father_phone: fatherPhone,
      membership_status: membershipStatus,
      notes,
      status: editStatus,
    });

    if (result.success) {
      setEditingStudentId(null);
      resetForm();
      await loadData();
    } else {
      setError(result.error || "Schüler konnte nicht aktualisiert werden");
    }
    setIsEditing(false);
  }

  async function handleStatusChange(
    enrollmentId: string,
    newStatus: "enrolled" | "completed" | "dropped" | "on_hold"
  ) {
    if (!user) return;
    const result = await updateEnrollmentStatus(enrollmentId, mosqueId, user.id, newStatus);
    if (result.success) {
      await loadData();
    }
  }

  function calculateAge(dob: string): string {
    if (!dob) return "—";
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return `${age} J.`;
  }

  const selectClass = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  // Gemeinsame Formular-Felder (für Add + Edit)
  function renderFormFields() {
    return (
      <>
        {/* Vorname + Nachname */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="form_first_name" className="text-xs">Vorname *</Label>
            <Input
              id="form_first_name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Vorname"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="form_last_name" className="text-xs">Nachname *</Label>
            <Input
              id="form_last_name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Nachname"
              className="h-9"
            />
          </div>
        </div>

        {/* Geburtstag + Geschlecht */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="form_dob" className="text-xs">Geburtstag *</Label>
            <Input
              id="form_dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="form_gender" className="text-xs">Geschlecht</Label>
            <select
              id="form_gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as "" | "male" | "female")}
              className={selectClass}
            >
              <option value="">— nicht angegeben —</option>
              <option value="male">Männlich</option>
              <option value="female">Weiblich</option>
            </select>
          </div>
        </div>

        {/* Elternteil */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="form_parent" className="text-xs">Elternteil (Mitglied)</Label>
            <select
              id="form_parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className={selectClass}
            >
              <option value="">— kein Mitglied —</option>
              {parentCandidates.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="form_parent_name" className="text-xs">
              {parentId ? "oder" : ""} Name der Eltern
            </Label>
            <Input
              id="form_parent_name"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="Vollständiger Name"
              className="h-9"
              disabled={!!parentId}
            />
          </div>
        </div>

        {/* Telefon der Eltern (generisch) */}
        <div className="space-y-1">
          <Label htmlFor="form_phone" className="text-xs">Telefon der Eltern (allgemein)</Label>
          <Input
            id="form_phone"
            type="tel"
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
            placeholder="+49 ..."
            className="h-9"
          />
        </div>

        {/* Adresse */}
        <div className="space-y-1">
          <Label htmlFor="form_address" className="text-xs">Hausanschrift</Label>
          <Input
            id="form_address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Straße, PLZ, Ort"
            className="h-9"
          />
        </div>

        {/* Schule + Klasse */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="form_school" className="text-xs">Besuchte Schule / KiTA</Label>
            <Input
              id="form_school"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="Name der Schule"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="form_class" className="text-xs">Klasse</Label>
            <Input
              id="form_class"
              value={schoolClass}
              onChange={(e) => setSchoolClass(e.target.value)}
              placeholder="z.B. 3a, Kita"
              className="h-9"
            />
          </div>
        </div>

        {/* Mutter */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="form_mother_name" className="text-xs">Name der Mutter</Label>
            <Input
              id="form_mother_name"
              value={motherName}
              onChange={(e) => setMotherName(e.target.value)}
              placeholder="Vorname Nachname"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="form_mother_phone" className="text-xs">Handy Mutter</Label>
            <Input
              id="form_mother_phone"
              type="tel"
              value={motherPhone}
              onChange={(e) => setMotherPhone(e.target.value)}
              placeholder="+49 ..."
              className="h-9"
            />
          </div>
        </div>

        {/* Vater */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="form_father_name" className="text-xs">Name des Vaters</Label>
            <Input
              id="form_father_name"
              value={fatherName}
              onChange={(e) => setFatherName(e.target.value)}
              placeholder="Vorname Nachname"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="form_father_phone" className="text-xs">Handy Vater</Label>
            <Input
              id="form_father_phone"
              type="tel"
              value={fatherPhone}
              onChange={(e) => setFatherPhone(e.target.value)}
              placeholder="+49 ..."
              className="h-9"
            />
          </div>
        </div>

        {/* Gesundheit + Mitgliedschaft */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="form_health" className="text-xs">Gesundheitliche Hinweise</Label>
            <Input
              id="form_health"
              value={healthNotes}
              onChange={(e) => setHealthNotes(e.target.value)}
              placeholder="z.B. Allergie, Asthma"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="form_membership" className="text-xs">Familienmitgliedschaft</Label>
            <select
              id="form_membership"
              value={membershipStatus}
              onChange={(e) => setMembershipStatus(e.target.value as "" | "active" | "none" | "planned")}
              className={selectClass}
            >
              <option value="">— nicht angegeben —</option>
              <option value="active">Vorhanden</option>
              <option value="none">Nicht vorhanden</option>
              <option value="planned">Wird beantragt</option>
            </select>
          </div>
        </div>

        {/* Notizen */}
        <div className="space-y-1">
          <Label htmlFor="form_notes" className="text-xs">Anmerkungen</Label>
          <Input
            id="form_notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Sonstige Hinweise"
            className="h-9"
          />
        </div>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          Schülerliste ({enrollments.filter((e) => e.status === "enrolled").length})
        </h3>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowImportDialog(true)}
            className="gap-1"
            title="Schülerliste aus CSV/Excel importieren"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Importieren</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleShowAdd}
            className="gap-1"
          >
            <UserPlus className="h-4 w-4" />
            Schüler hinzufügen
          </Button>
        </div>
      </div>

      <StudentImportDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        mosqueId={mosqueId}
        courseId={courseId}
        courseTitle={courseTitle}
        onSuccess={loadData}
      />

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Schüler hinzufügen ── */}
      {showAddForm && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-emerald-800">
              Schüler zu &quot;{courseTitle}&quot; hinzufügen
            </p>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setError(""); }}
              className="rounded p-1 text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Formular schließen"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAddMode("new")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                addMode === "new"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              )}
            >
              Neuer Schüler
            </button>
            {existingStudents.length > 0 && (
              <button
                type="button"
                onClick={() => setAddMode("existing")}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  addMode === "existing"
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                )}
              >
                Bestehender Schüler ({existingStudents.length})
              </button>
            )}
          </div>

          {addMode === "new" ? (
            <>
              {renderFormFields()}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleEnrollNew}
                  disabled={!firstName || !lastName || !dateOfBirth || isAdding}
                >
                  {isAdding ? "Wird erstellt…" : "Schüler erstellen & einschreiben"}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className={cn(selectClass, "flex-1")}
              >
                <option value="">— Schüler auswählen —</option>
                {existingStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name}
                    {s.date_of_birth ? ` (${calculateAge(s.date_of_birth)})` : ""}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                onClick={handleEnrollExisting}
                disabled={!selectedStudentId || isAdding}
              >
                {isAdding ? "..." : "Einschreiben"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Schüler bearbeiten ── */}
      {editingStudentId && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Schüler bearbeiten
            </p>
            <button
              type="button"
              onClick={() => { setEditingStudentId(null); resetForm(); setError(""); }}
              className="rounded p-1 text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Bearbeiten schließen"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {isLoadingEdit ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 motion-reduce:animate-none" />
            </div>
          ) : (
            <>
              {renderFormFields()}

              {/* Status */}
              <div className="space-y-1">
                <Label htmlFor="edit_status" className="text-xs">Status</Label>
                <select
                  id="edit_status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as "active" | "inactive")}
                  className={cn(selectClass, "w-40")}
                >
                  <option value="active">Aktiv</option>
                  <option value="inactive">Inaktiv</option>
                </select>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={!firstName || !lastName || !dateOfBirth || isEditing}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isEditing ? "Wird gespeichert…" : "Änderungen speichern"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setEditingStudentId(null); resetForm(); setError(""); }}
                >
                  Abbrechen
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Schülerliste ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600 motion-reduce:animate-none" />
        </div>
      ) : enrollments.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">
          Noch keine Schüler eingeschrieben.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 hidden sm:table-cell">Alter</th>
                <th className="px-3 py-2 hidden md:table-cell">Eltern</th>
                <th className="px-3 py-2 hidden md:table-cell">Telefon</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {enrollments.map((enrollment) => (
                <tr
                  key={enrollment.id}
                  className={cn(
                    "hover:bg-gray-50",
                    editingStudentId === enrollment.student_id && "bg-blue-50"
                  )}
                >
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {enrollment.student_name || enrollment.student_id}
                  </td>
                  <td className="px-3 py-2 hidden sm:table-cell text-gray-500 text-xs">
                    {calculateAge(enrollment.student_date_of_birth || "")}
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell text-gray-500 text-xs">
                    {(() => {
                      const p = getParentInfo(enrollment);
                      return (
                        <span className={enrollment.student_parent_id && enrollment.student_parent_user_name ? "font-medium text-emerald-700" : ""}>
                          {p.name}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell text-gray-500 text-xs">
                    {getParentInfo(enrollment).phone}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        enrollmentStatusColors[enrollment.status] || "bg-gray-100 text-gray-600"
                      )}
                    >
                      {enrollmentStatusLabels[enrollment.status] || enrollment.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {/* Bearbeiten — immer sichtbar */}
                      <button
                        type="button"
                        onClick={() => handleEditClick(enrollment)}
                        className="rounded p-1.5 text-blue-500 hover:bg-blue-50 hover:text-blue-700"
                        title="Schülerdaten bearbeiten"
                        aria-label="Schüler bearbeiten"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      {/* Einschreibungs-Aktionen */}
                      {enrollment.status === "enrolled" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(enrollment.id, "on_hold")}
                            className="rounded px-2 py-1 text-xs text-amber-600 hover:bg-amber-50"
                            title="Pausieren"
                          >
                            Pausieren
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(enrollment.id, "dropped")}
                            className="rounded p-1.5 text-red-600 hover:bg-red-50"
                            title="Abmelden"
                            aria-label="Schüler abmelden"
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {enrollment.status === "on_hold" && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(enrollment.id, "enrolled")}
                          className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50"
                          title="Wieder einschreiben"
                        >
                          Aktivieren
                        </button>
                      )}
                      {enrollment.status === "dropped" && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(enrollment.id, "enrolled")}
                          className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50"
                          title="Erneut einschreiben"
                        >
                          Erneut einschreiben
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
