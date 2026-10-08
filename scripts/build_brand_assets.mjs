import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";

// The editable SVG is the source for favicon and installable app icons.
const mark = await readFile("public/brand/synaq-mark.svg", "utf8");
const body = mark.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const appIcon = (maskable) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="app-background" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
    <stop stop-color="#191849"/><stop offset="0.55" stop-color="#0b0e2c"/><stop offset="1" stop-color="#070b22"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="${maskable ? 0 : 108}" fill="url(#app-background)"/>
  ${maskable ? "" : '<rect x="1.5" y="1.5" width="509" height="509" rx="106.5" fill="none" stroke="#5750be" stroke-opacity="0.3" stroke-width="3"/>'}
  <svg x="77" y="90" width="358" height="332" viewBox="-2 -2 408 378">${body}</svg>
</svg>`;

await writeFile("public/icon.svg", mark.replace('width="408" height="378"', 'width="512" height="512"'));
for (const size of [192, 512]) {
  await sharp(Buffer.from(appIcon(false))).resize(size, size).png().toFile(`public/icon-${size}.png`);
}
await sharp(Buffer.from(appIcon(true))).png().toFile("public/icon-maskable-512.png");
console.log("Synaq favicon, 192px/512px app icons and safe-area maskable icon built from SVG");
