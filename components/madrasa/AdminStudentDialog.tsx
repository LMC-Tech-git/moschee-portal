"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { AdminStudentForm } from "./AdminStudentForm";
import type { Student } from "@/types";

interface Props {
  open: boolean;
  mosqueId: string;
  userId: string;
  student?: Student | null;  // null/undefined = create mode
  onClose: () => void;
  onSuccess: () => void;
}

export function AdminStudentDialog({ open, mosqueId, userId, student, onClose, onSuccess }: Props) {
  const tAdmin = useTranslations("adminStudent");

  if (!open) return null;

  const title = student ? tAdmin("editTitle") : tAdmin("createTitle");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5">
          <AdminStudentForm
            mosqueId={mosqueId}
            userId={userId}
            student={student}
            onSuccess={() => {
              onSuccess();
              onClose();
            }}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
