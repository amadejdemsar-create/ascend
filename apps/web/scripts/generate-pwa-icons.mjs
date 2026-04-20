/**
 * Generate PWA icons for Ascend app.
 * Uses sharp (available via Next.js) to convert SVG to PNG.
 *
 * Run: node scripts/generate-pwa-icons.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ICONS_DIR = join(ROOT, "public", "icons");

mkdirSync(ICONS_DIR, { recursive: true });

const VIOLET = "#8B5CF6";
const WHITE = "#FFFFFF";

function createSvg(size, maskable = false) {
  const padding = maskable ? size * 0.1 : 0;
  const center = size / 2;
  const arrowSize = (size - padding * 2) * 0.35;
  const arrowTop = center - arrowSize * 0.55;
  const arrowBottom = center + arrowSize * 0.35;
  const arrowLeft = center - arrowSize * 0.5;
  const arrowRight = center + arrowSize * 0.5;
  const strokeWidth = size * 0.06;

  // Upward chevron/arrow pointing up
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : size * 0.18}" fill="${VIOLET}"/>
  <polyline
    points="${arrowLeft},${arrowBottom} ${center},${arrowTop} ${arrowRight},${arrowBottom}"
    fill="none"
    stroke="${WHITE}"
    stroke-width="${strokeWidth}"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <line
    x1="${center}" y1="${arrowTop}"
    x2="${center}" y2="${center + arrowSize * 0.55}"
    stroke="${WHITE}"
    stroke-width="${strokeWidth}"
    stroke-linecap="round"
  />
</svg>`;
}

async function generateIcon(size, filename, maskable = false) {
  const svg = createSvg(size, maskable);
  const svgBuffer = Buffer.from(svg);

  // Dynamic import sharp (available as next.js dependency)
  const sharp = (await import("sharp")).default;
  const pngBuffer = await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toBuffer();

  const outputPath = join(ICONS_DIR, filename);
  writeFileSync(outputPath, pngBuffer);
  console.log(`Generated: ${outputPath} (${pngBuffer.length} bytes)`);
}

await generateIcon(192, "icon-192x192.png", false);
await generateIcon(512, "icon-512x512.png", false);
await generateIcon(512, "icon-maskable-512x512.png", true);

console.log("All PWA icons generated.");
