import type { ExternalDonationConfig, Mosque } from "@/types";

/**
 * Konfiguration für externe Spendenlinks.
 * Priorisiert Daten aus dem Moschee-Record (PocketBase).
 * Fallback auf Umgebungsvariablen (Abwärtskompatibilität).
 *
 * @param mosque - Optionaler Moschee-Record mit externen Spenden-Daten
 */
export function getExternalDonationConfig(
  mosque?: Mosque | null
): ExternalDonationConfig {
  // Priorität 1: Moschee-Record aus PocketBase
  if (mosque?.external_donation_url) {
    return {
      enabled: true,
      label: mosque.external_donation_label || "Weitere Spenden",
      url: mosque.external_donation_url,
      description: `Spenden über den Dachverband von ${mosque.name || "unserer Moschee"}`,
    };
  }

  // Priorität 2: Umgebungsvariablen (Fallback)
  const url = process.env.NEXT_PUBLIC_EXTERNAL_DONATION_URL || "";
  const label =
    process.env.NEXT_PUBLIC_EXTERNAL_DONATION_LABEL || "Weitere Spenden";
  const description =
    process.env.NEXT_PUBLIC_EXTERNAL_DONATION_DESCRIPTION ||
    "Spenden über unseren Dachverband";

  return {
    enabled: !!url,
    label,
    url,
    description,
  };
}
