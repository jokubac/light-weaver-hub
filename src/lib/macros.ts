// Macro pad: keyboard keys (HID macro pads) or MIDI buttons trigger user-chosen console actions.

export type MacroAction =
  | "int_up" | "int_down" | "int_set" | "cct_up" | "cct_down" | "cct_set" | "cct_reset"
  | "flash_up" | "flash_down" | "light_on" | "light_off"
  | "next" | "prev" | "select" | "flash" | "go" | "back" | "play" | "pause" | "blackout" | "undo" | "redo" | "deselect" | "all"
  | "next_add" | "prev_add" | "invert" | "copy" | "paste" | "keypad" | "int_half" | "light_toggle" | "cue_reset" | "fx_toggle" | "pixel_toggle"
  | "int_fader" | "cct_fader" | "gm_fader" | "filter" | "hue_up" | "hue_down" | "sat_up" | "sat_down"
  | "group" | "group_new" | "strike" | "checkout" | "locate" | "wrap" | "trigger"
  | "hue_fader" | "sat_fader" | "park" | "unpark" | "blind";

/** Full range of each fader macro in its display units; user limits must sit inside it. */
export const FADER_RANGE: Partial<Record<MacroAction, [number, number, number]>> = {
  int_fader: [0, 100, 1], cct_fader: [2000, 10000, 50], gm_fader: [-100, 100, 1], hue_fader: [0, 360, 1], sat_fader: [0, 100, 1],
};
/** Fader limits (e.g. 5%..70%) clamped to the full range and kept in order. */
export function faderLimits(action: MacroAction, lo?: number, hi?: number): [number, number] {
  const r = FADER_RANGE[action]; if (!r) return [0, 0];
  const a = Math.max(r[0], Math.min(r[1], lo ?? r[0])), b = Math.max(r[0], Math.min(r[1], hi ?? r[1]));
  return a <= b ? [a, b] : [b, a];
}

/** param: gel id (Filters) or group name (Group). release: the button was let go (hold macros). */
export interface Macro { id: string; key: string | null; action: MacroAction; amount: number; param?: string | undefined; release?: boolean | undefined }

export const MACRO_ACTIONS: { id: MacroAction; label: string; unit?: "%" | "K"; def?: number; fader?: boolean; hold?: boolean; pick?: "gel" | "group" | "trigger" }[] = [
  { id: "int_up", label: "Intensity +", unit: "%", def: 5 },
  { id: "int_down", label: "Intensity −", unit: "%", def: 5 },
  { id: "int_set", label: "Intensity set", unit: "%", def: 50 },
  { id: "int_fader", label: "Intensity fader", fader: true },
  { id: "cct_up", label: "CCT +", unit: "K", def: 100 },
  { id: "cct_down", label: "CCT −", unit: "K", def: 100 },
  { id: "cct_set", label: "CCT set", unit: "K", def: 5600 },
  { id: "cct_fader", label: "CCT fader", fader: true },
  { id: "filter", label: "Filters", pick: "gel" },
  { id: "gm_fader", label: "G/M fader", fader: true },
  { id: "hue_up", label: "Hue +", unit: "%", def: 5 },
  { id: "hue_down", label: "Hue −", unit: "%", def: 5 },
  { id: "sat_up", label: "Saturation +", unit: "%", def: 5 },
  { id: "sat_down", label: "Saturation −", unit: "%", def: 5 },
  { id: "play", label: "Play Cue" },
  { id: "pause", label: "Pause Cue" },
  { id: "cue_reset", label: "Reset Cue" },
  { id: "fx_toggle", label: "Play/Stop Effects" },
  { id: "pixel_toggle", label: "Play/Stop Pixel Fx" },
  { id: "prev", label: "Previous Light" },
  { id: "next", label: "Next Light" },
  { id: "all", label: "Select all" },
  { id: "copy", label: "Copy" },
  { id: "paste", label: "Paste" },
  { id: "undo", label: "Undo" },
  { id: "redo", label: "Redo" },
  { id: "light_off", label: "Turn Off" },
  { id: "light_on", label: "Turn On" },
  { id: "select", label: "Select" },
  { id: "invert", label: "Invert selection" },
  { id: "group", label: "Group", pick: "group" },
  { id: "trigger", label: "Trigger", pick: "trigger" },
  { id: "group_new", label: "+ Group" },
  { id: "strike", label: "Lamp Reset (Strike)" },
  { id: "checkout", label: "Check out!", hold: true },
  { id: "locate", label: "Locate!", hold: true },
  { id: "wrap", label: "Wrap!" },
  { id: "hue_fader", label: "Hue fader", fader: true },
  { id: "sat_fader", label: "Saturation fader", fader: true },
  { id: "park", label: "Park / Unpark" },
  { id: "unpark", label: "Unpark all" },
  { id: "blind", label: "Blind" },
  { id: "blackout", label: "Blackout" },
  { id: "go", label: "GO" },
  { id: "back", label: "Back" },
  { id: "flash", label: "Flash" },
  { id: "light_toggle", label: "On / Off" },
  { id: "int_half", label: "Intensity 50%" },
  { id: "deselect", label: "Deselect" },
  { id: "fx_toggle_all", label: "" } as never,
];

