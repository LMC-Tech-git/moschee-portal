"use client";

import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const t = useTranslations("member");

  return (
    <>
      {user && user.status === "pending" && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-center text-sm text-amber-800">
          <Clock className="inline h-4 w-4 mr-1.5 align-text-bottom" />
          {t("pendingBanner")}
        </div>
      )}
      {children}
    </>
  );
}
