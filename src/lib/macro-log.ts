// Macro timeline: every macro run is logged with a timestamp so it can be reviewed and replayed.
import type { Macro } from "./macros";

export interface MacroLogEntry { id: string; at: number; source: string; macro: Macro }

const KEY = "nox-macro-log-v1";
export const MAX_LOG = 500;

export function appendLog(log: MacroLogEntry[], e: MacroLogEntry): MacroLogEntry[] {
  const next = [...log, e];
  return next.length > MAX_LOG ? next.slice(next.length - MAX_LOG) : next;
}

/** Delays (ms) from the first chosen entry, preserving the original spacing, scaled by speed. */
export function replaySchedule(entries: MacroLogEntry[], speed = 1): { delay: number; entry: MacroLogEntry }[] {
  const sorted = [...entries].sort((a, b) => a.at - b.at);
  const t0 = sorted[0]?.at ?? 0;
  return sorted.map((entry) => ({ delay: (entry.at - t0) / speed, entry }));
}

export function loadLog(): MacroLogEntry[] {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch { /* ignore */ }
  return [];
}
export function saveLog(l: MacroLogEntry[]) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* ignore */ } }
