"use client";

import { useState, useEffect, useRef } from "react";
import { Search, CheckCircle, AlertCircle, Loader2, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { getUnenrolledStudents } from "@/lib/actions/students";
import { enrollStudent } from "@/lib/actions/enrollments";
import { useAuth } from "@/lib/auth-context";
import type { Student } from "@/types";

interface Props {
  mosqueId: string;
  courseId: string;
  onSuccess: () => void;
}

function calculateAge(dob: string): string {
  if (!dob) return "";
  const diff = Date.now() - new Date(dob).getTime();
  const age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  return age > 0 ? `${age} J.` : "";
}

export function StudentLookup({ mosqueId, courseId, onSuccess }: Props) {
  const t = useTranslations("studentLookup");
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError("");
    getUnenrolledStudents(courseId, mosqueId).then((res) => {
      if (res.success && res.data) {
        setStudents(res.data);
      } else {
        setLoadError(t("loadError"));
      }
      setLoading(false);
    });
  }, [courseId, mosqueId, t]);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = query.trim()
    ? students.filter((s) => {
        const q = query.toLowerCase();
        const name = `${s.first_name} ${s.last_name}`.toLowerCase();
        const parent = (s.parent_name || "").toLowerCase();
        const mother = (s.mother_name || "").toLowerCase();
        const father = (s.father_name || "").toLowerCase();
        return name.includes(q) || parent.includes(q) || mother.includes(q) || father.includes(q);
      })
    : students;

  async function handleEnroll(student: Student) {
    if (!user || enrollingId) return;
    setEnrollingId(student.id);
    setFeedbackId(null);
    setFeedbackError(null);

    const result = await enrollStudent(mosqueId, user.id, {
      course_id: courseId,
      student_id: student.id,
      status: "enrolled",
      notes: "",
    });

    setEnrollingId(null);
    if (result.success) {
      setStudents((prev) => prev.filter((s) => s.id !== student.id));
      setFeedbackId(student.id);
      setQuery("");
      setOpen(false);
      setTimeout(() => setFeedbackId(null), 2000);
      onSuccess();
    } else {
      setFeedbackError(result.error || t("errorHint"));
      setTimeout(() => setFeedbackError(null), 3000);
    }
  }

  const parentInfo = (s: Student) => {
    if (s.mother_name && s.father_name) return `${s.mother_name} / ${s.father_name}`;
    if (s.mother_name) return s.mother_name;
    if (s.father_name) return s.father_name;
    return s.parent_name || "";
  };

  return (
    <div className="border-t pt-4">
      <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
        <UserPlus className="h-4 w-4 text-emerald-600" />
        {t("sectionTitle")}
      </p>
      <p className="text-xs text-gray-500 mb-3">{t("hint")}</p>

      <div ref={wrapperRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder={loading ? t("loading") : t("placeholder")}
            value={query}
            disabled={loading || !!loadError}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />}
        </div>

        {open && !loading && !loadError && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">
                {students.length === 0 ? t("allEnrolled") : t("noResults")}
              </div>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={enrollingId === s.id}
                  onClick={() => handleEnroll(s)}
                  className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 transition-colors border-b border-gray-100 last:border-0 disabled:opacity-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {s.first_name} {s.last_name}
                      </span>
                      {calculateAge(s.date_of_birth) && (
                        <span className="ml-2 text-xs text-gray-400">{calculateAge(s.date_of_birth)}</span>
                      )}
                      {(s.school_name || s.school_class) && (
                        <span className="ml-2 text-xs text-gray-500">
                          {[s.school_name, s.school_class].filter(Boolean).join(" · ")}
                        </span>
                      )}
                      {parentInfo(s) && (
                        <div className="text-xs text-gray-400">{parentInfo(s)}</div>
                      )}
                    </div>
                    {enrollingId === s.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-600 shrink-0" />
                    ) : (
                      <span className="text-xs text-emerald-600 shrink-0">{t("enrolling").replace("...", "")}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {loadError && (
        <p className="mt-2 flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5" /> {loadError}
        </p>
      )}
      {feedbackId && (
        <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
          <CheckCircle className="h-3.5 w-3.5" /> {t("successHint")}
        </p>
      )}
      {feedbackError && (
        <p className="mt-2 flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5" /> {feedbackError}
        </p>
      )}
    </div>
  );
}
