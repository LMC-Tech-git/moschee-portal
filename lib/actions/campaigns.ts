"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { campaignSchema, type CampaignInput } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import type { Campaign, CampaignWithProgress } from "@/types";
import type { RecordModel } from "pocketbase";

// --- Helpers ---

function mapRecordToCampaign(record: RecordModel): Campaign {
  return {
    id: record.id,
    mosque_id: record.mosque_id || "",
    title: record.title || "",
    description: record.description || "",
    category: record.category || "general",
    goal_amount_cents: record.goal_amount_cents || 0,
    currency: record.currency || "EUR",
    start_at: record.start_at || "",
    end_at: record.end_at || "",
    status: record.status || "active",
    cover_image: record.cover_image || "",
    created_by: record.created_by || "",
    created: record.created || "",
    updated: record.updated || "",
  };
}

/**
 * Fortschritt einer Kampagne berechnen.
 * Progress = SUM(donations.amount_cents WHERE status = 'paid')
 */
async function computeProgress(
  campaignId: string
): Promise<{ raised_cents: number; donor_count: number }> {
  try {
    const pb = await getAdminPB();

    // Alle Spenden der Kampagne laden, Status-Filter in JS.
    // Workaround für ältere PocketBase-Versionen: kombinierte Relation+Status-Filter
    // können unzuverlässig sein. Außerdem: campaign_id kann String oder Array sein.
    const allForCampaign = await pb.collection("donations").getFullList({
      filter: `campaign_id = "${campaignId}"`,
      fields: "amount,amount_cents,status,donor_email",
    });

    const paid = allForCampaign.filter((d) => d.status === "paid");

    const raised_cents = paid.reduce(
      (sum, d) => sum + (d.amount_cents || Math.round((d.amount || 0) * 100)),
      0
    );
    const uniqueDonors = new Set(paid.map((d) => d.donor_email));

    return { raised_cents, donor_count: uniqueDonors.size };
  } catch {
    return { raised_cents: 0, donor_count: 0 };
  }
}

// --- Server Actions ---

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Alle Kampagnen einer Moschee laden (Admin).
 */
export async function getCampaignsByMosque(
  mosqueId: string,
  options?: { status?: "active" | "paused" | "completed"; page?: number; limit?: number }
): Promise<ActionResult<CampaignWithProgress[]> & { totalPages?: number; page?: number }> {
  try {
    const pb = await getAdminPB();
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    let filter = `mosque_id = "${mosqueId}"`;
    if (options?.status) {
      filter += ` && status = "${options.status}"`;
    }

    const records = await pb.collection("campaigns").getList(page, limit, {
      filter,
      sort: "-created",
    });

    const campaigns: CampaignWithProgress[] = await Promise.all(
      records.items.map(async (record) => {
        const campaign = mapRecordToCampaign(record);
        const progress = await computeProgress(campaign.id);
        const progressPercent =
          campaign.goal_amount_cents > 0
            ? Math.min(
                100,
                Math.round(
                  (progress.raised_cents / campaign.goal_amount_cents) * 100
                )
              )
            : 0;

        return {
          ...campaign,
          raised_cents: progress.raised_cents,
          donor_count: progress.donor_count,
          progress_percent: progressPercent,
        };
      })
    );

    return {
      success: true,
      data: campaigns,
      totalPages: records.totalPages,
      page: records.page,
    };
  } catch (error) {
    console.error("[Campaigns] Fehler beim Laden:", error);
    return { success: false, error: "Kampagnen konnten nicht geladen werden" };
  }
}

/**
 * Öffentliche aktive Kampagnen einer Moschee laden.
 */
export async function getPublicCampaigns(
  mosqueId: string,
  limit = 10
): Promise<ActionResult<CampaignWithProgress[]>> {
  try {
    const pb = await getAdminPB();

    const records = await pb.collection("campaigns").getList(1, limit, {
      filter: `mosque_id = "${mosqueId}" && status = "active"`,
      sort: "-created",
    });

    const campaigns: CampaignWithProgress[] = await Promise.all(
      records.items.map(async (record) => {
        const campaign = mapRecordToCampaign(record);
        const progress = await computeProgress(campaign.id);
        const progressPercent =
          campaign.goal_amount_cents > 0
            ? Math.min(
                100,
                Math.round(
                  (progress.raised_cents / campaign.goal_amount_cents) * 100
                )
              )
            : 0;

        return {
          ...campaign,
          raised_cents: progress.raised_cents,
          donor_count: progress.donor_count,
          progress_percent: progressPercent,
        };
      })
    );

    return { success: true, data: campaigns };
  } catch (error) {
    console.error("[Campaigns] Fehler:", error);
    return { success: false, error: "Kampagnen konnten nicht geladen werden" };
  }
}