/** Turns a macro into a relative/absolute command for the selected fixtures. */
export function macroCommand(m: Macro): { level?: number; levelDelta?: number; cct?: number; cctDelta?: number } | null {
  switch (m.action) {
    case "int_up": return { levelDelta: m.amount / 100 };
    case "int_down": return { levelDelta: -m.amount / 100 };
    case "int_set": return { level: m.amount / 100 };
    case "cct_up": return { cctDelta: m.amount };
    case "cct_down": return { cctDelta: -m.amount };
    case "cct_set": return { cct: m.amount };
    case "cct_reset": return { cct: 5600 };
    case "light_on": return { level: 1 };
    case "light_off": return { level: 0 };
    case "int_half": return { level: 0.5 };
    case "int_fader": return { level: m.amount / 100 };
    case "cct_fader": return { cct: m.amount };
    default: return null;
  }
}

/** Hue ± wraps round the wheel (amount % of 360°); Saturation ± clamps 0..1. */
export function colourStep(m: Macro, f: { hue: number; saturation: number }): { hue?: number; saturation?: number } | null {
  const d = m.amount / 100;
  switch (m.action) {
    case "hue_up": return { hue: (((f.hue + d * 360) % 360) + 360) % 360 };
    case "hue_down": return { hue: (((f.hue - d * 360) % 360) + 360) % 360 };
    case "sat_up": return { saturation: Math.min(1, f.saturation + d) };
    case "sat_down": return { saturation: Math.max(0, f.saturation - d) };
    default: return null;
  }
}

/** Double tap window for "Deselect" → select all. */
export const DOUBLE_TAP_MS = 400;

/**
 * Next/Previous light step over the console order.
 * Plain (add = false) moves the selection to the single light; add = true keeps earlier picks.
 */
export function stepSelection(order: string[], selection: string[], lastPick: string | null, dir: 1 | -1, add = false): { selection: string[]; lastPick: string } | null {
  if (!order.length) return null;
  const cur = lastPick ? order.indexOf(lastPick) : -1;
  const next = order[(cur + dir + order.length) % order.length];
  if (!next) return null;
  return { selection: add ? (selection.includes(next) ? selection : [...selection, next]) : [next], lastPick: next };
}

/** Stable key name including modifiers, e.g. "Ctrl+Shift+KeyA" or "F13". */
export function keyName(e: { code: string; key: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }): string | null {
  if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return null;
  const mods = [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", e.metaKey && "Meta"].filter(Boolean);
  return [...mods, e.code || e.key].join("+");
}

const KEY = "nox-macros-v3";
export const defaultMacros = (): Macro[] => MACRO_ACTIONS.map((a, i) => ({ id: `m${i + 1}`, key: null, action: a.id, amount: a.def ?? 0 }));
export function loadMacros(): Macro[] {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch { /* ignore */ }
  return defaultMacros();
}
export function saveMacros(m: Macro[]) { localStorage.setItem(KEY, JSON.stringify(m)); }
