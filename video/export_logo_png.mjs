// Exports the logo SVGs in brand/ as PNGs (transparent backgrounds) for slides.
//
//   node video/export_logo_png.mjs      (run brand/make_logo.py first)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRAND = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "brand");
const PNG = path.join(BRAND, "png");
// [svg name, png name, width in pixels]
const JOBS = [
  ["countersign-logo", "countersign-logo", 2400],
  ["countersign-logo-on-dark", "countersign-logo-on-dark", 2400],
  ["countersign-logo-mono", "countersign-logo-mono", 2400],
  ["countersign-logo-stacked", "countersign-logo-stacked", 1600],
  ["countersign-logo-stacked-on-dark", "countersign-logo-stacked-on-dark", 1600],
  ["countersign-wordmark", "countersign-wordmark", 2000],
  ["countersign-mark", "countersign-mark-1024", 1024],
  ["countersign-mark", "countersign-mark-512", 512],
  ["countersign-mark", "countersign-mark-180", 180],
  ["countersign-mark", "countersign-mark-64", 64],
  ["countersign-mark", "countersign-mark-32", 32],
  ["countersign-mark-light", "countersign-mark-light-512", 512],
  ["countersign-symbol", "countersign-symbol-512", 512],
  ["countersign-symbol-on-dark", "countersign-symbol-on-dark-512", 512],
];

fs.rmSync(PNG, { recursive: true, force: true });
fs.mkdirSync(PNG);
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
for (const [svg, png, width] of JOBS) {
  const text = fs.readFileSync(path.join(BRAND, `${svg}.svg`), "utf8");
  const [, , w, h] = text.match(/viewBox="([^"]+)"/)[1].split(" ").map(Number);
  const height = Math.round((width * h) / w);
  await page.setViewportSize({ width: Math.max(width, 400), height: Math.max(height, 400) }); // Chrome can't make tiny windows
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${width}px;height:${height}px}</style>${text}`);
  await page.locator("svg").screenshot({ path: path.join(PNG, `${png}.png`), omitBackground: true });
  console.log(`${png}.png  ${width}x${height}`);
}
await browser.close();
