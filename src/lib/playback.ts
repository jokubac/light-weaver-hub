// Playback bank (submasters) and cue stack helpers — pure, browser-safe.
import type { PatchedFixture } from "./dmx";
import type { BankFader, Cue, Look, LookState } from "./store";
import { blend } from "./recordings";

export const BANK_SIZE = 6;
/** fader pages: Bank 1 = faders 1–6, Bank 2 = 7–12 … */
export const BANK_PAGES = 4;

export const lookStateOf = (f: PatchedFixture): LookState => {
  const { intensity, cct, gm, hue, saturation, crossfade, cctOnly, fx, on, fxPlaying, fan, gel } = f;
  return JSON.parse(JSON.stringify({ intensity, cct, gm, hue, saturation, crossfade, cctOnly, fx, on, fxPlaying, fan, gel })) as LookState;
};

export function faderMembers(fd: BankFader, fixtures: PatchedFixture[], looks: Look[]): Set<string> {
  if (fd.kind === "group") return new Set(fixtures.filter((f) => f.group === fd.ref).map((f) => f.uid));
  if (fd.kind === "fixtures") return new Set(fd.uids ?? []);
  const l = looks.find((x) => x.id === fd.ref);
  if (!l) return new Set();
  return new Set(fixtures.filter((f) => l.states.some((s) => s.uid === f.uid || s.name === f.name)).map((f) => f.uid));
}

/**
 * Applies the bank on top of the live fixtures for output only (live state is never changed).
 * flash: fader id held at full; solo: only that fader's lights stay lit.
 */
export function applyBank(fixtures: PatchedFixture[], bank: BankFader[] | undefined, looks: Look[], flash: string | null = null, solo: string | null = null): PatchedFixture[] {
  if (!bank?.length) return fixtures;
  const members = bank.map((fd) => faderMembers(fd, fixtures, looks));
  const soloIdx = solo ? bank.findIndex((b) => b.id === solo) : -1;
  return fixtures.map((f) => {
    let out = f;
    bank.forEach((fd, i) => {
      if (!members[i]!.has(f.uid)) return;
      const level = flash === fd.id ? 1 : fd.level;
      if (fd.kind === "look") {
        if (level <= 0) return;
        const l = looks.find((x) => x.id === fd.ref);
        const st = l?.states.find((s) => s.uid === f.uid) ?? l?.states.find((s) => s.name === f.name);
        if (st) out = { ...out, ...blend(lookStateOf(out), st.state, level) };
      } else {
        out = { ...out, intensity: out.intensity * level };
      }
    });
    if (soloIdx >= 0 && !members[soloIdx]!.has(f.uid)) out = { ...out, intensity: 0 };
    return out;
  });
}

/** Number for a new cue: next whole number, or a half-way point when inserting after `after`. */
export function nextCueNumber(cues: Cue[], after?: number): number {
  const sorted = [...cues].sort((a, b) => a.number - b.number);
  if (after == null) return sorted.length ? Math.floor(sorted[sorted.length - 1]!.number) + 1 : 1;
  const nxt = sorted.find((c) => c.number > after);
  if (!nxt) return Math.floor(after) + 1;
  const mid = Math.round(((after + nxt.number) / 2) * 100) / 100;
  return mid === after || mid === nxt.number ? after + 0.01 : mid;
}

export const sortCues = (cues: Cue[]) => [...cues].sort((a, b) => a.number - b.number);

/** Fixture states while fading from `from` into the cue (k 0..1). */
export function cueBlend(cue: Cue, fixtures: PatchedFixture[], from: Map<string, LookState>, k: number): Map<string, LookState> {
  const out = new Map<string, LookState>();
  for (const f of fixtures) {
    const st = cue.states.find((s) => s.uid === f.uid) ?? cue.states.find((s) => s.name === f.name);
    if (!st) continue;
    const a = from.get(f.uid) ?? lookStateOf(f);
    out.set(f.uid, k >= 1 ? { ...st.state } : blend(a, st.state, Math.max(0, k)));
  }
  return out;
}

/** Korg nanoKONTROL2 factory CC layout (channel 1). */
export const NANOKONTROL2 = {
  faders: [0, 1, 2, 3, 4, 5], master: 7,
  go: 41, back: 43, blackout: 42,
};
