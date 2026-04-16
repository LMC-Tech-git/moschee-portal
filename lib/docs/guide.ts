export type MadrasaPhase = "setup" | "teaching" | "parents";

export const MADRASA_PHASES: MadrasaPhase[] = ["setup", "teaching", "parents"];

export type ScreenshotKey =
  | "madrasa-settings"
  | "madrasa-students"
  | "madrasa-fees"
  | "madrasa-attendance"
  | "madrasa-parent";

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
