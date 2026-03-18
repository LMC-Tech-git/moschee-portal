"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { createStudent, updateStudent, getParentCandidates } from "@/lib/actions/students";
import { getTeachersByMosque } from "@/lib/actions/courses";
import { studentSchema, type StudentInput } from "@/lib/validations";
import type { Student, User } from "@/types";

interface ParentCandidate {
  id: string;
  name: string;
  phone: string;
}

interface Props {
  mosqueId: string;
  userId: string;
  student?: Student | null;     // undefined/null = create mode
  onSuccess: () => void;
  onCancel: () => void;
}

type FormData = {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: "male" | "female" | "";
  school_name: string;
  school_class: string;
  last_year_attended: boolean | null;
  last_year_teacher: string;
  whatsapp_contact: "mother" | "father" | "both" | "";
  mother_name: string;
  mother_phone: string;
  father_name: string;
  father_phone: string;
  parent_is_member: boolean | null;
  parent_id: string;
  parent_name: string;
  parent_phone: string;
  address: string;
  health_notes: string;
  membership_status: "active" | "none" | "planned" | "";
  notes: string;
  status: "active" | "inactive";
};

function toFormData(s: Student): FormData {
  return {
    first_name: s.first_name,
    last_name: s.last_name,
    date_of_birth: s.date_of_birth,
    gender: (s.gender as "male" | "female" | "") || "",
    school_name: s.school_name,
    school_class: s.school_class,
    last_year_attended: s.last_year_attended,
    last_year_teacher: s.last_year_teacher,
    whatsapp_contact: (s.whatsapp_contact as "mother" | "father" | "both" | "") || "",
    mother_name: s.mother_name,
    mother_phone: s.mother_phone,
    father_name: s.father_name,
    father_phone: s.father_phone,
    parent_is_member: s.parent_is_member,
    parent_id: s.parent_id,
    parent_name: s.parent_name,
    parent_phone: s.parent_phone,
    address: s.address,
    health_notes: s.health_notes,
    membership_status: (s.membership_status as "active" | "none" | "planned" | "") || "",
    notes: s.notes,
    status: s.status === "inactive" ? "inactive" : "active",
  };
}

const emptyForm: FormData = {
  first_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "",
  school_name: "",
  school_class: "",
  last_year_attended: null,
  last_year_teacher: "",
  whatsapp_contact: "",
  mother_name: "",
  mother_phone: "",
  father_name: "",
  father_phone: "",
  parent_is_member: null,
  parent_id: "",
  parent_name: "",
  parent_phone: "",
  address: "",
  health_notes: "",
  membership_status: "",
  notes: "",
  status: "active",
};

