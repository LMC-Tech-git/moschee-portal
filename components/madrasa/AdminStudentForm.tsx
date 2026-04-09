"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createStudent, updateStudent, getParentCandidates } from "@/lib/actions/students";
import { getTeachersByMosque } from "@/lib/actions/courses";
import {
  getParentsOfStudent,
  linkParentToStudent,
  unlinkParentFromStudent,
} from "@/lib/actions/parent-child";
import { studentSchema, type StudentInput } from "@/lib/validations";
import { RELATION_TYPES } from "@/lib/constants";
import type { Student, User, RelationType } from "@/types";

interface Props {
  mosqueId: string;
  userId: string;
  student?: Student | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface ParentCandidate {
  id: string;
  name: string;
  phone: string;
  address: string;
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
  // Legacy (für Backward-Compat beim Submit)
  parent_id: string;
  parent_name: string;
  parent_phone: string;
  address: string;
  health_notes: string;
  membership_status: "active" | "none" | "planned" | "";
  notes: string;
  status: "active" | "inactive";
  custom_discount_percent: number;
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
    custom_discount_percent: s.custom_discount_percent ?? 0,
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
  custom_discount_percent: 0,
};

export function AdminStudentForm({ mosqueId, userId, student, onSuccess, onCancel }: Props) {
  const t = useTranslations("memberStudent");
  const tAdmin = useTranslations("adminStudent");
  const router = useRouter();
  const isEdit = !!student;

  const [form, setForm] = useState<FormData>(student ? toFormData(student) : emptyForm);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Portal-user selection state
  const [candidates, setCandidates] = useState<ParentCandidate[]>([]);
  const [fatherUser, setFatherUser] = useState<ParentCandidate | null>(null);
  const [motherUser, setMotherUser] = useState<ParentCandidate | null>(null);
  const [originalFatherUserId, setOriginalFatherUserId] = useState<string | null>(null);
  const [originalMotherUserId, setOriginalMotherUserId] = useState<string | null>(null);
  const [fatherQuery, setFatherQuery] = useState("");
  const [motherQuery, setMotherQuery] = useState("");
  const [showFatherDropdown, setShowFatherDropdown] = useState(false);
  const [showMotherDropdown, setShowMotherDropdown] = useState(false);

  useEffect(() => {
    getTeachersByMosque(mosqueId).then((res) => {
      if (res.success && res.data) setTeachers(res.data);
    });
    getParentCandidates(mosqueId).then((res) => {
      if (res.success && res.data) setCandidates(res.data);
    });
  }, [mosqueId]);

  useEffect(() => {
    if (!isEdit || !student || !mosqueId) return;
    getParentsOfStudent(mosqueId, student.id).then((res) => {
      if (!res.success || !res.data) return;
      const fathers = res.data.filter((p) => p.relation_type === "father");
      const mothers = res.data.filter((p) => p.relation_type === "mother");
      const father = fathers[0] ?? null;
      const mother = mothers[0] ?? null;
      if (father) {
        const candidate: ParentCandidate = {
          id: father.id,
          name: `${father.first_name} ${father.last_name}`.trim(),
          phone: father.phone ?? "",
          address: "",
        };
        setFatherUser(candidate);
        setOriginalFatherUserId(father.id);
      }
      if (mother) {
        const candidate: ParentCandidate = {
          id: mother.id,
          name: `${mother.first_name} ${mother.last_name}`.trim(),
          phone: mother.phone ?? "",
          address: "",
        };
        setMotherUser(candidate);
        setOriginalMotherUserId(mother.id);
      }
    });
  }, [isEdit, student?.id, mosqueId]);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  function handleFatherSelect(candidate: ParentCandidate) {
    setFatherUser(candidate);
    setFatherQuery("");
    setShowFatherDropdown(false);
    set("father_name", candidate.name);
    if (candidate.phone) set("father_phone", candidate.phone);
  }

  function clearFatherUser() {
    setFatherUser(null);
    setFatherQuery("");
  }

  function handleMotherSelect(candidate: ParentCandidate) {
    setMotherUser(candidate);
    setMotherQuery("");
    setShowMotherDropdown(false);
    set("mother_name", candidate.name);
    if (candidate.phone) set("mother_phone", candidate.phone);
  }

  function clearMotherUser() {
    setMotherUser(null);
    setMotherQuery("");
  }

  const filteredFatherCandidates = candidates.filter((c) => {
    if (fatherUser?.id === c.id) return false;
    if (motherUser?.id === c.id) return false;
    if (!fatherQuery.trim()) return false;
    const q = fatherQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  const filteredMotherCandidates = candidates.filter((c) => {
    if (motherUser?.id === c.id) return false;
    if (fatherUser?.id === c.id) return false;
    if (!motherQuery.trim()) return false;
    const q = motherQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setSubmitError("");

    // Prevent same person for both roles
    if (fatherUser?.id && fatherUser.id === motherUser?.id) {
      setSubmitError(tAdmin("parentSamePersonError"));
      return;
    }

    const input: StudentInput = {
      ...form,
      last_year_attended: form.last_year_attended ?? false,
      parent_is_member: form.parent_is_member ?? false,
      custom_discount_percent: form.custom_discount_percent ?? 0,
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
        if (!isEdit && result.data?.id) {
          const newId = result.data.id;
          const linkErrors: string[] = [];
          if (fatherUser) {
            const res = await linkParentToStudent(mosqueId, userId, fatherUser.id, newId, RELATION_TYPES.FATHER as RelationType);
            if (!res.success) linkErrors.push(tAdmin("linkFatherError"));
          }
          if (motherUser) {
            const res = await linkParentToStudent(mosqueId, userId, motherUser.id, newId, RELATION_TYPES.MOTHER as RelationType);
            if (!res.success) linkErrors.push(tAdmin("linkMotherError"));
          }
          if (linkErrors.length) {
            setSubmitError(linkErrors.join(", "));
            setIsSubmitting(false);
            router.push(`/admin/madrasa/schueler/${newId}`);
            return;
          }
          router.push(`/admin/madrasa/schueler/${newId}`);
        } else {
          // EDIT mode: handle portal user changes
          const newFatherId = fatherUser?.id ?? null;
          const newMotherId = motherUser?.id ?? null;

          if (newFatherId !== originalFatherUserId) {
            if (originalFatherUserId)
              await unlinkParentFromStudent(mosqueId, userId, originalFatherUserId, student!.id, RELATION_TYPES.FATHER as RelationType);
            if (newFatherId)
              await linkParentToStudent(mosqueId, userId, newFatherId, student!.id, RELATION_TYPES.FATHER as RelationType);
          }
          if (newMotherId !== originalMotherUserId) {
            if (originalMotherUserId)
              await unlinkParentFromStudent(mosqueId, userId, originalMotherUserId, student!.id, RELATION_TYPES.MOTHER as RelationType);
            if (newMotherId)
              await linkParentToStudent(mosqueId, userId, newMotherId, student!.id, RELATION_TYPES.MOTHER as RelationType);
          }
          onSuccess();
        }
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* Elternteil / Kontakt */}
      <div className="border-t pt-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">{tAdmin("parentSection")}</p>

        {/* Portal-User Lookup: Vater */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tAdmin("fatherPortalUser")}
            </label>
            {fatherUser ? (
              <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                <span className="text-sm font-medium text-emerald-800 flex-1">{fatherUser.name}</span>
                <button
                  type="button"
                  onClick={clearFatherUser}
                  className="text-xs text-gray-500 hover:text-red-600 px-2 py-0.5 rounded"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  className={inputCls}
                  placeholder={tAdmin("searchPortalUser")}
                  value={fatherQuery}
                  onChange={(e) => { setFatherQuery(e.target.value); setShowFatherDropdown(true); }}
                  onFocus={() => setShowFatherDropdown(true)}
                  onBlur={() => setTimeout(() => setShowFatherDropdown(false), 200)}
                />
                {showFatherDropdown && filteredFatherCandidates.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredFatherCandidates.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-0"
                        onMouseDown={() => handleFatherSelect(c)}
                      >
                        <span className="font-medium">{c.name}</span>
                        {c.phone && <span className="text-gray-500 text-xs ml-2">{c.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Portal-User Lookup: Mutter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tAdmin("motherPortalUser")}
            </label>
            {motherUser ? (
              <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                <span className="text-sm font-medium text-emerald-800 flex-1">{motherUser.name}</span>
                <button
                  type="button"
                  onClick={clearMotherUser}
                  className="text-xs text-gray-500 hover:text-red-600 px-2 py-0.5 rounded"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  className={inputCls}
                  placeholder={tAdmin("searchPortalUser")}
                  value={motherQuery}
                  onChange={(e) => { setMotherQuery(e.target.value); setShowMotherDropdown(true); }}
                  onFocus={() => setShowMotherDropdown(true)}
                  onBlur={() => setTimeout(() => setShowMotherDropdown(false), 200)}
                />
                {showMotherDropdown && filteredMotherCandidates.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredMotherCandidates.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-0"
                        onMouseDown={() => handleMotherSelect(c)}
                      >
                        <span className="font-medium">{c.name}</span>
                        {c.phone && <span className="text-gray-500 text-xs ml-2">{c.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Namen (Freitext) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("fatherName")}</label>
            <input className={inputCls} value={form.father_name} onChange={(e) => set("father_name", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("motherName")}</label>
            <input className={inputCls} value={form.mother_name} onChange={(e) => set("mother_name", e.target.value)} />
          </div>
        </div>

        {/* WhatsApp-Gruppenbenachrichtigung */}
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

        {(needsMotherPhone || needsFatherPhone) && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {needsFatherPhone && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("fatherPhone")}</label>
                <input type="tel" className={inputCls} value={form.father_phone} onChange={(e) => set("father_phone", e.target.value)} />
                {fieldErr("father_phone")}
              </div>
            )}
            {needsMotherPhone && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("motherPhone")}</label>
                <input type="tel" className={inputCls} value={form.mother_phone} onChange={(e) => set("mother_phone", e.target.value)} />
                {fieldErr("mother_phone")}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* Gebühren & Rabatte */}
      <div className="border-t pt-4 space-y-4">
        <p className="text-sm font-semibold text-gray-700">{tAdmin("feeSection")}</p>
        <div className="max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1">{tAdmin("customDiscountPercent")}</label>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            className={inputCls}
            value={form.custom_discount_percent}
            onChange={(e) => set("custom_discount_percent", Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
          />
          <p className="text-xs text-gray-500 mt-1">{tAdmin("customDiscountPercentDesc")}</p>
          {fieldErr("custom_discount_percent")}
        </div>
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
