"use client";

import { useState, useEffect, useCallback } from "react";
import { VALID_ROLES } from "@/lib/docs/guide";
import type { Role } from "@/lib/docs/guide";
import { GuideStepCard } from "./GuideStepCard";

export interface TranslatedGuideStep {
  title: string;
  desc: string;
  screenshotKey?: string;
}

export interface TranslatedRoleGuide {
  role: Role;
  steps: TranslatedGuideStep[];
}

interface GuideRoleTabsProps {
  guides: TranslatedRoleGuide[];
  labels: Record<Role, string>;
}

function isRole(value: string): value is Role {
  return (VALID_ROLES as string[]).includes(value);
}

function getInitialRole(): Role {
  if (typeof window === "undefined") return "admin";
  const hash = window.location.hash.replace("#", "");
  if (isRole(hash)) return hash;
  const stored = localStorage.getItem("guideRole");
  if (stored && isRole(stored)) return stored;
  return "admin";
}

export function GuideRoleTabs({ guides, labels }: GuideRoleTabsProps) {
  const [role, setRole] = useState<Role>(() => getInitialRole());

  const scrollToGuide = useCallback(() => {
    if (typeof window === "undefined") return;
    const el = document.getElementById("guide-section");
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: "smooth" });
  }, []);

  function handleTabChange(newRole: Role) {
    setRole(newRole);
    localStorage.setItem("guideRole", newRole);
    const url = new URL(window.location.href);
    url.hash = newRole;
    window.history.replaceState(null, "", url.toString());
    scrollToGuide();
  }

  // Sync with browser back/forward
  useEffect(() => {
    const onHashChange = () => {
      const raw = window.location.hash.replace("#", "");
      if (isRole(raw)) setRole(raw);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // On mount: scroll to section if hash present
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      scrollToGuide();
    }
  }, [scrollToGuide]);

  const activeGuide = guides.find((g) => g.role === role);

  return (
    <div>
      {/* Tab bar */}
      <div
        className="mb-6 flex gap-2 overflow-x-auto scrollbar-none rounded-xl bg-gray-100 p-1"
        role="tablist"
        aria-label="Rolle auswählen"
      >
        {guides.map((g) => (
          <button
            key={g.role}
            role="tab"
            type="button"
            aria-selected={role === g.role}
            aria-controls={`guide-panel-${g.role}`}
            id={`guide-tab-${g.role}`}
            onClick={() => handleTabChange(g.role)}
            className={`flex-1 shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              role === g.role
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {labels[g.role]}
          </button>
        ))}
      </div>

      {/* Steps */}
      {activeGuide && (
        <div
          id={`guide-panel-${role}`}
          role="tabpanel"
          aria-labelledby={`guide-tab-${role}`}
          className="space-y-4"
        >
          {activeGuide.steps.map((step, i) => (
            <GuideStepCard
              key={i}
              index={i}
              title={step.title}
              desc={step.desc}
              screenshotKey={step.screenshotKey}
            />
          ))}
        </div>
      )}
    </div>
  );
}
