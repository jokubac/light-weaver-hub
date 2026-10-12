// Render the current brand source, not a potentially stale raster export.
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const output = process.argv[2] || "ios/App/App/Assets.xcassets/AppIcon.appiconset";
const temp = await mkdtemp(join(tmpdir(), "nox-icons-"));
try {
  await mkdir(output, { recursive: true });
  // iOS applies its own corner mask; supply an opaque, square source.
  const svg = (await readFile("public/nox-logo.svg", "utf8")).replace('rx="64"', 'rx="0"');
  await writeFile(join(temp, "icon.svg"), svg);
  execFileSync("rsvg-convert", ["-w", "1024", "-h", "1024", "-o", join(temp, "icon.png"), join(temp, "icon.svg")]);
  const images = [];
  for (const [idiom, size, scales] of [
    ["iphone", 20, [2, 3]], ["iphone", 29, [2, 3]],
    ["iphone", 40, [2, 3]], ["iphone", 60, [2, 3]],
    ["ipad", 20, [1, 2]], ["ipad", 29, [1, 2]],
    ["ipad", 40, [1, 2]], ["ipad", 76, [1, 2]],
    ["ipad", 83.5, [2]], ["ios-marketing", 1024, [1]],
  ]) {
    for (const scale of scales) {
      const filename = `NOX-${idiom}-${size}@${scale}x.png`;
      const pixels = String(size * scale);
      execFileSync("sips", ["-z", pixels, pixels, join(temp, "icon.png"), "--out", join(output, filename)], { stdio: "ignore" });
      images.push({ idiom, size: `${size}x${size}`, scale: `${scale}x`, filename });
    }
  }
  await writeFile(join(output, "Contents.json"), JSON.stringify({ images, info: { author: "xcode", version: 1 } }, null, 2));
  console.log(`Generated ${images.length} current NOX iOS icons`);
} finally {
  await rm(temp, { recursive: true, force: true });
}