import { useState } from "react";
import type { PatchedFixture } from "@/lib/dmx";
import { getDef, getMode } from "@/lib/dmx";

export type PixelFilter = "all" | "pixel" | "single";
export interface FixtureFilter { brand: string; model: string; pixel: PixelFilter }

/** Pure filter shared by GRID and PIXEL light pickers. */
export function matchFilter(f: PatchedFixture, flt: FixtureFilter) {
  const d = getDef(f.defId);
  if (flt.brand && d.brand !== flt.brand) return false;
  if (flt.model && d.model !== flt.model) return false;
  const px = getMode(f).pixels ?? 0;
  if (flt.pixel === "pixel" && px <= 1) return false;
  if (flt.pixel === "single" && px > 1) return false;
  return true;
}

export function useFixtureFilter() {
  return useState<FixtureFilter>({ brand: "", model: "", pixel: "all" });
}

const sel = "min-w-0 flex-1 rounded-md border border-input bg-surface-elevated px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary";

export function FixtureFilterBar({ fixtures, value, onChange }: { fixtures: PatchedFixture[]; value: FixtureFilter; onChange: (v: FixtureFilter) => void }) {
  const defs = fixtures.map((f) => getDef(f.defId));
  const brands = [...new Set(defs.map((d) => d.brand))].sort();
  const models = [...new Set(defs.filter((d) => !value.brand || d.brand === value.brand).map((d) => d.model))].sort();
  return (
    <div className="flex flex-wrap gap-1">
      <select aria-label="Filter by pixel" value={value.pixel} onChange={(e) => onChange({ ...value, pixel: e.target.value as PixelFilter })} className={sel}>
        <option value="all">All types</option><option value="pixel">Pixel</option><option value="single">No pixels</option>
      </select>
      <select aria-label="Filter by manufacturer" value={value.brand} onChange={(e) => onChange({ ...value, brand: e.target.value, model: "" })} className={sel}>
        <option value="">All manufacturers</option>{brands.map((b) => <option key={b} value={b}>{b}</option>)}
      </select>
      <select aria-label="Filter by model" value={value.model} onChange={(e) => onChange({ ...value, model: e.target.value })} className={sel}>
        <option value="">All models</option>{models.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  );
}
