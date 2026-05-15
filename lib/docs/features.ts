export type FeatureDoc = {
  key: string;
  iconKey:
    | "clock"
    | "calendar"
    | "heart"
    | "users"
    | "bell"
    | "book-open"
    | "clipboard-check"
    | "handshake"
    | "repeat"
    | "languages"
    | "mail"
    | "user-check";
  titleKey: string;
  descKey: string;
  color: { bg: string; text: string };
  highlight?: boolean;
};

export const FEATURES: FeatureDoc[] = [
  {
    key: "prayer",
    iconKey: "clock",
    highlight: true,
    color: { bg: "bg-emerald-50", text: "text-emerald-600" },
    titleKey: "features.prayer.title",
    descKey: "features.prayer.desc",
  },
  {
    key: "events",
    iconKey: "calendar",
    highlight: true,
    color: { bg: "bg-violet-50", text: "text-violet-600" },
    titleKey: "features.events.title",
    descKey: "features.events.desc",
  },
  {
    key: "attendance",
    iconKey: "clipboard-check",
    highlight: true,
    color: { bg: "bg-teal-50", text: "text-teal-600" },
    titleKey: "features.attendance.title",
    descKey: "features.attendance.desc",
  },
  {
    key: "donations",
    iconKey: "heart",
    color: { bg: "bg-amber-50", text: "text-amber-600" },
    titleKey: "features.donations.title",
    descKey: "features.donations.desc",
  },
  {
    key: "recurring",
    iconKey: "repeat",
    color: { bg: "bg-pink-50", text: "text-pink-600" },
    titleKey: "features.recurring.title",
    descKey: "features.recurring.desc",
  },
  {
    key: "sponsors",
    iconKey: "handshake",
    color: { bg: "bg-orange-50", text: "text-orange-600" },
    titleKey: "features.sponsors.title",
    descKey: "features.sponsors.desc",
  },
  {
    key: "members",
    iconKey: "users",
    color: { bg: "bg-rose-50", text: "text-rose-600" },
    titleKey: "features.members.title",
    descKey: "features.members.desc",
  },
  {
    key: "announcements",
    iconKey: "bell",
    color: { bg: "bg-blue-50", text: "text-blue-600" },
    titleKey: "features.announcements.title",
    descKey: "features.announcements.desc",
  },
  {
    key: "madrasa",
    iconKey: "book-open",
    color: { bg: "bg-sky-50", text: "text-sky-600" },
    titleKey: "features.madrasa.title",
    descKey: "features.madrasa.desc",
  },
  {
    key: "team",
    iconKey: "user-check",
    color: { bg: "bg-indigo-50", text: "text-indigo-600" },
    titleKey: "features.team.title",
    descKey: "features.team.desc",
  },
  {
    key: "contact",
    iconKey: "mail",
    color: { bg: "bg-cyan-50", text: "text-cyan-600" },
    titleKey: "features.contact.title",
    descKey: "features.contact.desc",
  },
  {
    key: "multilingual",
    iconKey: "languages",
    color: { bg: "bg-lime-50", text: "text-lime-700" },
    titleKey: "features.multilingual.title",
    descKey: "features.multilingual.desc",
  },
];
