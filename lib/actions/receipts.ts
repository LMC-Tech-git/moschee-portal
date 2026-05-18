"use server";

import { getAdminPB } from "@/lib/pocketbase-admin";
import { getDonationEffectiveDate } from "@/lib/utils";
import {
  isReceiptEligible,
  normalizeDonationAmountCents,
} from "@/lib/pdf/receipts/receipt-amount";
import type { ReceiptVerein } from "@/lib/pdf/receipts/receipt-types";
import type { RawDonationRecord } from "@/lib/pdf/receipts/build-receipt-data";

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ReceiptDonorRow {
  userId: string;
  name: string;
  email: string;
  count: number;
  totalCents: number;
  addressMissing: boolean;
}

/**
 * Vereinsangaben für die Bescheinigung auflösen.
 * Anschrift: settings.verein_anschrift, Fallback aus Moschee-Adresse.
 * NICHT als Server Action gedacht (interner Helper) — wird vom Route Handler
 * genutzt.
 */
export async function loadVereinSettings(
  mosqueId: string
): Promise<{ verein: ReceiptVerein }> {
  const pb = await getAdminPB();
  const mosque = await pb.collection("mosques").getOne(mosqueId);

  let settings: Record<string, unknown> | null = null;
  try {
    settings = await pb
      .collection("settings")
      .getFirstListItem(`mosque_id = "${mosqueId}"`);
  } catch {
    // keine Settings → Defaults
  }

  const fallbackAnschrift = [
    mosque.name,
    mosque.address,
    [mosque.zip_code, mosque.city].filter(Boolean).join(" "),
  ]
    .filter((l) => l && String(l).trim().length > 0)
    .join("\n");

  return {
    verein: {
      name: mosque.name || "",
      anschrift:
        (settings?.verein_anschrift as string)?.trim() || fallbackAnschrift,
      steuernummer: (settings?.verein_steuernummer as string) || "",
      freistellungsbescheidText:
        (settings?.freistellungsbescheid_text as string) || "",
      foerderzweck: (settings?.verein_foerderzweck as string) || "",
    },
  };
}

/**
 * Rohe (steuerlich gültige) Spenden eines Users für ein Jahr.
 * Jahresfilter in JS (paid_at kann bei manuellen Spenden leer sein).
 */
export async function loadRawDonationsForUser(
  mosqueId: string,
  userId: string,
  year: number
): Promise<RawDonationRecord[]> {
  const pb = await getAdminPB();
  const raw = await pb.collection("donations").getFullList({
    filter: `user_id = "${userId}" && mosque_id = "${mosqueId}" && status = "paid"`,
    sort: "paid_at",
  });
  const records = raw as unknown as RawDonationRecord[];
  return records
    .filter((r) => {
      if (!isReceiptEligible(r)) return false;
      const d = getDonationEffectiveDate(r);
      return d !== null && d.getFullYear() === year;
    })
    .map((r) => ({
      status: r.status,
      amount: r.amount,
      amount_cents: r.amount_cents,
      provider: r.provider,
      paid_at: r.paid_at,
      created: r.created,
    }));
}

interface DonorMeta {
  name: string;
  email: string;
  anschrift: string;
  membershipNumber: string;
  addressMissing: boolean;
}

export async function loadDonorMeta(
  mosqueId: string,
  userId: string
): Promise<DonorMeta | null> {
  const pb = await getAdminPB();
  try {
    const u = await pb.collection("users").getOne(userId);
    if (u.mosque_id !== mosqueId) return null;
    const address = (u.address || "").trim();
    return {
      name:
        u.full_name ||
        `${u.first_name || ""} ${u.last_name || ""}`.trim() ||
        u.email ||
        "",
      email: u.email || "",
      anschrift: address,
      membershipNumber: u.membership_number || u.member_no || "",
      addressMissing: address.length === 0,
    };
  } catch {
    return null;
  }
}

/**
 * Alle Spender (Mitglieder) mit steuerlich gültigen Spenden in einem Jahr,
 * pro Spender aggregiert. Für die Admin-Übersicht.
 * Sortierung: alphabetisch nach Nachname → Vorname (deterministisch).
 */
export async function getReceiptYearDonors(
  mosqueId: string,
  year: number
): Promise<ActionResult<ReceiptDonorRow[]>> {
  try {
    const pb = await getAdminPB();

    const allRaw = await pb.collection("donations").getFullList({
      filter: `mosque_id = "${mosqueId}" && status = "paid"`,
      sort: "paid_at",
    });
    const all = allRaw as unknown as (RawDonationRecord & {
      user_id?: string;
    })[];

    const eligible = all.filter((r) => {
      if (!r.user_id) return false; // nur Mitglieder (Gäste haben keine Adresse)
      if (!isReceiptEligible(r)) return false;
      const d = getDonationEffectiveDate(r);
      return d !== null && d.getFullYear() === year;
    });

    const byUser = new Map<
      string,
      { count: number; totalCents: number }
    >();
    eligible.forEach((r) => {
      const uid = r.user_id as string;
      const cur = byUser.get(uid) || { count: 0, totalCents: 0 };
      cur.count += 1;
      cur.totalCents += normalizeDonationAmountCents(r);
      byUser.set(uid, cur);
    });

    const rows: ReceiptDonorRow[] = [];
    const userIds = Array.from(byUser.keys());
    for (const uid of userIds) {
      const agg = byUser.get(uid)!;
      const meta = await loadDonorMeta(mosqueId, uid);
      rows.push({
        userId: uid,
        name: meta?.name || "Unbekannt",
        email: meta?.email || "",
        count: agg.count,
        totalCents: agg.totalCents,
        addressMissing: meta?.addressMissing ?? true,
      });
    }

    rows.sort((a, b) => {
      const an = a.name.split(" ").slice(-1)[0] || a.name;
      const bn = b.name.split(" ").slice(-1)[0] || b.name;
      const cmp = an.localeCompare(bn, "de");
      return cmp !== 0 ? cmp : a.name.localeCompare(b.name, "de");
    });

    return { success: true, data: rows };
  } catch (error) {
    console.error("[receipts] getReceiptYearDonors:", error);
    return {
      success: false,
      error: "Spender konnten nicht geladen werden.",
    };
  }
}
