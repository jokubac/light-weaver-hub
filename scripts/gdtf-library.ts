// Builds public/gdtf-library from extracted GDTF description.xml files (dev-time tool).
// Usage: bun scripts/gdtf-library.ts <xmlDir> <iconDir>
import { JSDOM } from "jsdom";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, statSync } from "node:fs";
const [xmlDir, iconDir] = process.argv.slice(2);
(globalThis as any).DOMParser = new JSDOM("").window.DOMParser;
const { parseDescriptionXml } = await import("../src/lib/gdtf");
const out = "public/gdtf-library";
mkdirSync(`${out}/icons`, { recursive: true });
const defs: any[] = []; const seen = new Set<string>();
for (const f of readdirSync(xmlDir!)) {
  const p = `${xmlDir}/${f}`;
  if (statSync(p).size > 8e6) continue;
  let d; try { d = parseDescriptionXml(readFileSync(p, "utf8")); } catch { continue; }
  if (!d || seen.has(d.id)) continue;
  seen.add(d.id);
  const key = f.replace(/\.xml$/, "");
  const ico = `${iconDir}/${key}.webp`;
  if (existsSync(ico)) { copyFileSync(ico, `${out}/icons/${d.id}.webp`); d.icon = `${d.id}.webp`; }
  defs.push(d);
}
defs.sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`));
writeFileSync(`${out}/library.json`, JSON.stringify(defs));
console.log(defs.length, "fixtures");
