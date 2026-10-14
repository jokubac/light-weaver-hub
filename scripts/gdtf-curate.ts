// Curates public/gdtf-library in place: keeps professional cinema/theatre/event brands,
// normalizes brand names and keeps the most complete profile per model.
// Usage: bun scripts/gdtf-curate.ts
import { readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { BRAND_ALIASES, canonicalBrand, modelKey, profileScore, specWatts } from "../src/lib/gdtf-curation";

const out = "public/gdtf-library";
const index = JSON.parse(readFileSync(`${out}/library.json`, "utf8"));
const all: any[] = [];
for (let i = 1; i <= index.parts; i++) all.push(...JSON.parse(readFileSync(`${out}/library-${i}.json`, "utf8")));

const best = new Map<string, any>();
for (const d of all) {
  const brand = canonicalBrand(d.brand);
  if (!brand) continue;
  d.brand = brand;
  // Only an exact model-specific lookup may supply missing power.
  if (!d.watts) { const w = specWatts(brand, d.model); if (w) d.watts = w; }
  const k = `${brand}|${modelKey(brand, d.model)}`;
  const cur = best.get(k);
  if (!cur || profileScore(d) > profileScore(cur)) best.set(k, d);
}
const defs = [...best.values()].sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`));

const parts: any[][] = [[]]; let size = 0;
for (const d of defs) { const n = JSON.stringify(d).length; if (size + n > 7e6 && parts.at(-1)!.length) { parts.push([]); size = 0; } parts.at(-1)!.push(d); size += n; }
for (const f of readdirSync(out)) if (/^library-\d+\.json$/.test(f)) rmSync(`${out}/${f}`);
parts.forEach((p, i) => writeFileSync(`${out}/library-${i + 1}.json`, JSON.stringify(p)));
writeFileSync(`${out}/library.json`, JSON.stringify({ parts: parts.length, count: defs.length }));

const keepIcons = new Set(defs.map((d) => d.icon).filter(Boolean));
let removed = 0;
if (existsSync(`${out}/icons`)) for (const f of readdirSync(`${out}/icons`)) if (!keepIcons.has(f)) { rmSync(`${out}/icons/${f}`); removed++; }
console.log(all.length, "->", defs.length, "fixtures;", new Set(defs.map((d) => d.brand)).size, "brands; icons removed", removed, Object.keys(BRAND_ALIASES).length);
