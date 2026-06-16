// =========================================
// Prayer Times - Gemeinsame Typen
// =========================================

export interface PrayerTimes {
  fajr: string;     // "HH:mm"
  imsak?: string;   // "HH:mm" — offizieller İmsak (Tabellen-Provider; bei Diyanet == fajr)
  sabah?: string;   // "HH:mm" — Salatul Fadjr / Sabah Namazı (nur berechnete Provider, z.B. Mawaqit: 30 Min vor sunrise)
  sunrise: string;  // "HH:mm"
  dhuhr: string;    // "HH:mm"
  asr: string;      // "HH:mm"
  maghrib: string;  // "HH:mm"
  isha: string;     // "HH:mm"
  date: string;     // "YYYY-MM-DD"
  hijriDate: string; // z.B. "02 Sha'ban 1447"
  provider: "aladhan" | "diyanet" | "igmg" | "bosnian" | "mawaqit";
}

export interface TuneOffsets {
  fajr: number;
  sabah: number;    // Additiv auf (sunrise - 30)
  sunrise: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

export const DEFAULT_TUNE: TuneOffsets = {
  fajr: 0,
  sabah: 0,
  sunrise: 0,
  dhuhr: 0,
  asr: 0,
  maghrib: 0,
  isha: 0,
};
