"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { getClientPB } from "@/lib/pocketbase";

export function DemoReturnButton() {
  const t = useTranslations("demo.banner");

  function handleReturn() {
    getClientPB().authStore.clear();
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    window.location.href = rootDomain ? `https://${rootDomain}?noredirect=1` : "/?noredirect=1";
  }
  return (
    <button
      type="button"
      onClick={handleReturn}
      className="flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200"
    >
      <ArrowLeft className="h-3 w-3" />
      {t("returnToHome")}
    </button>
  );
}
