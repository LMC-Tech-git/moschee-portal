"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import { createCourse } from "@/lib/actions/courses";
import { CourseForm } from "@/components/madrasa/CourseForm";
import type { CourseInput } from "@/lib/validations";

export default function NewCoursePage() {
  const { mosqueId } = useMosque();
  const { user } = useAuth();
  const t = useTranslations("madrasa");
  const tCommon = useTranslations("common");

  async function handleCreate(data: CourseInput) {
    if (!user) return { success: false, error: tCommon("notLoggedIn") };
    return createCourse(mosqueId, user.id, data);
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/madrasa"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("new.back")}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t("new.title")}</h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <CourseForm mosqueId={mosqueId} onSubmit={handleCreate} />
      </div>
    </div>
  );
}
