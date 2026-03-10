"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";

// --- Dashboard KPI Statistiken ---

export interface DashboardStats {
  /** Mitglieder gesamt */
  totalMembers: number;
  /** Mitgliederanzahl (status = "active") */
  activeMembers: number;
  /** Ausstehende Mitglieder (status = "pending") */
  pendingMembers: number;
  /** Aktive Kampagnen */
  activeCampaigns: number;
  /** Gesamtspenden (Cents, status = "paid") */
  totalDonationsCents: number;
  /** Kampagnen-Spenden (Cents, status = "paid", campaign_id gesetzt) */
  campaignDonationsCents: number;
  /** Beiträge insgesamt (published) */
  publishedPosts: number;
  /** Kommende Events (published, start_at >= now) */
  upcomingEvents: number;
  /** Alle Events (published) */
  totalEvents: number;
  /** Events diesen Monat (published, start_at im aktuellen Monat) */
  upcomingEventsThisMonth: number;
  /** Registrierungen diesen Monat */
  registrationsThisMonth: number;
}

/**
 * Lädt KPI-Statistiken für das Dashboard einer Moschee.
 * Alle Abfragen nutzen Admin-PB (server-seitig).
 */
export async function getDashboardStats(
  mosqueId: string
): Promise<DashboardStats> {
  const defaults: DashboardStats = {
    totalMembers: 0,
    activeMembers: 0,
    pendingMembers: 0,
    activeCampaigns: 0,
    totalDonationsCents: 0,
    campaignDonationsCents: 0,
    publishedPosts: 0,
    upcomingEvents: 0,
    totalEvents: 0,
    upcomingEventsThisMonth: 0,
    registrationsThisMonth: 0,
  };

  try {
    const pb = await getAdminPB();
    const f = `mosque_id = "${mosqueId}"`;

    // Helper: Count-Query mit sicherem Fallback
    const countRecords = async (collection: string, filter: string): Promise<number> => {
      try {
        const result = await pb.collection(collection).getList(1, 1, { filter, fields: "id" });
        return result.totalItems;
      } catch {
        return 0;
      }
    };

    // Monatsgrenzen berechnen
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    // Sequenziell laden (PB-Singleton verträgt keine parallelen Auth-Requests gut)
    const totalMembers = await countRecords("users", f);
    const activeMembers = await countRecords("users", `${f} && status = "active"`);
    const pendingMembers = await countRecords("users", `${f} && status = "pending"`);
    const activeCampaigns = await countRecords("campaigns", `${f} && status = "active"`);
    const publishedPosts = await countRecords("posts", `${f} && status = "published"`);
    const totalEvents = await countRecords("events", `${f} && status = "published"`);
    const upcomingEvents = await countRecords("events", `${f} && status = "published" && (end_at = "" || end_at >= "${now.toISOString()}")`);
    const upcomingEventsThisMonth = await countRecords("events", `${f} && status = "published" && start_at >= "${monthStart}" && start_at <= "${monthEnd}"`);
    const registrationsThisMonth = await countRecords("event_registrations", `${f} && status = "registered" && created >= "${monthStart}" && created <= "${monthEnd}"`);

    // Spenden summieren (gesamt + nur Kampagnen-Spenden)
    let totalDonationsCents = 0;
    let campaignDonationsCents = 0;
    try {
      const donations = await pb.collection("donations").getFullList({
        filter: `${f} && status = "paid"`,
        fields: "amount,amount_cents,campaign_id",
      });
      donations.forEach((d) => {
        const cents = d.amount_cents || Math.round((d.amount || 0) * 100);
        totalDonationsCents += cents;
        if (d.campaign_id && d.campaign_id !== "") {
          campaignDonationsCents += cents;
        }
      });
    } catch { /* keine Spenden */ }

    return {
      totalMembers,
      activeMembers,
      pendingMembers,
      activeCampaigns,
      totalDonationsCents,
      campaignDonationsCents,
      publishedPosts,
      upcomingEvents,
      totalEvents,
      upcomingEventsThisMonth,
      registrationsThisMonth,
    };
  } catch (error) {
    console.error("[Dashboard] Fehler beim Laden der Statistiken:", error);
    return defaults;
  }
}


// --- Plattform-Statistiken (nur super_admin) ---

export interface MosqueStat {
  id: string;
  name: string;
  city: string;
  slug: string;
  memberCount: number;
}

export interface PlatformStats {
  totalMosques: number;
  totalMembers: number;
  totalDonationsCents: number;
  activeCampaigns: number;
  mosques: MosqueStat[];
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const pb = await getAdminPB();

  const [mosques, membersResult, campaignsResult] = await Promise.all([
    pb.collection("mosques").getFullList({ sort: "name" }),
    pb.collection("users").getList(1, 1, {}),
    pb.collection("campaigns").getList(1, 1, { filter: "is_active = true" }),
  ]);

  const mosqueStats: MosqueStat[] = await Promise.all(
    mosques.map(async (m) => {
      try {
        const memberResult = await pb
          .collection("users")
          .getList(1, 1, { filter: `mosque_id = "${m.id}"` });
        return {
          id: m.id,
          name: m.name || "",
          city: m.city || "",
          slug: m.slug || "",
          memberCount: memberResult.totalItems,
        };
      } catch {
        return { id: m.id, name: m.name || "", city: m.city || "", slug: m.slug || "", memberCount: 0 };
      }
    })
  );

  let totalDonationsCents = 0;
  try {
    const allDonations = await pb.collection("donations").getFullList({
      filter: 'status = "paid"',
      fields: "amount_cents,amount",
    });
    totalDonationsCents = allDonations.reduce(
      (sum, d) => sum + (d.amount_cents || Math.round((d.amount || 0) * 100)),
      0
    );
  } catch {
    // Donations Collection koennte leer sein
  }

  return {
    totalMosques: mosques.length,
    totalMembers: membersResult.totalItems,
    totalDonationsCents,
    activeCampaigns: campaignsResult.totalItems,
    mosques: mosqueStats,
  };
}
