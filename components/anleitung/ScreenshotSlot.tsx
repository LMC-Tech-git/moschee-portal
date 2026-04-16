import Image from "next/image";

// Set value to true once the file exists in /public/screenshots/<key>.png
const SCREENSHOTS: Record<string, boolean> = {
  "admin-settings": false,
  "prayer-times": false,
  "events-list": false,
  donations: false,
  members: false,
  posts: false,
  madrasa: false,
};

interface ScreenshotSlotProps {
  screenshotKey: string;
  label?: string;
  aspectRatio?: string;
}

export function ScreenshotSlot({
  screenshotKey,
  label,
  aspectRatio = "16/9",
}: ScreenshotSlotProps) {
  const hasImage = !!screenshotKey && SCREENSHOTS[screenshotKey] === true;

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
