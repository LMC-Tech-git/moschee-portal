import { createPocketBase } from "@/lib/pocketbase";
import type { Campaign } from "@/types";

/**
 * Holt aktive öffentliche Kampagnen aus PocketBase.
 * Server-seitige Funktion (nutzt frische PocketBase-Instanz).
 * Gibt leeres Array zurück bei Fehler (z.B. Collection existiert noch nicht).
 *
 * @param mosqueId - ID der Moschee, deren Kampagnen geladen werden sollen
 */
export async function fetchPublicCampaigns(
  mosqueId?: string
): Promise<Campaign[]> {
  try {
    const pb = createPocketBase();
    const filters = ['status = "active"', 'visibility = "public"'];
    if (mosqueId) {
      filters.push(`mosque_id = "${mosqueId}"`);
    }
    const records = await pb.collection("campaigns").getFullList({
      filter: filters.join(" && "),
      sort: "-created",
    });
    return records as unknown as Campaign[];
  } catch (error) {
    console.error("Fehler beim Laden der Kampagnen:", error);
    return [];
  }
}
