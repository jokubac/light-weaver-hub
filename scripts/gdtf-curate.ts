// Curates public/gdtf-library in place: keeps professional cinema/theatre/event brands,
// normalizes brand names and keeps the most complete profile per model.
// Usage: bun scripts/gdtf-curate.ts
import { readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { CHART_CHECKED_GDTF, VERIFIED_EXTRA_MODES, VERIFIED_FIXTURES } from "../src/lib/verified-fixtures";
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
  // Single-channel modes are dimmer-only stubs; keep only modes with 2+ channels.
  d.modes = (d.modes ?? []).filter((m: any) => Number(m.channels) >= 2);
  if (!d.modes.length) continue;
  // Only an exact model-specific lookup may supply missing power.
  if (!d.watts) { const w = specWatts(brand, d.model); if (w) d.watts = w; }
  const k = `${brand}|${modelKey(brand, d.model)}`;
  const cur = best.get(k);
  if (!cur || profileScore(d) > profileScore(cur)) best.set(k, d);
}
// Official manufacturer charts replace community profiles of the same model.
for (const v of VERIFIED_FIXTURES) best.set(`${v.brand}|${modelKey(v.brand, v.model)}`, { ...(best.get(`${v.brand}|${modelKey(v.brand, v.model)}`)?.icon ? { icon: best.get(`${v.brand}|${modelKey(v.brand, v.model)}`).icon } : {}), ...v });
for (const x of VERIFIED_EXTRA_MODES) {
  const d = best.get(`${x.brand}|${modelKey(x.brand, x.model)}`);
  if (d) d.modes = [...d.modes, ...x.modes.filter((m) => !d.modes.some((o: any) => o.name === m.name))];
}
for (const c of CHART_CHECKED_GDTF) {
  const d = best.get(`${c.brand}|${modelKey(c.brand, c.model)}`);
  const src = c.modesFrom ? best.get(`${c.brand}|${modelKey(c.brand, c.modesFrom)}`) : null;
  if (d && src) d.modes = src.modes;
  if (d) d.modes = d.modes.map((m: any) => ({ ...m, source: "manufacturer" }));
  else console.warn("chart-checked model missing:", c.brand, c.model);
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
