"use client";

import { ArrowLeft } from "lucide-react";
import { getClientPB } from "@/lib/pocketbase";

export function DemoReturnButton() {
  function handleReturn() {
    getClientPB().authStore.clear();
    window.location.href = "/";
  }
  return (
    <button
      type="button"
      onClick={handleReturn}
      className="flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200"
    >
      <ArrowLeft className="h-3 w-3" />
      Zur Startseite
    </button>
  );
}
