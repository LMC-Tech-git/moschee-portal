"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useMosque } from "@/lib/mosque-context";
import { useAuth } from "@/lib/auth-context";
import { getCampaignById, updateCampaign } from "@/lib/actions/campaigns";
import { CampaignForm } from "@/components/campaigns/CampaignForm";
import type { Campaign } from "@/types";
import type { CampaignInput } from "@/lib/validations";

export default function EditCampaignPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const { mosqueId } = useMosque();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!mosqueId || !campaignId) return;

    async function load() {
      const result = await getCampaignById(campaignId, mosqueId);
      if (result.success && result.data) {
        setCampaign(result.data);
      } else {
        setError(result.error || "Kampagne nicht gefunden");
      }
      setIsLoading(false);
    }
    load();
  }, [mosqueId, campaignId]);

  async function handleUpdate(data: CampaignInput) {
    if (!user) return { success: false, error: "Nicht eingeloggt" };
    return updateCampaign(campaignId, mosqueId, user.id, data);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error || "Kampagne nicht gefunden"}</p>
        <Link
          href="/admin/kampagnen"
          className="mt-3 inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück zu Kampagnen
        </Link>
      </div>
    );
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
        <h1 className="text-2xl font-bold text-gray-900">
          Kampagne bearbeiten
        </h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <CampaignForm initialData={campaign} onSubmit={handleUpdate} isEdit />
      </div>
    </div>
  );
}
