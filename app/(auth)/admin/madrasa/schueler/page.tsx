"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Search, Pencil, UserCheck, UserX, Baby, X } from "lucide-react";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import { getStudentsByMosque, updateStudent } from "@/lib/actions/students";
import type { Student } from "@/types";
import type { StudentInput } from "@/lib/validations";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function AdminStudentsPage() {
  const t = useTranslations("adminStudents");
  const tL = useTranslations("labels");
  const locale = useLocale();
  const { mosqueId } = useMosque();
  const { user } = useAuth();

  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const intlLocale = locale === "tr" ? "tr-TR" : "de-DE";

  async function loadStudents() {
    if (!mosqueId) return;
    setIsLoading(true);
    const result = await getStudentsByMosque(mosqueId, showInactive);
    if (result.success && result.data) setStudents(result.data);
    setIsLoading(false);
  }

  useEffect(() => {
    loadStudents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mosqueId, showInactive]);

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        s.first_name.toLowerCase().includes(q) ||
        s.last_name.toLowerCase().includes(q) ||
        (s.parent_name || "").toLowerCase().includes(q)
    );
  }, [students, search]);

  async function handleToggleStatus(student: Student) {
    if (!mosqueId || !user) return;
    const newStatus = student.status === "active" ? "inactive" : "active";
    const input: StudentInput = {
      first_name: student.first_name,
      last_name: student.last_name,
      date_of_birth: student.date_of_birth,
      gender: (student.gender as "male" | "female" | "") || "",
      parent_id: student.parent_id || "",
      parent_name: student.parent_name || "",
      parent_phone: student.parent_phone || "",
      address: student.address || "",
      school_name: student.school_name || "",
      school_class: student.school_class || "",
      health_notes: student.health_notes || "",
      mother_name: student.mother_name || "",
      mother_phone: student.mother_phone || "",
      father_name: student.father_name || "",
      father_phone: student.father_phone || "",
      membership_status: (student.membership_status as "active" | "none" | "planned" | "") || "",
      last_year_attended: student.last_year_attended ?? false,
      last_year_teacher: student.last_year_teacher || "",
      whatsapp_contact: (student.whatsapp_contact as "mother" | "father" | "both" | "") || "",
      parent_is_member: student.parent_is_member ?? false,
      notes: student.notes || "",
      status: newStatus,
    };
    await updateStudent(student.id, mosqueId, user.id, input);
    await loadStudents();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
      </div>

      {/* Filter-Bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="accent-emerald-600"
          />
          {t("showInactive")}
        </label>
        <span className="text-sm text-gray-400">
          {filtered.length} / {students.length}
        </span>
      </div>

      {/* Tabelle */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          <Baby className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          {t("noStudents")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">{t("columns.name")}</th>
                <th className="hidden px-4 py-3 text-left sm:table-cell">{t("columns.school")}</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">{t("columns.parent")}</th>
                <th className="px-4 py-3 text-left">{t("columns.status")}</th>
                <th className="px-4 py-3 text-right">{t("columns.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {student.first_name} {student.last_name}
                    </div>
                    {student.date_of_birth && (
                      <div className="text-xs text-gray-400">
                        {new Date(student.date_of_birth).toLocaleDateString(intlLocale)}
                      </div>
                    )}
                    {student.last_year_attended && (
                      <div className="text-xs text-emerald-600">
                        {t("lastYearAttended")}: {t("yes")}
                      </div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <div className="text-gray-700">{student.school_name || "—"}</div>
                    {student.school_class && (
                      <div className="text-xs text-gray-400">{student.school_class}</div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="text-gray-700">{student.parent_name || "—"}</div>
                    {student.parent_is_member && (
                      <div className="text-xs text-emerald-600">{t("parentIsMember")}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        student.status === "active"
                          ? "bg-emerald-100 text-emerald-700 border-0"
                          : "bg-gray-100 text-gray-500 border-0"
                      }
                    >
                      {tL(`student.status.${student.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        title={t("editTitle")}
                        onClick={() => setEditingStudent(student)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        title={student.status === "active" ? t("deactivate") : t("activate")}
                        onClick={() => handleToggleStatus(student)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                      >
                        {student.status === "active" ? (
                          <UserX className="h-4 w-4" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingStudent && mosqueId && (
        <AdminStudentEditDialog
          student={editingStudent}
          mosqueId={mosqueId}
          userId={user?.id || ""}
          onClose={() => setEditingStudent(null)}
          onSaved={async () => {
            setEditingStudent(null);
            await loadStudents();
          }}
        />
      )}
    </div>
  );
}

function AdminStudentEditDialog({
  student,
  mosqueId,
  userId,
  onClose,
  onSaved,
}: {
  student: Student;
  mosqueId: string;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("adminStudents");
  const tL = useTranslations("labels");
  const [form, setForm] = useState<StudentInput>({
    first_name: student.first_name || "",
    last_name: student.last_name || "",
    date_of_birth: student.date_of_birth || "",
    gender: (student.gender as "male" | "female" | "") || "",
    parent_id: student.parent_id || "",
    parent_name: student.parent_name || "",
    parent_phone: student.parent_phone || "",
    address: student.address || "",
    school_name: student.school_name || "",
    school_class: student.school_class || "",
    health_notes: student.health_notes || "",
    mother_name: student.mother_name || "",
    mother_phone: student.mother_phone || "",
    father_name: student.father_name || "",
    father_phone: student.father_phone || "",
    membership_status: (student.membership_status as "active" | "none" | "planned" | "") || "",
    last_year_attended: student.last_year_attended ?? false,
    last_year_teacher: student.last_year_teacher || "",
    whatsapp_contact: (student.whatsapp_contact as "mother" | "father" | "both" | "") || "",
    parent_is_member: student.parent_is_member ?? false,
    notes: student.notes || "",
    status: student.status || "active",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  function setField<K extends keyof StudentInput>(key: K, value: StudentInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    const result = await updateStudent(student.id, mosqueId, userId, form);
    setIsSubmitting(false);
    if (result.success) {
      onSaved();
    } else {
      setError(result.error || "Fehler beim Speichern");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">{t("editTitle")}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {(["first_name", "last_name"] as const).map((key) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {key === "first_name" ? "Vorname" : "Nachname"}
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={form[key]}
                  onChange={(e) => setField(key, e.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Geburtsdatum</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.date_of_birth}
                onChange={(e) => setField("date_of_birth", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Geschlecht</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.gender}
                onChange={(e) => setField("gender", e.target.value as "male" | "female" | "")}
              >
                <option value="">—</option>
                <option value="male">{tL("gender.male")}</option>
                <option value="female">{tL("gender.female")}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schule / KITA</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.school_name}
                onChange={(e) => setField("school_name", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Klasse</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.school_class}
                onChange={(e) => setField("school_class", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Elternname</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.parent_name}
                onChange={(e) => setField("parent_name", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Elterntelefon</label>
              <input
                type="tel"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.parent_phone}
                onChange={(e) => setField("parent_phone", e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.last_year_attended}
                onChange={(e) => setField("last_year_attended", e.target.checked)}
                className="accent-emerald-600"
              />
              {t("lastYearAttended")}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.parent_is_member}
                onChange={(e) => setField("parent_is_member", e.target.checked)}
                className="accent-emerald-600"
              />
              {t("parentIsMember")}
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.status}
              onChange={(e) => setField("status", e.target.value as "active" | "inactive")}
            >
              <option value="active">{tL("student.status.active")}</option>
              <option value="inactive">{tL("student.status.inactive")}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={2}
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
            />
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSubmitting ? "Speichern..." : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
