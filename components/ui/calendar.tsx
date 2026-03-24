"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={de}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col",
        month: "space-y-3",
        month_caption: "flex justify-center relative items-center h-9 mb-1",
        caption_label: "text-sm font-semibold text-gray-800",
        nav: "absolute inset-x-0 top-3 flex items-center justify-between px-1",
        button_previous:
          "h-7 w-7 flex items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40",
        button_next:
          "h-7 w-7 flex items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40",
        month_grid: "w-full border-collapse",
        weekdays: "flex mb-1",
        weekday:
          "w-9 text-center text-xs font-medium text-gray-400 rounded-md py-1",
        week: "flex w-full",
        day: "relative h-9 w-9 p-0 text-center",
        day_button: cn(
          "h-9 w-9 rounded-md p-0 text-sm font-normal text-gray-800",
          "hover:bg-gray-100 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          "aria-selected:bg-blue-600 aria-selected:text-white aria-selected:hover:bg-blue-700"
        ),
        selected: "[&>button]:bg-blue-600 [&>button]:text-white [&>button]:hover:bg-blue-700",
        today: "[&>button]:font-bold [&>button]:text-blue-600 [&>button.aria-selected\\:bg-blue-600]:text-white",
        outside: "opacity-40",
        disabled: "opacity-30 pointer-events-none",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}
