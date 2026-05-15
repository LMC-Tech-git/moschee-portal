"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, CheckCircle2 } from "lucide-react";

type Billing = "monthly" | "yearly";

interface PlanCardProps {
  id: "small" | "standard";
  priceMonthly: number;
  billing: Billing;
  highlight?: boolean;
}

function PlanCard({ id, priceMonthly, billing, highlight }: PlanCardProps) {
  const t = useTranslations("pricing");
  const displayPrice = billing === "monthly" ? priceMonthly : priceMonthly * 10;
  const suffix = billing === "monthly" ? t("billing.perMonth") : t("billing.perYear");

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-white p-8 shadow-sm transition-shadow hover:shadow-md ${
        highlight
          ? "border-emerald-500 ring-2 ring-emerald-100"
          : "border-gray-200"
      }`}
    >
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
            {t("plans.recommended")}
          </span>
        </div>
      )}

      <div className="mb-8">
        <h3 className="text-xl font-bold text-gray-900">
          {t(`plans.${id}.name`)}
        </h3>
      </div>

      <div className="mb-10 flex-1">
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-extrabold tracking-tight text-gray-900">
            {displayPrice} €
          </span>
          <span className="text-sm font-medium text-gray-500">
            {suffix}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-400">{t("billing.vatNote")}</p>
        {billing === "yearly" && (
          <p className="mt-3 inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
            {t("billing.yearlyHint")}
          </p>
        )}
      </div>

      <Link
        href={`/kontakt?tarif=${id}&billing=${billing}`}
        className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${
          highlight
            ? "bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-lg"
            : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:shadow-md"
        }`}
      >
        {t(`plans.${id}.cta`)}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

export function PricingPlans() {
  const t = useTranslations("pricing");
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <div>
      {/* "Alle Features inklusive" Hinweis */}
      <div className="mb-6 flex justify-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {t("allFeaturesIncluded")}
        </p>
      </div>

      {/* Billing-Toggle */}
      <div className="mb-10 flex justify-center">
        <div
          role="tablist"
          aria-label={t("billing.monthly") + " / " + t("billing.yearly")}
          className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white p-1 shadow-sm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={billing === "monthly"}
            onClick={() => setBilling("monthly")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              billing === "monthly"
                ? "bg-emerald-600 text-white shadow"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t("billing.monthly")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={billing === "yearly"}
            onClick={() => setBilling("yearly")}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              billing === "yearly"
                ? "bg-emerald-600 text-white shadow"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t("billing.yearly")}
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                billing === "yearly"
                  ? "bg-white text-emerald-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {t("billing.yearlyHint")}
            </span>
          </button>
        </div>
      </div>

      {/* Tarif-Cards */}
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
        <PlanCard id="small" priceMonthly={49} billing={billing} />
        <PlanCard id="standard" priceMonthly={79} billing={billing} highlight />
      </div>
    </div>
  );
}
