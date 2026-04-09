"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { createStudent, updateStudent, getParentCandidates } from "@/lib/actions/students";
import { getTeachersByMosque } from "@/lib/actions/courses";
import {
  getParentsOfStudent,
  linkParentToStudent,
  unlinkParentFromStudent,
  type ParentWithRelation,
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
  const tDetail = useTranslations("adminStudentDetail");
  const isEdit = !!student;

  const [form, setForm] = useState<FormData>(student ? toFormData(student) : emptyForm);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Kandidaten für Portal-User-Suche
  const [candidates, setCandidates] = useState<ParentCandidate[]>([]);

  // Flexible Elternverwaltung (junction table)
  const [linkedParents, setLinkedParents] = useState<ParentWithRelation[]>([]);
  const [parentSearch, setParentSearch] = useState("");
  const [pendingCandidateId, setPendingCandidateId] = useState<string | null>(null);
  const [selectedRelationType, setSelectedRelationType] = useState<RelationType | "">("");
  const [isAddingParent, setIsAddingParent] = useState(false);
  const [removingParentId, setRemovingParentId] = useState<string | null>(null);
  // Nur für CREATE-Modus: Eltern puffern bis Schüler-ID bekannt
  const [pendingParents, setPendingParents] = useState<
    { parentId: string; parentName: string; relationType: RelationType }[]
  >([]);

  useEffect(() => {
    getTeachersByMosque(mosqueId).then((res) => {
      if (res.success && res.data) setTeachers(res.data);
    });
    getParentCandidates(mosqueId).then((res) => {
      if (res.success && res.data) setCandidates(res.data);
    });
  }, [mosqueId]);

  useEffect(() => {
    if (!isEdit || !student?.id || !mosqueId) return;
    getParentsOfStudent(mosqueId, student.id).then((res) => {
      if (res.success) setLinkedParents(res.data ?? []);
    });
  }, [isEdit, student?.id, mosqueId]);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  // Bereits verknüpfte IDs (für Filterung der Kandidaten)
  const linkedAndPendingIds = useMemo(() => {
    const ids = new Set<string>();
    linkedParents.forEach((p) => ids.add(p.id));
    pendingParents.forEach((p) => ids.add(p.parentId));
    return ids;
  }, [linkedParents, pendingParents]);

  const filteredParentCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (linkedAndPendingIds.has(c.id)) return false;
      if (!parentSearch.trim()) return false;
      const q = parentSearch.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.phone.includes(q);
    });
  }, [candidates, linkedAndPendingIds, parentSearch]);

  // Edit-Modus: Elternteil sofort in PB hinzufügen
  async function handleAddParent() {
    if (!isEdit || !student || !pendingCandidateId || !selectedRelationType) return;
    setIsAddingParent(true);
    const res = await linkParentToStudent(
      mosqueId,
      userId,
      pendingCandidateId,
      student.id,
      selectedRelationType as RelationType
    );
    if (res.success) {
      const fresh = await getParentsOfStudent(mosqueId, student.id);
      setLinkedParents(fresh.data ?? []);
      setParentSearch("");
      setPendingCandidateId(null);
      setSelectedRelationType("");
    }
    setIsAddingParent(false);
  }

  // Edit-Modus: Elternteil sofort in PB entfernen
  async function handleRemoveLinkedParent(parentUserId: string, relationType: RelationType) {
    if (!isEdit || !student) return;
    setRemovingParentId(parentUserId);
    const res = await unlinkParentFromStudent(mosqueId, userId, parentUserId, student.id, relationType);
    if (res.success) {
      const fresh = await getParentsOfStudent(mosqueId, student.id);
      setLinkedParents(fresh.data ?? []);
    }
    setRemovingParentId(null);
  }

  // Create-Modus: Elternteil in Puffer hinzufügen
  function handleAddPendingParent() {
    if (!pendingCandidateId || !selectedRelationType) return;
    const candidate = candidates.find((c) => c.id === pendingCandidateId);
    if (!candidate) return;
    setPendingParents((prev) => [
      ...prev,
      { parentId: pendingCandidateId, parentName: candidate.name, relationType: selectedRelationType as RelationType },
    ]);
    setParentSearch("");
    setPendingCandidateId(null);
    setSelectedRelationType("");
  }

  function handleRemovePendingParent(parentId: string) {
    setPendingParents((prev) => prev.filter((p) => p.parentId !== parentId));
  }

  const relationLabel: Record<string, string> = {
    father: tDetail("relationFather"),
    mother: tDetail("relationMother"),
    guardian: tDetail("relationGuardian"),
    other: tDetail("relationOther"),
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setSubmitError("");

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
          // Gepufferte Eltern verknüpfen
          for (const p of pendingParents) {
            await linkParentToStudent(mosqueId, userId, p.parentId, newId, p.relationType);
          }
          onSuccess();
        } else {
          // Edit: Elternänderungen wurden bereits sofort gespeichert
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

  const sortedRelationTypes: RelationType[] = [
    RELATION_TYPES.FATHER,
    RELATION_TYPES.MOTHER,
    RELATION_TYPES.GUARDIAN,
    RELATION_TYPES.OTHER,
  ];

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

      {/* Portal-Eltern (junction table) */}
      <div className="border-t pt-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">{tDetail("parentsTitle")}</p>

        {/* Verknüpfte Eltern */}
        {(isEdit ? linkedParents : pendingParents).length === 0 ? (
          <p className="text-sm text-gray-500 mb-3">{tDetail("noParents")}</p>
        ) : (
          <div className="space-y-2 mb-3">
            {isEdit
              ? [...linkedParents]
                  .sort(
                    (a, b) =>
                      sortedRelationTypes.indexOf(a.relation_type) -
                      sortedRelationTypes.indexOf(b.relation_type)
                  )
                  .map((parent) => (
                    <div
                      key={parent.id}
                      className="flex items-center justify-between p-2 rounded-lg border border-gray-200 bg-gray-50"
                    >
                      <div>
                        <span className="text-sm font-medium">
                          {`${parent.first_name} ${parent.last_name}`.trim() || parent.email}
                        </span>
                        <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {relationLabel[parent.relation_type] ?? parent.relation_type}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLinkedParent(parent.id, parent.relation_type)}
                        disabled={removingParentId === parent.id}
                        title={tDetail("removeParentTitle")}
                        className="text-xs text-gray-400 hover:text-red-600 px-2 py-0.5 rounded disabled:opacity-40"
                      >
                        ✕
                      </button>
                    </div>
                  ))
              : pendingParents.map((p) => (
                  <div
                    key={p.parentId}
                    className="flex items-center justify-between p-2 rounded-lg border border-gray-200 bg-gray-50"
                  >
                    <div>
                      <span className="text-sm font-medium">{p.parentName}</span>
                      <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {relationLabel[p.relationType] ?? p.relationType}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePendingParent(p.parentId)}
                      title={tDetail("removeParentTitle")}
                      className="text-xs text-gray-400 hover:text-red-600 px-2 py-0.5 rounded"
                    >
                      ✕
                    </button>
                  </div>
                ))}
          </div>
        )}

        {/* Neuen Elternteil verknüpfen */}
        <p className="text-sm font-medium text-gray-700 mb-1">{tDetail("linkParentTitle")}</p>
        <p className="text-xs text-gray-500 mb-2">{tDetail("linkParentHint")}</p>
        <input
          className={inputCls}
          placeholder={tDetail("searchPlaceholder")}
          value={parentSearch}
          onChange={(e) => {
            setParentSearch(e.target.value);
            setPendingCandidateId(null);
            setSelectedRelationType("");
          }}
        />

        {parentSearch.trim() && (
          <div className="mt-1 border rounded-lg divide-y max-h-40 overflow-y-auto">
            {filteredParentCandidates.length === 0 ? (
              <p className="p-3 text-sm text-gray-500">{tDetail("noResults")}</p>
            ) : (
              filteredParentCandidates.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingCandidateId(c.id);
                      setSelectedRelationType("");
                    }}
                    className="text-xs rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
                  >
                    {tDetail("addButton")}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {pendingCandidateId && (
          <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
            <p className="text-xs font-medium text-blue-800">
              {(() => {
                const c = candidates.find((x) => x.id === pendingCandidateId);
                return c
                  ? tDetail("selectRelation", { name: c.name })
                  : tDetail("selectRelationGeneric");
              })()}
            </p>
            <select
              className={inputCls}
              value={selectedRelationType}
              onChange={(e) => setSelectedRelationType(e.target.value as RelationType | "")}
            >
              <option value="">{tDetail("selectPlaceholder")}</option>
              <option value="father">{tDetail("relationFather")}</option>
              <option value="mother">{tDetail("relationMother")}</option>
              <option value="guardian">{tDetail("relationGuardian")}</option>
              <option value="other">{tDetail("relationOther")}</option>
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!selectedRelationType || isAddingParent}
                onClick={isEdit ? handleAddParent : handleAddPendingParent}
                className="rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {tDetail("confirmAddButton")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingCandidateId(null);
                  setSelectedRelationType("");
                }}
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                {tDetail("cancelButton")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Kontaktinfo (Freetext) */}
      <div className="border-t pt-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">{tAdmin("parentSection")}</p>

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