export function AdminStudentForm({ mosqueId, userId, student, onSuccess, onCancel }: Props) {
  const t = useTranslations("memberStudent");
  const tAdmin = useTranslations("adminStudent");
  const isEdit = !!student;

  const [form, setForm] = useState<FormData>(student ? toFormData(student) : emptyForm);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [parents, setParents] = useState<ParentCandidate[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    getTeachersByMosque(mosqueId).then((res) => {
      if (res.success && res.data) setTeachers(res.data);
    });
    getParentCandidates(mosqueId).then((res) => {
      if (res.success && res.data) setParents(res.data);
    });
  }, [mosqueId]);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  function handleParentSelect(parentId: string) {
    set("parent_id", parentId);
    if (!parentId) return;
    const found = parents.find((p) => p.id === parentId);
    if (found) {
      set("parent_name", found.name);
      if (found.phone) {
        set("mother_phone", found.phone);
        set("father_phone", found.phone);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setSubmitError("");

    const input: StudentInput = {
      ...form,
      last_year_attended: form.last_year_attended ?? false,
      parent_is_member: form.parent_is_member ?? false,
    };

    const parsed = studentSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        if (!fieldErrors[path]) fieldErrors[path] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = isEdit && student
        ? await updateStudent(student.id, mosqueId, userId, parsed.data)
        : await createStudent(mosqueId, userId, parsed.data);

      if (result.success) {
        onSuccess();
      } else {
        setSubmitError(result.error || "Fehler beim Speichern");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const needsMotherPhone = form.whatsapp_contact === "mother" || form.whatsapp_contact === "both";
  const needsFatherPhone = form.whatsapp_contact === "father" || form.whatsapp_contact === "both";

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const fieldErr = (key: string) =>
    errors[key] ? <p className="text-xs text-red-600 mt-1">{errors[key]}</p> : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basisdaten */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("firstName")} *</label>
          <input className={inputCls} value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
          {fieldErr("first_name")}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("lastName")} *</label>
          <input className={inputCls} value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
          {fieldErr("last_name")}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("dateOfBirth")} *</label>
          <input type="date" className={inputCls} value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
          {fieldErr("date_of_birth")}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("gender")}</label>
          <select className={inputCls} value={form.gender} onChange={(e) => set("gender", e.target.value as "male" | "female" | "")}>
            <option value="">{t("genderPlaceholder")}</option>
            <option value="male">{t("genderMale")}</option>
            <option value="female">{t("genderFemale")}</option>
          </select>
          {fieldErr("gender")}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("school")}</label>
          <input className={inputCls} placeholder={t("schoolPlaceholder")} value={form.school_name} onChange={(e) => set("school_name", e.target.value)} />
          {fieldErr("school_name")}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("class")}</label>
          <input className={inputCls} placeholder={t("classPlaceholder")} value={form.school_class} onChange={(e) => set("school_class", e.target.value)} />
          {fieldErr("school_class")}
        </div>
      </div>

      {/* Letztes Schuljahr */}
      <div className="border-t pt-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">{t("lastYearSection")}</p>
        <label className="block text-sm text-gray-700 mb-2">{t("lastYearAttended")}</label>
        <div className="flex gap-4">
          {(["true", "false"] as const).map((val) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="last_year_attended_admin"
                checked={form.last_year_attended === (val === "true")}
                onChange={() => set("last_year_attended", val === "true")}
                className="accent-emerald-600"
              />
              <span className="text-sm">{val === "true" ? t("lastYearYes") : t("lastYearNo")}</span>
            </label>
          ))}
        </div>
        {fieldErr("last_year_attended")}

        {form.last_year_attended === true && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("lastYearTeacher")}</label>
            <select className={inputCls} value={form.last_year_teacher} onChange={(e) => set("last_year_teacher", e.target.value)}>
              <option value="">{t("lastYearTeacherPlaceholder")}</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={`${teacher.first_name} ${teacher.last_name}`.trim()}>
                  {`${teacher.first_name} ${teacher.last_name}`.trim()}
                </option>
              ))}
              <option value="other">{t("teacherNotInList")}</option>
            </select>
            {fieldErr("last_year_teacher")}
          </div>
        )}
      </div>

      {/* WhatsApp */}
      <div className="border-t pt-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">{t("whatsappSection")}</p>
        <label className="block text-sm text-gray-700 mb-2">{t("whatsappContact")}</label>
        <div className="flex gap-4">
          {(["mother", "father", "both"] as const).map((val) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="whatsapp_contact_admin"
                checked={form.whatsapp_contact === val}
                onChange={() => set("whatsapp_contact", val)}
                className="accent-emerald-600"
              />
              <span className="text-sm">
                {val === "mother" ? t("whatsappMother") : val === "father" ? t("whatsappFather") : t("whatsappBoth")}
              </span>
            </label>
          ))}
        </div>
        {fieldErr("whatsapp_contact")}

        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("motherName")}</label>
            <input className={inputCls} value={form.mother_name} onChange={(e) => set("mother_name", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("fatherName")}</label>
            <input className={inputCls} value={form.father_name} onChange={(e) => set("father_name", e.target.value)} />
          </div>
        </div>

        {(needsMotherPhone || needsFatherPhone) && (
          <div className="mt-3 grid grid-cols-2 gap-4">
            {needsMotherPhone && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("motherPhone")}</label>
                <input type="tel" className={inputCls} value={form.mother_phone} onChange={(e) => set("mother_phone", e.target.value)} />
                {fieldErr("mother_phone")}
              </div>
            )}
            {needsFatherPhone && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("fatherPhone")}</label>
                <input type="tel" className={inputCls} value={form.father_phone} onChange={(e) => set("father_phone", e.target.value)} />
                {fieldErr("father_phone")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mitgliedschaft */}
      <div className="border-t pt-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">{t("parentSection")}</p>
        <label className="block text-sm text-gray-700 mb-2">{t("parentIsMember")}</label>
        <div className="flex gap-4">
          {([true, false] as const).map((val) => (
            <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="parent_is_member_admin"
                checked={form.parent_is_member === val}
                onChange={() => set("parent_is_member", val)}
                className="accent-emerald-600"
              />
              <span className="text-sm">{val ? t("parentIsMemberYes") : t("parentIsMemberNo")}</span>
            </label>
          ))}
        </div>
        {fieldErr("parent_is_member")}
      </div>

      {/* Admin-Extras */}
      <div className="border-t pt-4 space-y-4">
        <p className="text-sm font-semibold text-gray-700">{tAdmin("adminSection")}</p>

        {/* Portal-Benutzer (Elternteil) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{tAdmin("parentPortalUser")}</label>
          <select
            className={inputCls}
            value={form.parent_id}
            onChange={(e) => handleParentSelect(e.target.value)}
          >
            <option value="">{tAdmin("parentPortalUserNone")}</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {form.parent_id && (
            <p className="text-xs text-gray-500 mt-1">{tAdmin("parentPortalUserHint")}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tAdmin("address")}</label>
            <input className={inputCls} placeholder={tAdmin("addressPlaceholder")} value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tAdmin("membershipStatus")}</label>
            <select
              className={inputCls}
              value={form.membership_status}
              onChange={(e) => set("membership_status", e.target.value as "active" | "none" | "planned" | "")}
            >
              <option value=""></option>
              <option value="active">{tAdmin("membershipStatusActive")}</option>
              <option value="none">{tAdmin("membershipStatusNone")}</option>
              <option value="planned">{tAdmin("membershipStatusPlanned")}</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{tAdmin("healthNotes")}</label>
          <textarea
            className={inputCls}
            rows={2}
            placeholder={tAdmin("healthNotesPlaceholder")}
            value={form.health_notes}
            onChange={(e) => set("health_notes", e.target.value)}
          />
        </div>

        {isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tAdmin("statusLabel")}</label>
            <select
              className={inputCls}
              value={form.status}
              onChange={(e) => set("status", e.target.value as "active" | "inactive")}
            >
              <option value="active">Aktiv</option>
              <option value="inactive">Inaktiv</option>
            </select>
          </div>
        )}
      </div>

      {/* Notizen */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t("notes")}</label>
        <textarea
          className={inputCls}
          rows={2}
          placeholder={t("notesPlaceholder")}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>

      {submitError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? "Speichern..." : isEdit ? tAdmin("editTitle") : tAdmin("createTitle")}
        </button>
      </div>
    </form>
  );
}
