"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Users, UserMinus, Pencil } from "lucide-react";
import { AdminStudentDialog } from "@/components/madrasa/AdminStudentDialog";
import { StudentLookup } from "@/components/madrasa/StudentLookup";
import { useAuth } from "@/lib/auth-context";
import {
  getEnrollmentsByCourse,
  updateEnrollmentStatus,
} from "@/lib/actions/enrollments";
import { getStudentById } from "@/lib/actions/students";
import { cn } from "@/lib/utils";
import { enrollmentStatusColors } from "@/lib/constants";
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
  if (e.student_parent_id && e.student_parent_user_name) {
    return { name: e.student_parent_user_name, phone: e.student_parent_phone || "—" };
  }
  const fatherName = e.student_father_name?.trim();
  const motherName = e.student_mother_name?.trim();
  if (fatherName || motherName) {
    return {
      name: [fatherName, motherName].filter(Boolean).join(" / "),
      phone: [e.student_father_phone, e.student_mother_phone].filter(Boolean).join(" / ") || e.student_parent_phone || "—",
    };
  }
  return { name: e.student_parent_name || "—", phone: e.student_parent_phone || "—" };
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

export function EnrollmentList({ courseId, mosqueId, courseTitle }: EnrollmentListProps) {
  const t = useTranslations("enrollment");
  const tL = useTranslations("labels");
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<EnrollmentWithStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit dialog
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

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

  async function handleEditClick(enrollment: EnrollmentWithStudent) {
    if (!user) return;
    const result = await getStudentById(enrollment.student_id, mosqueId);
    if (result.success && result.data) {
      setEditStudent(result.data);
      setEditDialogOpen(true);
    }
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          {t("title")} ({enrollments.filter((e) => e.status === "enrolled").length})
        </h3>
      </div>

      {/* Student Lookup — search & enroll */}
      {user && (
        <StudentLookup
          mosqueId={mosqueId}
          courseId={courseId}
          onSuccess={loadData}
        />
      )}

      {/* Edit Dialog */}
      {user && (
        <AdminStudentDialog
          open={editDialogOpen}
          mosqueId={mosqueId}
          userId={user.id}
          student={editStudent}
          onClose={() => { setEditDialogOpen(false); setEditStudent(null); }}
          onSuccess={() => { loadData(); }}
        />
      )}

      {/* Enrollment table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600 motion-reduce:animate-none" />
        </div>
      ) : enrollments.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">
          {t("empty")}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-3 py-2">{t("colName")}</th>
                <th className="px-3 py-2 hidden sm:table-cell">{t("colAge")}</th>
                <th className="px-3 py-2 hidden md:table-cell">{t("colParent")}</th>
                <th className="px-3 py-2 hidden md:table-cell">{t("colPhone")}</th>
                <th className="px-3 py-2">{t("colStatus")}</th>
                <th className="px-3 py-2 text-right">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {enrollments.map((enrollment) => (
                <tr key={enrollment.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {enrollment.student_name || enrollment.student_id}
                  </td>
                  <td className="px-3 py-2 hidden sm:table-cell text-gray-500 text-xs">
                    {calculateAge(enrollment.student_date_of_birth || "")}
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell text-gray-500 text-xs">
                    <span className={enrollment.student_parent_id && enrollment.student_parent_user_name ? "font-medium text-emerald-700" : ""}>
                      {getParentInfo(enrollment).name}
                    </span>
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
                      {tL(`enrollment.status.${enrollment.status}`) || enrollment.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleEditClick(enrollment)}
                        className="rounded p-1.5 text-blue-500 hover:bg-blue-50 hover:text-blue-700"
                        title={t("editStudent")}
                        aria-label={t("editStudent")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      {enrollment.status === "enrolled" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(enrollment.id, "on_hold")}
                            className="rounded px-2 py-1 text-xs text-amber-600 hover:bg-amber-50"
                            title={t("pause")}
                          >
                            {t("pause")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(enrollment.id, "dropped")}
                            className="rounded p-1.5 text-red-600 hover:bg-red-50"
                            title={t("unenroll")}
                            aria-label={t("unenroll")}
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
                          title={t("activate")}
                        >
                          {t("activate")}
                        </button>
                      )}
                      {enrollment.status === "dropped" && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(enrollment.id, "enrolled")}
                          className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50"
                          title={t("reenroll")}
                        >
                          {t("reenroll")}
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
