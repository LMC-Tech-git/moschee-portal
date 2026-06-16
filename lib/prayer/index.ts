// =========================================
// Prayer Times Provider - Haupteinstieg
// =========================================

import type { PrayerTimes, TuneOffsets } from "./types";
import { DEFAULT_TUNE } from "./types";
import { getAladhanPrayerTimes } from "./aladhan";
import { getMawaqitPrayerTimes } from "./mawaqit";
import { getDiyanetPrayerTimes } from "./diyanet";
import type { Mosque, Settings } from "@/types";

export type { PrayerTimes, TuneOffsets };
export { DEFAULT_TUNE } from "./types";

export type PrayerProvider =
  | "aladhan"
  | "diyanet"
  | "igmg"
  | "bosnian"
  | "mawaqit"
  | "off";

/**
 * Tabellen-basierte Provider: beziehen offizielle Verbandszeiten je generischer Quell-ID
 * (settings.prayer_source_id). Einheitliche Signatur → Dispatch-Map, neuer Verband = neues
 * Modul + 1 Map-Eintrag, kein Eingriff in die Layer-Logik.
 */
type TableProviderFn = (
  mosqueId: string,
  date: Date,
  sourceId: string,
  tune?: TuneOffsets
) => Promise<PrayerTimes | null>;

const TABLE_PROVIDERS: Partial<Record<PrayerProvider, TableProviderFn>> = {
  diyanet: getDiyanetPrayerTimes,
  // igmg:    getIgmgPrayerTimes,     // Folge-Ticket
  // bosnian: getBosnianPrayerTimes,  // Folge-Ticket
};

/** Provider-Konfiguration (gebaut aus Mosque + Settings). */
export interface PrayerConfig {
  provider: PrayerProvider;
  method: number;
  latitude: number;
  longitude: number;
  mawaqit_mosque_id: string;
  source_id: string;
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
    provider: (settings.prayer_provider as PrayerProvider) || "aladhan",
    method: settings.prayer_method || 13,
    latitude: mosque.latitude || 0,
    longitude: mosque.longitude || 0,
    mawaqit_mosque_id: settings.mawaqit_mosque_id || "",
    source_id: settings.prayer_source_id || "",
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

  // Tabellen-Provider (Diyanet/IGMG/Bosnisch): offizielle Zeiten je generischer Quell-ID.
  // Tune wird hier BEWUSST NICHT angewandt: offizielle Tabellen sind autoritativ, und
  // Alt-Offsets aus einer früheren AlAdhan-Konfiguration (settings.tune) dürfen die exakten
  // Zeiten nicht verfälschen. Die Tuning-UI ist für Tabellen-Provider ohnehin ausgeblendet.
  const tableProvider = TABLE_PROVIDERS[config.provider];
  if (tableProvider) {
    if (!config.source_id) return null;
    return tableProvider(mosqueId, date, config.source_id, undefined);
  }

  // Mawaqit braucht keine Koordinaten/Methode, nur den Slug.
  if (config.provider === "mawaqit") {
    if (!config.mawaqit_mosque_id) return null;
    return getMawaqitPrayerTimes(
      mosqueId,
      date,
      config.mawaqit_mosque_id,
      config.tune
    );
  }

  // AlAdhan: braucht Koordinaten + Methode (astronomische Berechnung).
  if (config.provider === "aladhan") {
    if (!config.latitude || !config.longitude) return null;
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
