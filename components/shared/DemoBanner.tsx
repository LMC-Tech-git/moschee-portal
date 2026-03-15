"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { useMosque } from "@/lib/mosque-context";
import { isDemoMosque } from "@/lib/demo";
import { DemoReturnButton } from "@/components/shared/DemoReturnButton";

export function DemoBanner() {
  const t = useTranslations();
  const { user } = useAuth();
  const { mosqueId } = useMosque();

  const effectiveMosqueId = user?.mosque_id ?? mosqueId;
  if (!effectiveMosqueId || !isDemoMosque(effectiveMosqueId)) return null;

  return (
    <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          <strong>{t("demo.banner.title")}</strong> — {t("demo.banner.message")}
        </span>
      </div>
      <DemoReturnButton />
    </div>
  );
}
