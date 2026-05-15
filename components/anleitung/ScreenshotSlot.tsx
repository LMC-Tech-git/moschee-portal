import Image from "next/image";
import type { ScreenshotKey } from "@/lib/docs/guide";

interface ScreenshotSlotProps {
  screenshotKey: ScreenshotKey;
  label?: string;
  aspectRatio?: string;
  available?: boolean;
}

export function ScreenshotSlot({
  screenshotKey,
  label,
  aspectRatio = "16/9",
  available = false,
}: ScreenshotSlotProps) {
  if (available) {
    return (
      <div
        style={{ aspectRatio }}
        className="relative w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
      >
        <Image
          src={`/screenshots/${screenshotKey}.png`}
          alt={label || screenshotKey}
          fill
          sizes="(max-width: 768px) 100vw, 720px"
          className="object-cover object-top"
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
