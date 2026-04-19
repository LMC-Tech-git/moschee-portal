// =========================================
// Prayer Times Provider - Haupteinstieg
// =========================================

import type { PrayerTimes, TuneOffsets } from "./types";
import { DEFAULT_TUNE } from "./types";
import { getAladhanPrayerTimes } from "./aladhan";
import type { Mosque, Settings } from "@/types";

export type { PrayerTimes, TuneOffsets };
export { DEFAULT_TUNE } from "./types";

/** Provider-Konfiguration (gebaut aus Mosque + Settings). */
export interface PrayerConfig {
  provider: "aladhan" | "off";
  method: number;
  latitude: number;
  longitude: number;
  tune?: TuneOffsets;
}

/**
 * Baut die PrayerConfig aus dem Mosque-Record und den Settings.
 * Parsed settings.tune (JSON-String) zu TuneOffsets.
 */
export function buildPrayerConfig(mosque: Mosque, settings: Settings): PrayerConfig {
  // Mit DEFAULT_TUNE mergen, damit alte Records ohne neues `sabah`-Feld
  // (oder andere zukünftige Keys) immer numerische Werte für alle Offsets haben.
  let tune: TuneOffsets = { ...DEFAULT_TUNE };
  if (settings.tune) {
    try {
      const parsed = JSON.parse(settings.tune) as Partial<TuneOffsets>;
      tune = { ...DEFAULT_TUNE, ...parsed };
    } catch {
      // ungültiges JSON → DEFAULT_TUNE
    }
  }

  return {
    provider: (settings.prayer_provider as "aladhan" | "off") || "aladhan",
    method: settings.prayer_method || 13,
    latitude: mosque.latitude || 0,
    longitude: mosque.longitude || 0,
    tune,
  };
}

/**
 * Holt Gebetszeiten für ein Datum.
 * Gibt null zurück wenn provider="off", Koordinaten fehlen, oder API komplett ausfällt.
 *
 * @param mosqueId - Moschee-ID (für Cache-Isolation)
 * @param date     - Datum (typisch today)
 * @param config   - Provider-Konfiguration (aus buildPrayerConfig)
 */
export async function getPrayerTimesForDate(
  mosqueId: string,
  date: Date,
  config: PrayerConfig
): Promise<PrayerTimes | null> {
  if (config.provider === "off") return null;
  if (!config.latitude || !config.longitude) return null;

  if (config.provider === "aladhan") {
    return getAladhanPrayerTimes(
      mosqueId,
      date,
      config.latitude,
      config.longitude,
      config.method,
      config.tune
    );
  }

  return null;
}
