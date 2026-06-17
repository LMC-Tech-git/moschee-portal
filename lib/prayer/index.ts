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
  /** Sabah/Salatul-Fadjr-Offset in Minuten relativ zu Sonnenaufgang (z.B. -30 = 30 Min davor). Provider-unabhängig. */
  sabah_offset_minutes: number;
  tune?: TuneOffsets;
}

/** Default-Sabah-Offset: 30 Minuten vor Sonnenaufgang. */
export const DEFAULT_SABAH_OFFSET = -30;

/** Addiert (signierte) Minuten auf eine "HH:mm"-Zeit, mit Tagesumbruch-Normalisierung. */
function addMinutesToTime(time: string, offsetMinutes: number): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const total = ((h * 60 + m + offsetMinutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
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
    sabah_offset_minutes:
      typeof settings.sabah_offset_minutes === "number"
        ? settings.sabah_offset_minutes
        : DEFAULT_SABAH_OFFSET,
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

  const times = await fetchFromProvider(mosqueId, date, config);
  if (!times) return null;

  // Sabah / Salatul Fadjr provider-UNABHÄNGIG aus Sonnenaufgang ableiten.
  // Jede Moschee stellt den Offset selbst ein (sabah_offset_minutes, z.B. -30 = 30 Min vor Shuruk).
  // Überschreibt bewusst etwaige provider-interne Sabah-Werte → einheitliches Verhalten.
  if (times.sunrise) {
    times.sabah = addMinutesToTime(times.sunrise, config.sabah_offset_minutes);
  }

  return times;
}

/** Ruft den konfigurierten Provider auf (ohne Sabah-Nachbearbeitung). */
async function fetchFromProvider(
  mosqueId: string,
  date: Date,
  config: PrayerConfig
): Promise<PrayerTimes | null> {
  // Tabellen-Provider (Diyanet/IGMG/Bosnisch): offizielle Zeiten je generischer Quell-ID.
  // Tune wird als additiver Geo-Offset je Gebet angewandt — für Orte ohne eigene Tabelle, die eine
  // Nachbarstadt nutzen (z.B. Erbach = Ulm -1 Min). Standard 0 = exakte offizielle Zeit.
  // sabah bleibt provider-unabhängig über sabah_offset_minutes (siehe getPrayerTimesForDate).
  const tableProvider = TABLE_PROVIDERS[config.provider];
  if (tableProvider) {
    if (!config.source_id) return null;
    return tableProvider(mosqueId, date, config.source_id, config.tune);
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