/**
 * Einzelne Kampagne laden.
 */
export async function getCampaignById(
  campaignId: string,
  mosqueId: string
): Promise<ActionResult<CampaignWithProgress>> {
  try {
    const pb = await getAdminPB();
    const record = await pb.collection("campaigns").getOne(campaignId);

    if (record.mosque_id !== mosqueId) {
      return { success: false, error: "Kampagne nicht gefunden" };
    }

    const campaign = mapRecordToCampaign(record);
    const progress = await computeProgress(campaign.id);
    const progressPercent =
      campaign.goal_amount_cents > 0
        ? Math.min(
            100,
            Math.round(
              (progress.raised_cents / campaign.goal_amount_cents) * 100
            )
          )
        : 0;

    return {
      success: true,
      data: {
        ...campaign,
        raised_cents: progress.raised_cents,
        donor_count: progress.donor_count,
        progress_percent: progressPercent,
      },
    };
  } catch (error) {
    console.error("[Campaigns] Fehler:", error);
    return { success: false, error: "Kampagne konnte nicht geladen werden" };
  }
}

/**
 * Neue Kampagne erstellen.
 */
export async function createCampaign(
  mosqueId: string,
  userId: string,
  input: CampaignInput
): Promise<ActionResult<Campaign>> {
  try {
    const validated = campaignSchema.parse(input);
    const pb = await getAdminPB();

    const record = await pb.collection("campaigns").create({
      ...validated,
      currency: "EUR",
      mosque_id: mosqueId,
      created_by: userId,
      type: "general",       // PB-Pflichtfeld
      visibility: "public",  // PB-Pflichtfeld
    });

    await logAudit({
      mosqueId,
      userId,
      action: "campaign.created",
      entityType: "campaign",
      entityId: record.id,
      after: {
        title: validated.title,
        description: validated.description,
        category: validated.category,
        goal_amount_cents: validated.goal_amount_cents,
        status: validated.status,
        start_at: validated.start_at,
        end_at: validated.end_at,
      },
    });

    return { success: true, data: mapRecordToCampaign(record) };
  } catch (error) {
    console.error("[Campaigns] Fehler beim Erstellen:", error);
    return { success: false, error: "Kampagne konnte nicht erstellt werden" };
  }
}

/**
 * Kampagne aktualisieren.
 */
export async function updateCampaign(
  campaignId: string,
  mosqueId: string,
  userId: string,
  input: CampaignInput
): Promise<ActionResult<Campaign>> {
  try {
    const validated = campaignSchema.parse(input);
    const pb = await getAdminPB();

    const existing = await pb.collection("campaigns").getOne(campaignId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Kampagne nicht gefunden" };
    }

    const record = await pb.collection("campaigns").update(campaignId, validated);

    await logAudit({
      mosqueId,
      userId,
      action: "campaign.updated",
      entityType: "campaign",
      entityId: campaignId,
      before: {
        title: existing.title,
        description: existing.description,
        category: existing.category,
        goal_amount_cents: existing.goal_amount_cents,
        status: existing.status,
        start_at: existing.start_at,
        end_at: existing.end_at,
      },
      after: {
        title: validated.title,
        description: validated.description,
        category: validated.category,
        goal_amount_cents: validated.goal_amount_cents,
        status: validated.status,
        start_at: validated.start_at,
        end_at: validated.end_at,
      },
    });

    return { success: true, data: mapRecordToCampaign(record) };
  } catch (error) {
    console.error("[Campaigns] Fehler:", error);
    return { success: false, error: "Kampagne konnte nicht aktualisiert werden" };
  }
}

/**
 * Kampagne löschen.
 */
export async function deleteCampaign(
  campaignId: string,
  mosqueId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const pb = await getAdminPB();

    const existing = await pb.collection("campaigns").getOne(campaignId);
    if (existing.mosque_id !== mosqueId) {
      return { success: false, error: "Kampagne nicht gefunden" };
    }

    await pb.collection("campaigns").delete(campaignId);

    await logAudit({
      mosqueId,
      userId,
      action: "campaign.deleted",
      entityType: "campaign",
      entityId: campaignId,
      before: {
        title: existing.title,
        category: existing.category,
        goal_amount_cents: existing.goal_amount_cents,
        status: existing.status,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[Campaigns] Fehler:", error);
    return { success: false, error: "Kampagne konnte nicht gelöscht werden" };
  }
}
