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

/** Saved takes: a named copy of logged macros that can be replayed and edited later. */
export interface MacroTake { id: string; name: string; saved: number; entries: MacroLogEntry[] }
const TAKES = "nox-macro-takes-v1";
export function loadTakes(): MacroTake[] {
  try { const r = localStorage.getItem(TAKES); if (r) return JSON.parse(r); } catch { /* ignore */ }
  return [];
}
export function saveTakes(t: MacroTake[]) { try { localStorage.setItem(TAKES, JSON.stringify(t)); } catch { /* ignore */ } }
/** Moves one entry to a new offset (seconds from the first entry) and keeps the list in time order. */
export function retime(entries: MacroLogEntry[], id: string, offsetSec: number): MacroLogEntry[] {
  const t0 = Math.min(...entries.map((e) => e.at));
  return entries.map((e) => (e.id === id ? { ...e, at: t0 + Math.max(0, offsetSec) * 1000 } : e)).sort((a, b) => a.at - b.at);
}
