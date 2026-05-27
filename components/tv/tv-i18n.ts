/**
 * TV-spezifische i18n-Strings für DE/TR/AR/EN — unabhängig von next-intl,
 * da TV-Route immer in der Settings-Sprache rendert, nicht in der User-Locale.
 */
import type { TVLocale, TVPrayerName } from "@/types";

type Bundle = {
  nextPrayer: string;
  prayerTimeNow: string;
  upcomingEvents: string;
  latestPost: string;
  currentCampaign: string;
  donateCta: string;
  welcome: string;
  noEvents: string;
  raisedOfGoal: string;
  raised: string;
  goal: string;
  remaining: string;
  prayers: Record<TVPrayerName, string>;
};

export const TV_STRINGS: Record<TVLocale, Bundle> = {
  de: {
    nextPrayer: "Nächstes Gebet",
    prayerTimeNow: "Zeit zum Gebet",
    upcomingEvents: "Bevorstehende Veranstaltungen",
    latestPost: "Aktueller Beitrag",
    currentCampaign: "Aktuelle Kampagne",
    donateCta: "Zum Spenden scannen",
    welcome: "Herzlich willkommen",
    noEvents: "Keine bevorstehenden Veranstaltungen",
    raisedOfGoal: "{raised} von {goal}",
    raised: "Gesammelt",
    goal: "Ziel",
    remaining: "Verbleibend",
    prayers: { fajr: "Fajr", sunrise: "Sonnenaufgang", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" },
  },
  tr: {
    nextPrayer: "Sıradaki namaz",
    prayerTimeNow: "Namaz vakti",
    upcomingEvents: "Yaklaşan etkinlikler",
    latestPost: "Son duyuru",
    currentCampaign: "Güncel kampanya",
    donateCta: "Bağış için tarayın",
    welcome: "Hoş geldiniz",
    noEvents: "Yaklaşan etkinlik yok",
    raisedOfGoal: "{raised} / {goal}",
    raised: "Toplanan",
    goal: "Hedef",
    remaining: "Kalan süre",
    prayers: { fajr: "Sabah", sunrise: "Güneş", dhuhr: "Öğle", asr: "İkindi", maghrib: "Akşam", isha: "Yatsı" },
  },
  ar: {
    nextPrayer: "الصلاة القادمة",
    prayerTimeNow: "حان وقت الصلاة",
    upcomingEvents: "الفعاليات القادمة",
    latestPost: "آخر إعلان",
    currentCampaign: "الحملة الحالية",
    donateCta: "امسح للتبرع",
    welcome: "أهلاً وسهلاً",
    noEvents: "لا توجد فعاليات قادمة",
    raisedOfGoal: "{raised} من {goal}",
    raised: "تم جمعه",
    goal: "الهدف",
    remaining: "المتبقي",
    prayers: { fajr: "الفجر", sunrise: "الشروق", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" },
  },
  en: {
    nextPrayer: "Next prayer",
    prayerTimeNow: "Prayer time",
    upcomingEvents: "Upcoming events",
    latestPost: "Latest post",
    currentCampaign: "Current campaign",
    donateCta: "Scan to donate",
    welcome: "Welcome",
    noEvents: "No upcoming events",
    raisedOfGoal: "{raised} of {goal}",
    raised: "Raised",
    goal: "Goal",
    remaining: "Remaining",
    prayers: { fajr: "Fajr", sunrise: "Sunrise", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" },
  },
};

export function tvT(locale: TVLocale): Bundle {
  return TV_STRINGS[locale] || TV_STRINGS.de;
}

export function formatTvCurrency(cents: number, locale: TVLocale): string {
  try {
    return new Intl.NumberFormat(locale === "ar" ? "ar" : locale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(0)} €`;
  }
}

export function formatTvDate(iso: string, locale: TVLocale, tz: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar" : locale, {
      timeZone: tz,
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
