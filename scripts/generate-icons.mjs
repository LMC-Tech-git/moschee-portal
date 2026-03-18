/**
 * PWA Icon Generator
 * Erstellt PNG-Icons aus public/icons/icon.png (512x512)
 * Generiert: icon-192x192.png, icon-180x180.png
 */

import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "public", "icons");
const sourceIcon = join(iconsDir, "icon.png");

const sizes = [
  { size: 192, name: "icon-192x192.png" },
  { size: 180, name: "icon-180x180.png" },
];

console.log("🕌 Moschee-Portal Icon Generator");
console.log(`   Quelle: ${sourceIcon}\n`);

for (const { size, name } of sizes) {
  const output = join(iconsDir, name);
  await sharp(sourceIcon).resize(size, size).png().toFile(output);
  console.log(`✓  ${name} (${size}x${size}px) erstellt`);
}

console.log("\n✅ Alle Icons generiert.");
