"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { GuideStepCard } from "./GuideStepCard";

export interface TranslatedStep {
  title: string;
  desc: string;
  screenshotKey?: string;
  screenshotAvailable?: boolean;
}

export interface TranslatedPhase {
  phase: string;
  title: string;
  steps: TranslatedStep[];
}

interface MadrasaGuideProps {
  phases: TranslatedPhase[];
}

const PHASE_COLORS: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  setup: {
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700",
  },
  teaching: {
    border: "border-blue-200",
    bg: "bg-blue-50",
    text: "text-blue-700",
    badge: "bg-blue-100 text-blue-700",
  },
  parents: {
    border: "border-violet-200",
    bg: "bg-violet-50",
    text: "text-violet-700",
    badge: "bg-violet-100 text-violet-700",
  },
  admin: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-700",
  },
  member: {
    border: "border-rose-200",
    bg: "bg-rose-50",
    text: "text-rose-700",
    badge: "bg-rose-100 text-rose-700",
  },
  "finance-setup": {
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700",
  },
  "finance-kassenbuch": {
    border: "border-teal-200",
    bg: "bg-teal-50",
    text: "text-teal-700",
    badge: "bg-teal-100 text-teal-700",
  },
  "finance-reports": {
    border: "border-cyan-200",
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    badge: "bg-cyan-100 text-cyan-700",
  },
  "membership-setup": {
    border: "border-yellow-200",
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    badge: "bg-yellow-100 text-yellow-700",
  },
  "membership-manage": {
    border: "border-orange-200",
    bg: "bg-orange-50",
    text: "text-orange-700",
    badge: "bg-orange-100 text-orange-700",
  },
  "membership-stripe": {
    border: "border-violet-200",
    bg: "bg-violet-50",
    text: "text-violet-700",
    badge: "bg-violet-100 text-violet-700",
  },
};

const PHASE_LABELS: Record<string, string> = {
  setup: "1",
  teaching: "2",
  parents: "3",
  admin: "★",
  member: "♥",
  "finance-setup": "1",
  "finance-kassenbuch": "2",
  "finance-reports": "3",
  "membership-setup": "1",
  "membership-manage": "2",
  "membership-stripe": "3",
};

export function MadrasaGuide({ phases }: MadrasaGuideProps) {
  const [openPhase, setOpenPhase] = useState<string | null>(
    phases[0]?.phase ?? null,
  );
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleToggle = (phaseKey: string, wasOpen: boolean) => {
    setOpenPhase(wasOpen ? null : phaseKey);
    // Wait for layout to settle, then keep clicked header in view.
    // Prevents content-shift jump when collapsing a long open phase above.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const btn = buttonRefs.current[phaseKey];
        btn?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };

  return (
    <div className="space-y-4">
      {phases.map((phase) => {
        const isOpen = openPhase === phase.phase;
        const colors = PHASE_COLORS[phase.phase] || PHASE_COLORS.setup;

        return (
          <div
            key={phase.phase}
            className={`overflow-hidden rounded-xl border ${colors.border} bg-white`}
          >
            <button
              ref={(el) => {
                buttonRefs.current[phase.phase] = el;
              }}
              type="button"
              className={`flex w-full items-center gap-3 px-5 py-4 text-left transition-colors ${
                isOpen ? colors.bg : "hover:bg-gray-50"
              }`}
              aria-expanded={isOpen}
              aria-controls={`madrasa-panel-${phase.phase}`}
              onClick={() => handleToggle(phase.phase, isOpen)}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${colors.badge}`}
              >
                {PHASE_LABELS[phase.phase] || "?"}
              </span>
              <span className={`flex-1 text-sm font-semibold ${colors.text}`}>
                {phase.title}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>
            <div
              id={`madrasa-panel-${phase.phase}`}
              role="region"
              hidden={!isOpen}
              className="border-t border-gray-100 px-5 py-5"
            >
              <div className="space-y-4">
                {phase.steps.map((step, i) => (
                  <GuideStepCard
                    key={i}
                    index={i}
                    title={step.title}
                    desc={step.desc}
                    screenshotKey={step.screenshotKey}
                    screenshotAvailable={step.screenshotAvailable}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
