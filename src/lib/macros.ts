// Macro pad: keyboard keys (HID macro pads) or MIDI buttons trigger user-chosen console actions.

export type MacroAction =
  | "int_up" | "int_down" | "int_set" | "cct_up" | "cct_down" | "cct_set"
  | "next" | "prev" | "flash" | "go" | "back" | "blackout" | "undo" | "redo" | "deselect" | "all";

export interface Macro { id: string; key: string | null; action: MacroAction; amount: number }

export const MACRO_ACTIONS: { id: MacroAction; label: string; unit?: "%" | "K"; def?: number }[] = [
  { id: "int_up", label: "Intensity +", unit: "%", def: 5 },
  { id: "int_down", label: "Intensity −", unit: "%", def: 5 },
  { id: "int_set", label: "Intensity set", unit: "%", def: 100 },
  { id: "cct_up", label: "CCT +", unit: "K", def: 100 },
  { id: "cct_down", label: "CCT −", unit: "K", def: 100 },
  { id: "cct_set", label: "CCT set", unit: "K", def: 5600 },
  { id: "next", label: "Next light" },
  { id: "prev", label: "Previous light" },
  { id: "all", label: "Select all" },
  { id: "deselect", label: "Deselect" },
  { id: "flash", label: "Flash selected" },
  { id: "go", label: "Cue GO" },
  { id: "back", label: "Cue Back" },
  { id: "blackout", label: "Blackout" },
  { id: "undo", label: "Undo" },
  { id: "redo", label: "Redo" },
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
    default: return null;
  }
}

/** Stable key name including modifiers, e.g. "Ctrl+Shift+KeyA" or "F13". */
export function keyName(e: { code: string; key: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }): string | null {
  if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return null;
  const mods = [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", e.metaKey && "Meta"].filter(Boolean);
  return [...mods, e.code || e.key].join("+");
}

const KEY = "nox-macros-v1";
export const defaultMacros = (): Macro[] => [
  { id: "m1", key: null, action: "int_up", amount: 5 },
  { id: "m2", key: null, action: "int_down", amount: 5 },
  { id: "m3", key: null, action: "cct_up", amount: 100 },
  { id: "m4", key: null, action: "cct_down", amount: 100 },
];
export function loadMacros(): Macro[] {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch { /* ignore */ }
  return defaultMacros();
}
export function saveMacros(m: Macro[]) { localStorage.setItem(KEY, JSON.stringify(m)); }
