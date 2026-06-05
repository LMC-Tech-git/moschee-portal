export type MadrasaPhase =
  | "setup"
  | "teaching"
  | "parents"
  | "admin"
  | "member"
  | "finance-setup"
  | "finance-kassenbuch"
  | "finance-reports"
  | "finance-exports"
  | "membership-setup"
  | "membership-manage"
  | "membership-stripe";

export const MADRASA_PHASES: MadrasaPhase[] = ["setup", "teaching", "parents"];

export type ScreenshotKey =
  // Madrasa
  | "madrasa-settings"
  | "madrasa-students"
  | "madrasa-fees"
  | "madrasa-attendance"
  | "madrasa-parent"
  // Admin-Tour
  | "admin-dashboard"
  | "admin-events"
  | "admin-posts"
  | "admin-donations"
  // Member-Tour
  | "member-donations"
  | "member-fees"
  | "member-child";

export type GuideStep = {
  titleKey: string;
  descKey: string;
  screenshotKey?: ScreenshotKey;
};

export type PhaseGuide = {
  phase: MadrasaPhase;
  titleKey: string;
  steps: GuideStep[];
};

export const MADRASA_GUIDES: PhaseGuide[] = [
  {
    phase: "setup",
    titleKey: "madrasa.setup.title",
    steps: [
      {
        titleKey: "madrasa.setup.step1.title",
        descKey: "madrasa.setup.step1.desc",
        screenshotKey: "madrasa-settings",
      },
      {
        titleKey: "madrasa.setup.step2.title",
        descKey: "madrasa.setup.step2.desc",
      },
      {
        titleKey: "madrasa.setup.step3.title",
        descKey: "madrasa.setup.step3.desc",
      },
      {
        titleKey: "madrasa.setup.step4.title",
        descKey: "madrasa.setup.step4.desc",
        screenshotKey: "madrasa-students",
      },
      {
        titleKey: "madrasa.setup.step5.title",
        descKey: "madrasa.setup.step5.desc",
      },
      {
        titleKey: "madrasa.setup.step6.title",
        descKey: "madrasa.setup.step6.desc",
        screenshotKey: "madrasa-fees",
      },
    ],
  },
  {
    phase: "teaching",
    titleKey: "madrasa.teaching.title",
    steps: [
      {
        titleKey: "madrasa.teaching.step1.title",
        descKey: "madrasa.teaching.step1.desc",
      },
      {
        titleKey: "madrasa.teaching.step2.title",
        descKey: "madrasa.teaching.step2.desc",
        screenshotKey: "madrasa-attendance",
      },
      {
        titleKey: "madrasa.teaching.step3.title",
        descKey: "madrasa.teaching.step3.desc",
      },
    ],
  },
  {
    phase: "parents",
    titleKey: "madrasa.parents.title",
    steps: [
      {
        titleKey: "madrasa.parents.step1.title",
        descKey: "madrasa.parents.step1.desc",
        screenshotKey: "member-child",
      },
      {
        titleKey: "madrasa.parents.step2.title",
        descKey: "madrasa.parents.step2.desc",
        screenshotKey: "madrasa-parent",
      },
      {
        titleKey: "madrasa.parents.step3.title",
        descKey: "madrasa.parents.step3.desc",
      },
    ],
  },
];

export const ADMIN_TOUR: PhaseGuide[] = [
  {
    phase: "admin",
    titleKey: "adminTour.phase.title",
    steps: [
      {
        titleKey: "adminTour.dashboard.title",
        descKey: "adminTour.dashboard.desc",
        screenshotKey: "admin-dashboard",
      },
      {
        titleKey: "adminTour.events.title",
        descKey: "adminTour.events.desc",
        screenshotKey: "admin-events",
      },
      {
        titleKey: "adminTour.posts.title",
        descKey: "adminTour.posts.desc",
        screenshotKey: "admin-posts",
      },
      {
        titleKey: "adminTour.donations.title",
        descKey: "adminTour.donations.desc",
        screenshotKey: "admin-donations",
      },
    ],
  },
];

