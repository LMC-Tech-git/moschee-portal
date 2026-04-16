import Image from "next/image";
import type { ScreenshotKey } from "@/lib/docs/guide";

const SCREENSHOT_KEYS = [
  "madrasa-settings",
  "madrasa-students",
  "madrasa-fees",
  "madrasa-attendance",
  "madrasa-parent",
] as const;

// Set to true once file exists in /public/screenshots/<key>.png
const AVAILABLE: Record<ScreenshotKey, boolean> = {
  "madrasa-settings": false,
  "madrasa-students": false,
  "madrasa-fees": false,
  "madrasa-attendance": false,
  "madrasa-parent": false,
};

interface ScreenshotSlotProps {
  screenshotKey: ScreenshotKey;
  label?: string;
  aspectRatio?: string;
}

export function ScreenshotSlot({
  screenshotKey,
  label,
  aspectRatio = "16/9",
}: ScreenshotSlotProps) {
  const hasImage = AVAILABLE[screenshotKey] === true;

  if (hasImage) {
    return (
      <div
        style={{ aspectRatio }}
        className="relative w-full overflow-hidden rounded-xl border border-gray-200"
      >
        <Image
          src={`/screenshots/${screenshotKey}.png`}
          alt={label || screenshotKey}
          fill
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      style={{ aspectRatio }}
      className="flex w-full items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50"
    >
      <p className="text-center font-mono text-xs text-gray-400">
        {label || screenshotKey}
      </p>
    </div>
  );
}
