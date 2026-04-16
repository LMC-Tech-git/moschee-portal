"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQProps {
  items: FAQItem[];
}

export function FAQ({ items }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white"
        >
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            aria-expanded={openIndex === i}
            aria-controls={`faq-panel-${i}`}
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
          >
            <span className="text-sm font-semibold text-gray-900">
              {item.question}
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 ${
                openIndex === i ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </button>
          <div
            id={`faq-panel-${i}`}
            role="region"
            hidden={openIndex !== i}
            className="border-t border-gray-100 px-5 py-4"
          >
            <p className="text-sm leading-relaxed text-gray-600">
              {item.answer}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
