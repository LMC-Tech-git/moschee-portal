import { ScreenshotSlot } from "./ScreenshotSlot";

interface GuideStepCardProps {
  index: number;
  title: string;
  desc: string;
  screenshotKey?: string;
}

export function GuideStepCard({
  index,
  title,
  desc,
  screenshotKey,
}: GuideStepCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:gap-6">
      {/* Step number */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
        {index + 1}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">{desc}</p>
        </div>
        {screenshotKey && (
          <ScreenshotSlot screenshotKey={screenshotKey} aspectRatio="16/7" />
        )}
      </div>
    </div>
  );
}
