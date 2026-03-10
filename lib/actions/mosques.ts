"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";

export interface MosqueOption {
  id: string;
  name: string;
  city: string;
  slug: string;
}

/**
 * Alle Moscheen laden (nur fuer super_admin).
 */
export async function getAllMosques(): Promise<MosqueOption[]> {
  const pb = await getAdminPB();
  const mosques = await pb
    .collection("mosques")
    .getFullList({ sort: "name", fields: "id,name,city,slug" });
  return mosques.map((m) => ({
    id: m.id,
    name: m.name || "",
    city: m.city || "",
    slug: m.slug || "",
  }));
}
