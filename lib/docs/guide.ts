export type Role = "admin" | "member" | "teacher";

export const VALID_ROLES: Role[] = ["admin", "member", "teacher"];

export type GuideStep = {
  titleKey: string;
  descKey: string;
  screenshotKey?: string;
};

export type RoleGuide = {
  role: Role;
  steps: GuideStep[];
};

export const GUIDES: RoleGuide[] = [
  {
    role: "admin",
    steps: [
      {
        titleKey: "guide.admin.step1.title",
        descKey: "guide.admin.step1.desc",
        screenshotKey: "admin-settings",
      },
      {
        titleKey: "guide.admin.step2.title",
        descKey: "guide.admin.step2.desc",
        screenshotKey: "prayer-times",
      },
      {
        titleKey: "guide.admin.step3.title",
        descKey: "guide.admin.step3.desc",
        screenshotKey: "posts",
      },
      {
        titleKey: "guide.admin.step4.title",
        descKey: "guide.admin.step4.desc",
        screenshotKey: "events-list",
      },
      {
        titleKey: "guide.admin.step5.title",
        descKey: "guide.admin.step5.desc",
        screenshotKey: "members",
      },
      {
        titleKey: "guide.admin.step6.title",
        descKey: "guide.admin.step6.desc",
        screenshotKey: "donations",
      },
    ],
  },
  {
    role: "member",
    steps: [
      {
        titleKey: "guide.member.step1.title",
        descKey: "guide.member.step1.desc",
      },
      {
        titleKey: "guide.member.step2.title",
        descKey: "guide.member.step2.desc",
      },
      {
        titleKey: "guide.member.step3.title",
        descKey: "guide.member.step3.desc",
        screenshotKey: "events-list",
      },
      {
        titleKey: "guide.member.step4.title",
        descKey: "guide.member.step4.desc",
        screenshotKey: "donations",
      },
    ],
  },
  {
    role: "teacher",
    steps: [
      {
        titleKey: "guide.teacher.step1.title",
        descKey: "guide.teacher.step1.desc",
      },
      {
        titleKey: "guide.teacher.step2.title",
        descKey: "guide.teacher.step2.desc",
        screenshotKey: "madrasa",
      },
      {
        titleKey: "guide.teacher.step3.title",
        descKey: "guide.teacher.step3.desc",
      },
      {
        titleKey: "guide.teacher.step4.title",
        descKey: "guide.teacher.step4.desc",
      },
    ],
  },
];
