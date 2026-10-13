// Macro pad: keyboard keys (HID macro pads) or MIDI buttons trigger user-chosen console actions.

export type MacroAction =
  | "int_up" | "int_down" | "int_set" | "cct_up" | "cct_down" | "cct_set" | "cct_reset"
  | "flash_up" | "flash_down" | "light_on" | "light_off"
  | "next" | "prev" | "select" | "flash" | "go" | "back" | "play" | "pause" | "blackout" | "undo" | "redo" | "deselect" | "all"
  | "next_add" | "prev_add" | "invert" | "copy" | "paste" | "keypad" | "int_half" | "light_toggle";

export interface Macro { id: string; key: string | null; action: MacroAction; amount: number }

export const MACRO_ACTIONS: { id: MacroAction; label: string; unit?: "%" | "K"; def?: number }[] = [
  { id: "int_up", label: "Intensity +", unit: "%", def: 1 },
  { id: "int_down", label: "Intensity −", unit: "%", def: 1 },
  { id: "int_set", label: "Intensity set", unit: "%", def: 100 },
  { id: "int_half", label: "Intensity 50%" },
  { id: "cct_up", label: "CCT +", unit: "K", def: 100 },
  { id: "cct_down", label: "CCT −", unit: "K", def: 100 },
  { id: "cct_set", label: "CCT set", unit: "K", def: 5600 },
  { id: "cct_reset", label: "Reset colour to 5600K" },
  { id: "flash_up", label: "Flash light +100 (full)" },
  { id: "flash_down", label: "Flash light −100 (off)" },
  { id: "light_on", label: "Turn light on" },
  { id: "light_off", label: "Turn light off" },
  { id: "light_toggle", label: "Light on / off (toggle)" },
  { id: "select", label: "Select / unselect current light (like a tap)" },
  { id: "deselect", label: "Deselect (double tap = all)" },
  { id: "all", label: "Select all" },
  { id: "invert", label: "Invert selection" },
  { id: "prev", label: "Previous light" },
  { id: "next", label: "Next light" },
  { id: "prev_add", label: "Previous light (keeps selection)" },
  { id: "next_add", label: "Next light (keeps selection)" },
  { id: "copy", label: "Copy settings" },
  { id: "paste", label: "Paste settings" },
  { id: "undo", label: "Undo" },
  { id: "redo", label: "Redo" },
  { id: "play", label: "Play cue" },
  { id: "pause", label: "Pause cue" },
  { id: "go", label: "Cue GO" },
  { id: "back", label: "Cue Back" },
  { id: "flash", label: "Flash selected (toggle)" },
  { id: "blackout", label: "Blackout" },
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

/** Stable key name including modifiers, e.g. "Ctrl+Shift+KeyA" or "F13". */
export function keyName(e: { code: string; key: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }): string | null {
  if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return null;
  const mods = [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", e.metaKey && "Meta"].filter(Boolean);
  return [...mods, e.code || e.key].join("+");
}

const KEY = "nox-macros-v1";
export const defaultMacros = (): Macro[] => [
  { id: "m1", key: null, action: "int_up", amount: 1 },
  { id: "m2", key: null, action: "int_down", amount: 1 },
  { id: "m3", key: null, action: "cct_up", amount: 100 },
  { id: "m4", key: null, action: "cct_down", amount: 100 },
  { id: "m5", key: null, action: "flash_up", amount: 0 },
  { id: "m6", key: null, action: "flash_down", amount: 0 },
  { id: "m7", key: null, action: "cct_reset", amount: 0 },
  { id: "m8", key: null, action: "select", amount: 0 },
  { id: "m9", key: null, action: "deselect", amount: 0 },
  { id: "m10", key: null, action: "prev", amount: 0 },
  { id: "m11", key: null, action: "next", amount: 0 },
  { id: "m12", key: null, action: "undo", amount: 0 },
  { id: "m13", key: null, action: "redo", amount: 0 },
  { id: "m14", key: null, action: "light_on", amount: 0 },
  { id: "m15", key: null, action: "light_off", amount: 0 },
  { id: "m16", key: null, action: "play", amount: 0 },
  { id: "m17", key: null, action: "pause", amount: 0 },
];
export function loadMacros(): Macro[] {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch { /* ignore */ }
  return defaultMacros();
}
export function saveMacros(m: Macro[]) { localStorage.setItem(KEY, JSON.stringify(m)); }
