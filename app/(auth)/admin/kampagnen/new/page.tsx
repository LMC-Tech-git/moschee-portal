"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import { createCampaign } from "@/lib/actions/campaigns";
import { CampaignForm } from "@/components/campaigns/CampaignForm";
import type { CampaignInput } from "@/lib/validations";

export default function NewCampaignPage() {
  const { mosqueId } = useMosque();
  const { user } = useAuth();

  async function handleCreate(data: CampaignInput) {
    if (!user) return { success: false, error: "Nicht eingeloggt" };
    return createCampaign(mosqueId, user.id, data);
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/kampagnen"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück zu Kampagnen
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Neue Kampagne</h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <CampaignForm onSubmit={handleCreate} />
      </div>
    </div>
  );
}
