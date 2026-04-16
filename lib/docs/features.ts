export type FeatureDoc = {
  key: string;
  iconKey: "clock" | "calendar" | "heart" | "users" | "bell" | "book-open";
  titleKey: string;
  descKey: string;
  screenshotKey: string;
  color: { bg: string; text: string };
  highlight?: boolean;
};

export const FEATURES: FeatureDoc[] = [
  {
    key: "prayer",
    iconKey: "clock",
    highlight: true,
    screenshotKey: "prayer-times",
    color: { bg: "bg-emerald-50", text: "text-emerald-600" },
    titleKey: "features.prayer.title",
    descKey: "features.prayer.desc",
  },
  {
    key: "events",
    iconKey: "calendar",
    highlight: true,
    screenshotKey: "events-list",
    color: { bg: "bg-violet-50", text: "text-violet-600" },
    titleKey: "features.events.title",
    descKey: "features.events.desc",
  },
  {
    key: "donations",
    iconKey: "heart",
    screenshotKey: "donations",
    color: { bg: "bg-amber-50", text: "text-amber-600" },
    titleKey: "features.donations.title",
    descKey: "features.donations.desc",
  },
  {
    key: "members",
    iconKey: "users",
    screenshotKey: "members",
    color: { bg: "bg-rose-50", text: "text-rose-600" },
    titleKey: "features.members.title",
    descKey: "features.members.desc",
  },
  {
    key: "announcements",
    iconKey: "bell",
    screenshotKey: "posts",
    color: { bg: "bg-blue-50", text: "text-blue-600" },
    titleKey: "features.announcements.title",
    descKey: "features.announcements.desc",
  },
  {
    key: "madrasa",
    iconKey: "book-open",
    screenshotKey: "madrasa",
    color: { bg: "bg-teal-50", text: "text-teal-600" },
    titleKey: "features.madrasa.title",
    descKey: "features.madrasa.desc",
  },
];
