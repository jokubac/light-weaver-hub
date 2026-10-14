// Gaffer call sheet / rental order generator: power load balancing, generator sizing,
// equipment list and battery charging plan — all pure functions, no DOM access.
import { getDef, type PatchedFixture } from "./dmx";
import { batteryStatus, drawFactor, fmtHours, type PowerSource } from "./power";
import { fixtureWatts } from "./power";

/* ---------------- Wattage ---------------- */

/** Use profile or user-supplied power; unknown loads are excluded, never estimated. */
export function fixtureWattage(f: PatchedFixture): number {
  const def = getDef(f.defId);
  const withWatts = def as typeof def & { watts?: number };
  if (typeof withWatts.watts === "number") return withWatts.watts;
  if (f.power?.watts) return f.power.watts;
  return fixtureWatts(`${def.brand} ${def.model}`);
}

/* ---------------- Phase balancing ---------------- */

export interface PhaseLoad {
  phase: "L1" | "L2" | "L3";
  watts: number;
  amps: number;
  fixtures: { uid: string; name: string; watts: number }[];
}
export interface PowerPlan {
  phases: PhaseLoad[];
  totalW: number;
  totalKw: number;
  totalA230: number; // what the whole rig would draw on a single 230V line
  imbalancePct: number; // (max-min)/avg over the three phases, 0 when balanced
  generatorKva: number;
  generatorThreePhase: boolean;
  generatorNote: string;
}

const VOLTAGE = 230;
const GEN_SIZES_KVA = [2.2, 3.5, 6, 12, 20, 30, 60, 100];

/** Greedy largest-first bin packing across three 230V phases (classic gaffer "phase balancing"). */
export function balancePhases(fixtures: PatchedFixture[]): PhaseLoad[] {
  const phases: PhaseLoad[] = [
    { phase: "L1", watts: 0, amps: 0, fixtures: [] },
    { phase: "L2", watts: 0, amps: 0, fixtures: [] },
    { phase: "L3", watts: 0, amps: 0, fixtures: [] },
  ];
  const loads = fixtures
    .map((f) => ({ uid: f.uid, name: f.name, watts: fixtureWattage(f) }))
    .filter((f) => f.watts > 0)
    .sort((a, b) => b.watts - a.watts);
  for (const load of loads) {
    const lightest = phases.reduce((min, p) => (p.watts < min.watts ? p : min), phases[0]!);
    lightest.watts += load.watts;
    lightest.fixtures.push(load);
  }
  for (const p of phases) p.amps = p.watts / VOLTAGE;
  return phases;
}

function suggestGenerator(totalKw: number): { kva: number; threePhase: boolean; note: string } {
  const pf = 0.9;
  const apparentKva = totalKw / pf;
  const requiredKva = apparentKva / 0.8; // keep load under 80% of rated capacity
  const kva = GEN_SIZES_KVA.find((s) => s >= requiredKva) ?? GEN_SIZES_KVA[GEN_SIZES_KVA.length - 1]!;
  const threePhase = kva > 6; // above ~6 kVA a single 230V line gets impractical, go 400V 3-phase
  const note = threePhase
    ? `400 V three-phase (16 A or 32 A CEE per phase depending on genset), run at ≤80% load`
    : `230 V single-phase (16 A Schuko/CEE), run at ≤80% load`;
  return { kva, threePhase, note };
}

export function buildPowerPlan(fixtures: PatchedFixture[]): PowerPlan {
  const phases = balancePhases(fixtures);
  const totalW = phases.reduce((a, p) => a + p.watts, 0);
  const totalKw = totalW / 1000;
  const totalA230 = totalW / VOLTAGE;
  const watts = phases.map((p) => p.watts);
  const avg = totalW / 3;
  const imbalancePct = avg > 0 ? ((Math.max(...watts) - Math.min(...watts)) / avg) * 100 : 0;
  const gen = suggestGenerator(totalKw);
  return { phases, totalW, totalKw, totalA230, imbalancePct, generatorKva: gen.kva, generatorThreePhase: gen.threePhase, generatorNote: gen.note };
}

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
