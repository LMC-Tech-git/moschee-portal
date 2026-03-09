// =========================================
// Prayer Times - PocketBase Cache
// TTL: 24h. Key: mosque_id + month_key (YYYY-MM)
// =========================================

import { getAdminPB } from "@/lib/pocketbase-admin";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Stunden

/**
 * Liest den monatlichen Kalender-Cache aus PocketBase.
 * Gibt { data, stale } zurück, oder null wenn kein Eintrag.
 */
export async function getCachedMonthlyCalendar(
  mosqueId: string,
  monthKey: string
): Promise<{ data: unknown; stale: boolean } | null> {
  try {
    const pb = await getAdminPB();
    const record = await pb
      .collection("prayer_times_cache")
      .getFirstListItem(
        `mosque_id = "${mosqueId}" && month_key = "${monthKey}"`
      );

    const fetchedAt = new Date(record.fetched_at as string).getTime();
    const stale = Date.now() - fetchedAt > CACHE_TTL_MS;
    const data = JSON.parse(record.calendar_json as string);

    return { data, stale };
  } catch {
    return null;
  }
}

/**
 * Speichert den monatlichen Kalender in PocketBase.
 * Erstellt oder überschreibt bestehenden Eintrag.
 */
export async function setCachedMonthlyCalendar(
  mosqueId: string,
  monthKey: string,
  data: unknown
): Promise<void> {
  try {
    const pb = await getAdminPB();
    const calendar_json = JSON.stringify(data);
    const fetched_at = new Date().toISOString();

    let existingId: string | null = null;
    try {
      const existing = await pb
        .collection("prayer_times_cache")
        .getFirstListItem(
          `mosque_id = "${mosqueId}" && month_key = "${monthKey}"`
        );
      existingId = existing.id;
    } catch {
      // kein bestehender Eintrag
    }

    if (existingId) {
      await pb
        .collection("prayer_times_cache")
        .update(existingId, { calendar_json, fetched_at });
    } else {
      await pb.collection("prayer_times_cache").create({
        mosque_id: mosqueId,
        month_key: monthKey,
        calendar_json,
        fetched_at,
      });
    }
  } catch (error) {
    console.error("[prayer-cache] Schreibfehler:", error);
  }
}
