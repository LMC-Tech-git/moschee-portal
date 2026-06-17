"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import { createCampaign } from "@/lib/actions/campaigns";
import { CampaignForm } from "@/components/campaigns/CampaignForm";
import type { CampaignInput } from "@/lib/validations";

export default function NewCampaignPage() {
  const { mosqueId } = useMosque();
  const { user } = useAuth();
  const t = useTranslations("campaigns");
  const tCommon = useTranslations("common");
  const tPush = useTranslations("push");
  const [notifyPush, setNotifyPush] = useState(false);

  async function handleCreate(data: CampaignInput, files: FormData) {
    if (!user) return { success: false, error: tCommon("notLoggedIn") };
    return createCampaign(mosqueId, user.id, data, { files, notifyPush });
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/kampagnen"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("new.back")}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t("new.title")}</h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <label className="mb-4 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={notifyPush}
            onChange={(e) => setNotifyPush(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-ring"
          />
          {tPush("send.optIn")}
        </label>
        <CampaignForm onSubmit={handleCreate} />
      </div>
    </div>
  );
}
