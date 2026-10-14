// Battery runtime estimates for lights running on V-mount / Instagrid / other packs.
import type { PatchedFixture } from "./dmx";

export type PowerKind = "mains" | "vmount" | "instagrid" | "other";
export interface PowerSource {
  kind: PowerKind;
  kwh: number; // capacity
  charge: number; // 0-1 charge when set
  watts: number; // light's full-power draw
  usedWh: number; // energy drawn since `charge` was set
}

export const BATTERY_PRESETS: { kind: PowerKind; label: string; kwh: number }[] = [
  { kind: "vmount", label: "V-mount 98 Wh", kwh: 0.098 },
  { kind: "vmount", label: "V-mount 150 Wh", kwh: 0.15 },
  { kind: "vmount", label: "V-mount 230 Wh", kwh: 0.23 },
  { kind: "vmount", label: "V-mount 290 Wh", kwh: 0.29 },
  { kind: "vmount", label: "2× V-mount 290 Wh", kwh: 0.58 },
  { kind: "instagrid", label: "Instagrid ONE", kwh: 1.07 },
  { kind: "instagrid", label: "Instagrid ONE max", kwh: 2.1 },
];

/** Draw factor: LEDs pull roughly proportional to output. */
export const drawFactor = (f: PatchedFixture, level: number) => (f.on === false ? 0 : Math.max(0.02, f.intensity * level));

export function batteryStatus(p: PowerSource, f: PatchedFixture, level: number) {
  const cap = p.kwh * 1000;
  const left = Math.max(0, cap * p.charge - p.usedWh);
  const pct = cap > 0 ? left / cap : 0;
  const w = p.watts * drawFactor(f, level);
  const hours = w > 0 ? left / w : Infinity;
  return { pct, hours, watts: w };
}

export const fmtHours = (h: number) => (!Number.isFinite(h) ? "—" : `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}m`);

// Exact model-specific data only; unknown power is zero internally, never a guessed load.
export function fixtureWatts(model: string): number {
  const normalized = model.toLowerCase().replace(/[^a-z0-9]/g, "");
  const known: Record<string, number> = {
    arriskypanels30c: 250, arriskypanels60c: 450, arriskypanels120c: 800, arriskypanels360c: 1600,
  };
  return known[normalized] ?? 0;
}
