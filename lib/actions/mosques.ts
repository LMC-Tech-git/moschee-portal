"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import type { Mosque } from "@/types";
import type { RecordModel } from "pocketbase";

function mapRecord(record: RecordModel): Mosque {
  return {
    id: record.id,
    name: record.name || "",
    slug: record.slug || "",
    city: record.city || "",
    address: record.address || "",
    latitude: record.latitude || 0,
    longitude: record.longitude || 0,
    timezone: record.timezone || "Europe/Berlin",
    phone: record.phone || "",
    email: record.email || "",
    public_enabled: record.public_enabled ?? true,
    donation_provider: record.donation_provider || "none",
    paypal_enabled: record.paypal_enabled ?? false,
    paypal_donate_url: record.paypal_donate_url || "",
    external_donation_url: record.external_donation_url || "",
    external_donation_label: record.external_donation_label || "",
    zip_code: record.zip_code || "",
    website: record.website || "",
    brand_logo: record.brand_logo || "",
    brand_primary_color: record.brand_primary_color || "",
    brand_accent_color: record.brand_accent_color || "",
    brand_theme: record.brand_theme || "default",
    brand_hero_type: record.brand_hero_type || "color",
    brand_hero_image: record.brand_hero_image || "",
    created: record.created || "",
    updated: record.updated || "",
  };
}

/**
 * Lädt eine Moschee anhand ihrer ID (Server-seitig via Admin-PB).
 * Umgeht PocketBase-viewRule-Beschränkungen für Client-User.
 */
export async function getMosqueById(mosqueId: string): Promise<Mosque | null> {
  if (!mosqueId) return null;
  try {
    const pb = await getAdminPB();
    const record = await pb.collection("mosques").getOne(mosqueId);
    return mapRecord(record);
  } catch {
    return null;
  }
}

/**
 * Lädt eine Moschee anhand ihres Slugs (Server-seitig via Admin-PB).
 * Umgeht PocketBase-viewRule-Beschränkungen für Client-User.
 */
export async function getMosqueBySlug(slug: string): Promise<Mosque | null> {
  if (!slug) return null;
  try {
    const pb = await getAdminPB();
    const result = await pb.collection("mosques").getList(1, 1, {
      filter: `slug="${slug}"`,
    });
    if (result.items.length === 0) return null;
    return mapRecord(result.items[0]);
  } catch {
    return null;
  }
}

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
