"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import { getCourseById, updateCourse } from "@/lib/actions/courses";
import { CourseForm } from "@/components/madrasa/CourseForm";
import { EnrollmentList } from "@/components/madrasa/EnrollmentList";
import { DemoHint } from "@/components/demo/DemoHint";
import type { Course } from "@/types";
import type { CourseInput } from "@/lib/validations";

export default function EditCoursePage() {
  const t = useTranslations("madrasa");
  const params = useParams();
  const courseId = params.id as string;
  const { mosqueId } = useMosque();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!mosqueId || !courseId) return;

    async function load() {
      const result = await getCourseById(courseId, mosqueId);
      if (result.success && result.data) {
        setCourse(result.data);
      } else {
        setError(result.error || t("courseDetail.notFound"));
      }
      setIsLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mosqueId, courseId]);

  async function handleUpdate(data: CourseInput) {
    if (!user) return { success: false, error: "" };
    return updateCourse(courseId, mosqueId, user.id, data);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error || t("courseDetail.notFound")}</p>
        <Link
          href="/admin/madrasa"
          className="mt-3 inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("courseDetail.backLink")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DemoHint
        id="madrasa-enrollment"
        title={t("courseDetail.demoHintTitle")}
        description={t("courseDetail.demoHintDesc")}
      />
      <div>
        <Link
          href="/admin/madrasa"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("courseDetail.backLink")}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("courseDetail.editTitle")}
        </h1>
      </div>

      {/* Kurs-Formular */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <CourseForm
          mosqueId={mosqueId}
          initialData={course}
          onSubmit={handleUpdate}
          isEdit
        />
      </div>

      {/* Schülerliste */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <EnrollmentList
          courseId={courseId}
          mosqueId={mosqueId}
          courseTitle={course.title}
        />
      </div>
    </div>
  );
}
