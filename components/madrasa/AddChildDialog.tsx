"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { MemberStudentForm } from "./MemberStudentForm";

interface Props {
  open: boolean;
  parentId: string;
  parentName: string;
  parentPhone: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddChildDialog({ open, parentId, parentName, parentPhone, onClose, onSuccess }: Props) {
  const t = useTranslations("memberStudent");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">{t("title")}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5">
          <p className="mb-5 text-sm text-gray-500">{t("subtitle")}</p>
          <MemberStudentForm
            parentId={parentId}
            parentName={parentName}
            parentPhone={parentPhone}
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
