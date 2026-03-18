"use client";

import { useTranslations } from "next-intl";
import { Clock, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const t = useTranslations("member");

  // Pending- oder blockierte User sehen eine Wartestatus-Seite statt der Inhalte
  if (user && user.status !== "active") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-gray-900">{t("pendingTitle")}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{t("pendingDesc")}</p>
          </div>
          <Button variant="outline" onClick={logout} className="gap-2">
            <LogOut className="h-4 w-4" />
            {t("pendingLogout")}
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
