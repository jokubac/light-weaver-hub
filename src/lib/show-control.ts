// Programmer, Park, Tracking/Cue-only, phase loads and MIDI timecode — pure and browser-safe.
import type { PatchedFixture } from "./dmx";
import type { Cue, LookState } from "./store";
import { blend } from "./recordings";
import { lookStateOf } from "./playback";

/* ---------- Park ---------- */
/** Parked lights are held at their stored state — for output and for the live fixture state,
 *  so no cue, fader, keypad or effect edit moves them until they are unparked. */
export function applyPark(fixtures: PatchedFixture[], parked: Record<string, LookState> | undefined): PatchedFixture[] {
  if (!parked || !Object.keys(parked).length) return fixtures;
  return fixtures.map((f) => (parked[f.uid] ? { ...f, ...parked[f.uid], trigger: null } : f));
}

/* ---------- Tracking / Cue-only ---------- */
const stateIn = (c: Cue, f: PatchedFixture) => (c.states.find((s) => s.uid === f.uid) ?? c.states.find((s) => s.name === f.name))?.state;

/**
 * Full stage state for cue i. Tracking cues carry forward until changed; cue-only cues
 * apply only while they are the active cue.
 */
export function cueTarget(sorted: Cue[], i: number, fixtures: PatchedFixture[]): Map<string, LookState> {
  const out = new Map<string, LookState>();
  sorted.forEach((c, k) => {
    if (k > i || (k < i && c.mode === "cueonly")) return;
    for (const f of fixtures) { const st = stateIn(c, f); if (st) out.set(f.uid, { ...st }); }
  });
  return out;
}

export function blendTarget(target: Map<string, LookState>, from: Map<string, LookState>, fixtures: PatchedFixture[], k: number): Map<string, LookState> {
  const out = new Map<string, LookState>();
  for (const f of fixtures) {
    const st = target.get(f.uid); if (!st) continue;
    out.set(f.uid, k >= 1 ? { ...st } : blend(from.get(f.uid) ?? lookStateOf(f), st, Math.max(0, k)));
  }
  return out;
}

/* ---------- Programmer ---------- */
const close = (a: LookState, b: LookState) => {
  const n = (x: unknown) => (typeof x === "number" ? Math.round(x * 1000) : x ?? null);
  return n(a.intensity) === n(b.intensity) && n(a.cct) === n(b.cct) && n(a.hue) === n(b.hue) && n(a.saturation) === n(b.saturation)
    && n(a.crossfade) === n(b.crossfade) && (a.on !== false) === (b.on !== false) && (a.gel ?? "") === (b.gel ?? "");
};
/** Lights whose live values differ from what the active cue stores (the "programmer"). */
export function programmerDiff(fixtures: PatchedFixture[], stored: Map<string, LookState>): string[] {
  return fixtures.filter((f) => { const s = stored.get(f.uid); return !!s && !close(lookStateOf(f), s); }).map((f) => f.uid);
}


/* ---------- MIDI timecode ---------- */
const FPS = [24, 25, 29.97, 30];
/** Decodes MTC quarter-frame (0xF1) and full-frame SysEx messages into seconds. */
export class MtcDecoder {
  private q = new Array<number>(8).fill(0);
  fps = 25;
  /** Returns seconds when a full frame is assembled, else null. */
  message(d: ArrayLike<number>): number | null {
    if (d[0] === 0xf1 && d.length >= 2) {
      const piece = (d[1]! >> 4) & 7; this.q[piece] = d[1]! & 0x0f;
      if (piece !== 7) return null;
      const q = this.q;
      const fr = q[0]! | (q[1]! << 4), s = q[2]! | (q[3]! << 4), m = q[4]! | (q[5]! << 4), hb = q[6]! | (q[7]! << 4);
      this.fps = FPS[(hb >> 5) & 3]!;
      // quarter frames describe the frame when piece 0 arrived; it took 2 frames to send
      return (hb & 0x1f) * 3600 + m * 60 + s + (fr + 2) / this.fps;
    }
    if (d[0] === 0xf0 && d[1] === 0x7f && d[3] === 0x01 && d[4] === 0x01 && d.length >= 9) {
      const hb = d[5]!; this.fps = FPS[(hb >> 5) & 3]!;
      return (hb & 0x1f) * 3600 + d[6]! * 60 + d[7]! + d[8]! / this.fps;
    }
    return null;
  }
}
/** Last cue whose timecode was crossed moving from prev to now (forward play only). */
export function cueAtTimecode(sorted: Cue[], prev: number, now: number): Cue | null {
  if (now < prev || now - prev > 2) return null; // jumps/rewinds don't fire a run of cues
  let hit: Cue | null = null;
  for (const c of sorted) if (c.tc != null && c.tc > prev && c.tc <= now) hit = c;
  return hit;
}
export const fmtTc = (sec: number, fps = 25) => {
  const s = Math.max(0, sec); const f = Math.floor((s % 1) * fps);
  const p = (n: number) => String(Math.floor(n)).padStart(2, "0");
  return `${p(s / 3600)}:${p((s / 60) % 60)}:${p(s % 60)}:${p(f)}`;
};
export const parseTc = (t: string, fps = 25): number | undefined => {
  const p = t.trim().split(/[:;.]/).map(Number);
  if (!t.trim() || p.some((x) => !Number.isFinite(x))) return undefined;
  while (p.length < 4) p.unshift(0);
  const [h, m, s, f] = p as [number, number, number, number];
  return h * 3600 + m * 60 + s + f / fps;
};