export const MEMBER_TOUR: PhaseGuide[] = [
  {
    phase: "member",
    titleKey: "memberTour.phase.title",
    steps: [
      {
        titleKey: "memberTour.profile.title",
        descKey: "memberTour.profile.desc",
      },
      {
        titleKey: "memberTour.donations.title",
        descKey: "memberTour.donations.desc",
        screenshotKey: "member-donations",
      },
      {
        titleKey: "memberTour.fees.title",
        descKey: "memberTour.fees.desc",
        screenshotKey: "member-fees",
      },
    ],
  },
];

export const FINANCE_GUIDE: PhaseGuide[] = [
  {
    phase: "finance-setup",
    titleKey: "financeGuide.setup.title",
    steps: [
      {
        titleKey: "financeGuide.setup.step1.title",
        descKey: "financeGuide.setup.step1.desc",
      },
      {
        titleKey: "financeGuide.setup.step2.title",
        descKey: "financeGuide.setup.step2.desc",
      },
    ],
  },
  {
    phase: "finance-kassenbuch",
    titleKey: "financeGuide.kassenbuch.title",
    steps: [
      {
        titleKey: "financeGuide.kassenbuch.step1.title",
        descKey: "financeGuide.kassenbuch.step1.desc",
      },
      {
        titleKey: "financeGuide.kassenbuch.step2.title",
        descKey: "financeGuide.kassenbuch.step2.desc",
      },
      {
        titleKey: "financeGuide.kassenbuch.step3.title",
        descKey: "financeGuide.kassenbuch.step3.desc",
      },
      {
        titleKey: "financeGuide.kassenbuch.step4.title",
        descKey: "financeGuide.kassenbuch.step4.desc",
      },
    ],
  },
  {
    phase: "finance-reports",
    titleKey: "financeGuide.reports.title",
    steps: [
      {
        titleKey: "financeGuide.reports.step1.title",
        descKey: "financeGuide.reports.step1.desc",
      },
      {
        titleKey: "financeGuide.reports.step2.title",
        descKey: "financeGuide.reports.step2.desc",
      },
      {
        titleKey: "financeGuide.reports.step3.title",
        descKey: "financeGuide.reports.step3.desc",
      },
    ],
  },
  {
    phase: "finance-exports",
    titleKey: "financeGuide.exports.title",
    steps: [
      {
        titleKey: "financeGuide.exports.step1.title",
        descKey: "financeGuide.exports.step1.desc",
      },
      {
        titleKey: "financeGuide.exports.step2.title",
        descKey: "financeGuide.exports.step2.desc",
      },
      {
        titleKey: "financeGuide.exports.step3.title",
        descKey: "financeGuide.exports.step3.desc",
      },
    ],
  },
];

export const MEMBERSHIP_GUIDE: PhaseGuide[] = [
  {
    phase: "membership-setup",
    titleKey: "membershipGuide.setup.title",
    steps: [
      {
        titleKey: "membershipGuide.setup.step1.title",
        descKey: "membershipGuide.setup.step1.desc",
      },
      {
        titleKey: "membershipGuide.setup.step2.title",
        descKey: "membershipGuide.setup.step2.desc",
      },
    ],
  },
  {
    phase: "membership-manage",
    titleKey: "membershipGuide.manage.title",
    steps: [
      {
        titleKey: "membershipGuide.manage.step1.title",
        descKey: "membershipGuide.manage.step1.desc",
      },
      {
        titleKey: "membershipGuide.manage.step2.title",
        descKey: "membershipGuide.manage.step2.desc",
      },
      {
        titleKey: "membershipGuide.manage.step3.title",
        descKey: "membershipGuide.manage.step3.desc",
      },
      {
        titleKey: "membershipGuide.manage.step4.title",
        descKey: "membershipGuide.manage.step4.desc",
      },
    ],
  },
  {
    phase: "membership-stripe",
    titleKey: "membershipGuide.stripe.title",
    steps: [
      {
        titleKey: "membershipGuide.stripe.step1.title",
        descKey: "membershipGuide.stripe.step1.desc",
      },
      {
        titleKey: "membershipGuide.stripe.step2.title",
        descKey: "membershipGuide.stripe.step2.desc",
      },
    ],
  },
];
