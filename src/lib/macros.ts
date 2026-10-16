// Macro pad: keyboard keys (HID macro pads) or MIDI buttons trigger user-chosen console actions.

export type MacroAction =
  | "int_up" | "int_down" | "int_set" | "cct_up" | "cct_down" | "cct_set" | "cct_reset"
  | "flash_up" | "flash_down" | "light_on" | "light_off"
  | "next" | "prev" | "select" | "flash" | "go" | "back" | "play" | "pause" | "blackout" | "undo" | "redo" | "deselect" | "all"
  | "next_add" | "prev_add" | "invert" | "copy" | "paste" | "keypad" | "int_half" | "light_toggle" | "cue_reset" | "fx_toggle" | "pixel_toggle";

export interface Macro { id: string; key: string | null; action: MacroAction; amount: number }

export const MACRO_ACTIONS: { id: MacroAction; label: string; unit?: "%" | "K"; def?: number }[] = [
  { id: "int_up", label: "Intensity +", unit: "%", def: 5 },
  { id: "int_down", label: "Intensity −", unit: "%", def: 5 },
  { id: "int_set", label: "Intensity set", unit: "%", def: 50 },
  { id: "cct_up", label: "CCT +", unit: "K", def: 100 },
  { id: "cct_down", label: "CCT −", unit: "K", def: 100 },
  { id: "cct_set", label: "CCT set", unit: "K", def: 5600 },
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

const KEY = "nox-macros-v2";
export const defaultMacros = (): Macro[] => MACRO_ACTIONS.map((a, i) => ({ id: `m${i + 1}`, key: null, action: a.id, amount: a.def ?? 0 }));
export function loadMacros(): Macro[] {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch { /* ignore */ }
  return defaultMacros();
}
export function saveMacros(m: Macro[]) { localStorage.setItem(KEY, JSON.stringify(m)); }
