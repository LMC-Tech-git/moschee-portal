"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useMosque } from "@/lib/mosque-context";
import { createStudentByParent } from "@/lib/actions/students";
import { getTeachersByMosque } from "@/lib/actions/courses";
import { memberStudentSchema } from "@/lib/validations";
import type { User } from "@/types";

interface Props {
  parentId: string;
  parentName: string;
  parentPhone: string;
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
  address: string;
  health_notes: string;
  notes: string;
  privacy_accepted: boolean;
};

const initialForm: FormData = {
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
  address: "",
  health_notes: "",
  notes: "",
  privacy_accepted: false,
};

export function MemberStudentForm({ parentId, parentName, parentPhone, onSuccess, onCancel }: Props) {
  const t = useTranslations("memberStudent");
  const locale = useLocale();
  const { mosqueId } = useMosque();
  const [form, setForm] = useState<FormData>(initialForm);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (mosqueId) {
      getTeachersByMosque(mosqueId).then((res) => {
        if (res.success && res.data) setTeachers(res.data);
      });
    }
  }, [mosqueId]);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setSubmitError("");

    const parsed = memberStudentSchema.safeParse({
      ...form,
      parent_id: parentId,
      parent_name: parentName,
      parent_phone: parentPhone,
      last_year_attended: form.last_year_attended ?? false,
      parent_is_member: form.parent_is_member ?? false,
      // not included in StudentInput, handled separately
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        fieldErrors[path] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!mosqueId) return;
    setIsSubmitting(true);
    try {
      const result = await createStudentByParent(mosqueId, parentId, {
        ...parsed.data,
        parent_id: parentId,
        parent_name: parentName,
        parent_phone: parentPhone,
      });
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        setSubmitError(result.error || t("errorTitle"));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="py-8 text-center space-y-2">
        <div className="text-emerald-600 font-semibold text-lg">{t("successTitle")}</div>
        <p className="text-sm text-gray-500">{t("successDesc")}</p>
      </div>
    );
  }

  const needsMotherPhone =
    form.whatsapp_contact === "mother" || form.whatsapp_contact === "both";
  const needsFatherPhone =
    form.whatsapp_contact === "father" || form.whatsapp_contact === "both";

  const privacyPath = locale === "tr" ? "/datenschutz" : "/datenschutz";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basisdaten */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("firstName")} *
          </label>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={form.first_name}
            onChange={(e) => set("first_name", e.target.value)}
          />
          {errors.first_name && <p className="text-xs text-red-600 mt-1">{errors.first_name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("lastName")} *
          </label>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={form.last_name}
            onChange={(e) => set("last_name", e.target.value)}
          />
          {errors.last_name && <p className="text-xs text-red-600 mt-1">{errors.last_name}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("dateOfBirth")} *
          </label>
          <input
            type="date"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={form.date_of_birth}
            onChange={(e) => set("date_of_birth", e.target.value)}
          />
          {errors.date_of_birth && <p className="text-xs text-red-600 mt-1">{errors.date_of_birth}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("gender")}
          </label>
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={form.gender}
            onChange={(e) => set("gender", e.target.value as "male" | "female" | "")}
          >
            <option value="">{t("genderPlaceholder")}</option>
            <option value="male">{t("genderMale")}</option>
            <option value="female">{t("genderFemale")}</option>
          </select>
          {errors.gender && <p className="text-xs text-red-600 mt-1">{errors.gender}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("school")}
          </label>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder={t("schoolPlaceholder")}
            value={form.school_name}
            onChange={(e) => set("school_name", e.target.value)}
          />
          {errors.school_name && <p className="text-xs text-red-600 mt-1">{errors.school_name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("class")}
          </label>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder={t("classPlaceholder")}
            value={form.school_class}
            onChange={(e) => set("school_class", e.target.value)}
          />
          {errors.school_class && <p className="text-xs text-red-600 mt-1">{errors.school_class}</p>}
        </div>
      </div>

      {/* Anschrift */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("address")}
        </label>
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder={t("addressPlaceholder")}
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
        />
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
                name="last_year_attended"
                checked={form.last_year_attended === (val === "true")}
                onChange={() => set("last_year_attended", val === "true")}
                className="accent-emerald-600"
              />
              <span className="text-sm">{val === "true" ? t("lastYearYes") : t("lastYearNo")}</span>
            </label>
          ))}
        </div>
        {errors.last_year_attended && <p className="text-xs text-red-600 mt-1">{errors.last_year_attended}</p>}

        {form.last_year_attended === true && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("lastYearTeacher")}
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.last_year_teacher}
              onChange={(e) => set("last_year_teacher", e.target.value)}
            >
              <option value="">{t("lastYearTeacherPlaceholder")}</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={`${teacher.first_name} ${teacher.last_name}`.trim()}>
                  {`${teacher.first_name} ${teacher.last_name}`.trim()}
                </option>
              ))}
              <option value="other">{t("teacherNotInList")}</option>
            </select>
            {errors.last_year_teacher && (
              <p className="text-xs text-red-600 mt-1">{errors.last_year_teacher}</p>
            )}
          </div>
        )}
      </div>

      {/* WhatsApp-Kontakt */}
      <div className="border-t pt-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">{t("whatsappSection")}</p>
        <label className="block text-sm text-gray-700 mb-2">{t("whatsappContact")}</label>
        <div className="flex gap-4">
          {(["mother", "father", "both"] as const).map((val) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="whatsapp_contact"
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
        {errors.whatsapp_contact && <p className="text-xs text-red-600 mt-1">{errors.whatsapp_contact}</p>}

        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("motherName")}
            </label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.mother_name}
              onChange={(e) => set("mother_name", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("fatherName")}
            </label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.father_name}
              onChange={(e) => set("father_name", e.target.value)}
            />
          </div>
        </div>

        {(needsMotherPhone || needsFatherPhone) && (
          <div className="mt-3 grid grid-cols-2 gap-4">
            {needsMotherPhone && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("motherPhone")}
                </label>
                <input
                  type="tel"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={form.mother_phone}
                  onChange={(e) => set("mother_phone", e.target.value)}
                />
                {errors.mother_phone && <p className="text-xs text-red-600 mt-1">{errors.mother_phone}</p>}
              </div>
            )}
            {needsFatherPhone && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("fatherPhone")}
                </label>
                <input
                  type="tel"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={form.father_phone}
                  onChange={(e) => set("father_phone", e.target.value)}
                />
                {errors.father_phone && <p className="text-xs text-red-600 mt-1">{errors.father_phone}</p>}
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
                name="parent_is_member"
                checked={form.parent_is_member === val}
                onChange={() => set("parent_is_member", val)}
                className="accent-emerald-600"
              />
              <span className="text-sm">{val ? t("parentIsMemberYes") : t("parentIsMemberNo")}</span>
            </label>
          ))}
        </div>
        {errors.parent_is_member && <p className="text-xs text-red-600 mt-1">{errors.parent_is_member}</p>}
      </div>

      {/* Gesundheitshinweise */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t("healthNotes")}</label>
        <textarea
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          rows={2}
          placeholder={t("healthNotesPlaceholder")}
          value={form.health_notes}
          onChange={(e) => set("health_notes", e.target.value)}
        />
      </div>

      {/* Notizen */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t("notes")}</label>
        <textarea
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          rows={2}
          placeholder={t("notesPlaceholder")}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>

      {/* Datenschutz */}
      <div className="border-t pt-4 bg-gray-50 rounded-lg p-4">
        <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
          {t("privacySection")}
        </p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.privacy_accepted}
            onChange={(e) => set("privacy_accepted", e.target.checked)}
            className="mt-0.5 accent-emerald-600"
          />
          <span className="text-sm text-gray-700 leading-relaxed">
            {t("privacyLabel")}{" "}
            <Link href={privacyPath} target="_blank" className="text-emerald-600 underline">
              {t("privacyLinkText")}
            </Link>
          </span>
        </label>
        {errors.privacy_accepted && (
          <p className="text-xs text-red-600 mt-1">{errors.privacy_accepted}</p>
        )}
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
          {locale === "tr" ? "İptal" : "Abbrechen"}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? t("submitting") : t("submit")}
        </button>
      </div>
    </form>
  );
}
