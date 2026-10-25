// Gaffer call sheet / rental order generator: equipment list and battery charging plan —
// all pure functions, no DOM access.
import { getDef, type PatchedFixture } from "./dmx";
import { batteryStatus, drawFactor, fmtHours, type PowerSource } from "./power";

/* ---------------- Equipment list ---------------- */

export interface EquipmentLine {
  id: string;
  label: string;
  category: "fixture" | "power" | "data" | "stand" | "grip" | "modifier" | "custom";
  qty: number;
}

function classify(f: PatchedFixture) {
  const def = getDef(f.defId);
  const name = `${def.brand} ${def.model} ${f.icon ?? ""}`.toLowerCase();
  const watts = fixtureWattage(f);
  const wireless = /mc\b|titan|helios|hyperion|pixelbrick|ax1|ax3|ax5|ax9|nyx|leoht|dash/.test(name);
  const isPractical = f.icon === "practical" || f.icon === "bulb" || /practical|bulb/.test(name);
  const isBig = watts >= 800 || f.icon === "tube-huge" || /skypanel s360|s120|m40|m90|arrimax|evoke 2400|dyno 1200|orbiter/.test(name);
  const isPanelOrTube = f.icon?.startsWith("tube") || f.icon === "panel" || /tube|panel|skypanel|pavotube|litemat|gemini/.test(name);
  return { wireless, isPractical, isBig, isPanelOrTube };
}

export function buildEquipmentList(fixtures: PatchedFixture[]): EquipmentLine[] {
  const lines = new Map<string, EquipmentLine>();
  const add = (id: string, label: string, category: EquipmentLine["category"], qty = 1) => {
    const line = lines.get(id);
    if (line) line.qty += qty; else lines.set(id, { id, label, category, qty });
  };

  // group fixtures by model
  const byModel = new Map<string, { label: string; count: number }>();
  for (const f of fixtures) {
    const def = getDef(f.defId);
    const key = def.id;
    const entry = byModel.get(key);
    if (entry) entry.count += 1; else byModel.set(key, { label: `${def.brand} ${def.model}`, count: 1 });
  }
  for (const [id, { label, count }] of byModel) add(`fixture:${id}`, label, "fixture", count);

  for (const f of fixtures) {
    const { wireless, isPractical, isBig, isPanelOrTube } = classify(f);
    // power
    add("power-cable", "Power cable (edison/schuko, 5m)", "power", 1);
    if (isBig) add("power-extension", "Extension cable 20m", "power", 1);
    // DMX / wireless receiver
    if (!wireless) add("dmx-receiver", "DMX/CRMX wireless receiver + 5-pin cable", "data", 1);
    // stand
    if (isPractical) { /* no stand needed */ }
    else if (isBig) add("stand-combo", "Combo stand / roller stand", "stand", 1);
    else if (isPanelOrTube) add("stand-cstand", "C-stand + grip head", "stand", 1);
    else add("stand-cstand", "C-stand + grip head", "stand", 1);
    // diffusion / softbox
    if (isPanelOrTube && !isPractical) add("diffusion", "Diffusion / softbox", "modifier", 1);
    // sandbags (one per stand)
    if (!isPractical) add("sandbag", "Sandbag", "grip", 1);
  }
  return Array.from(lines.values());
}

/* ---------------- Battery plan ---------------- */

export interface BatteryPlanItem {
  uid: string;
  name: string;
  watts: number;
  runtimeHours: number;
  batteriesPerShift: number; // how many full batteries are consumed during the shift
  swaps: number; // number of swaps during the shift (batteriesPerShift - 1, min 0)
}

export function buildBatteryPlan(fixtures: PatchedFixture[], shiftHours: number): BatteryPlanItem[] {
  const out: BatteryPlanItem[] = [];
  for (const f of fixtures) {
    if (!f.power) continue;
    const level = Math.max(0.02, f.intensity || 1);
    const { hours } = batteryStatus(f.power, f, level);
    const runtimeHours = Number.isFinite(hours) ? hours : 0;
    const batteriesPerShift = runtimeHours > 0 ? Math.ceil(shiftHours / runtimeHours) : 1;
    out.push({ uid: f.uid, name: f.name, watts: f.power.watts, runtimeHours, batteriesPerShift, swaps: Math.max(0, batteriesPerShift - 1) });
  }
  return out;
}

export { fmtHours, drawFactor };

/* ---------------- Top-level ---------------- */

export interface CallSheetOpts {
  production?: string;
  date?: string;
  location?: string;
  gaffer?: string;
  shiftHours?: number;
}
export interface CallSheet {
  opts: Required<CallSheetOpts>;
  power: PowerPlan;
  equipment: EquipmentLine[];
  battery: BatteryPlanItem[];
}

export function buildCallSheet(fixtures: PatchedFixture[], opts: CallSheetOpts = {}): CallSheet {
  const shiftHours = opts.shiftHours ?? 12;
  return {
    opts: {
      production: opts.production ?? "",
      date: opts.date ?? new Date().toISOString().slice(0, 10),
      location: opts.location ?? "",
      gaffer: opts.gaffer ?? "",
      shiftHours,
    },
    power: buildPowerPlan(fixtures),
    equipment: buildEquipmentList(fixtures),
    battery: buildBatteryPlan(fixtures, shiftHours),
  };
}
