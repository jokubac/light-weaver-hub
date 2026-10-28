// Playback bank (submasters) and cue stack helpers — pure, browser-safe.
import type { PatchedFixture } from "./dmx";
import type { BankFader, Cue, Look, LookState } from "./store";
import { blend } from "./recordings";
import { membersOf } from "./fixture-groups";

export const BANK_SIZE = 6;
/** fader pages: Bank 1 = faders 1–6, Bank 2 = 7–12 … */
export const BANK_PAGES = 4;

export const lookStateOf = (f: PatchedFixture): LookState => {
  const { intensity, cct, gm, hue, saturation, crossfade, cctOnly, fx, on, fxPlaying, fan, gel } = f;
  return JSON.parse(JSON.stringify({ intensity, cct, gm, hue, saturation, crossfade, cctOnly, fx, on, fxPlaying, fan, gel })) as LookState;
};

export function faderMembers(fd: BankFader, fixtures: PatchedFixture[], looks: Look[]): Set<string> {
  if (fd.kind === "group") return new Set(membersOf(fixtures, fd.ref ?? "").map((f) => f.uid));
  if (fd.kind === "fixtures") return new Set(fd.uids ?? []);
  const l = looks.find((x) => x.id === fd.ref);
  if (!l) return new Set();
  return new Set(fixtures.filter((f) => l.states.some((s) => s.uid === f.uid || s.name === f.name)).map((f) => f.uid));
}

/** Value a fader at `level` writes for a set-type param (cct/hue/sat/fx). */
export function paramValue(param: NonNullable<BankFader["param"]>, f: PatchedFixture, level: number): Partial<PatchedFixture> {
  switch (param) {
    case "cct": return { cct: level, cctOnly: true, crossfade: 0 };
    case "hue": return { hue: level * 360, crossfade: 1, cctOnly: false, saturation: f.saturation || 1 };
    case "saturation": return { saturation: level };
    case "fxSpeed": return { fx: { ...f.fx, speed: level } };
    case "fxSize": return { fx: { ...f.fx, size: level } };
    default: return {};
  }
}

/**
 * Applies the bank on top of the live fixtures for output only (live state is never changed).
 * Faders apply oldest-moved first so the last moved fader wins (LTP).
 * Intensity faders scale; colour/effect faders set their value once they have been moved.
 * flash: fader id held at full; solo: only that fader's lights stay lit.
 */
export function applyBank(fixtures: PatchedFixture[], bank: BankFader[] | undefined, looks: Look[], flash: string | null = null, solo: string | null = null): PatchedFixture[] {
  if (!bank?.length) return fixtures;
  const order = bank.map((fd, i) => ({ fd, i, m: faderMembers(fd, fixtures, looks) }))
    .filter((x) => x.fd.kind !== "master")
    .sort((a, b) => (a.fd.touched ?? 0) - (b.fd.touched ?? 0) || a.i - b.i);
  const soloM = solo ? order.find((x) => x.fd.id === solo)?.m : undefined;
  return fixtures.map((f) => {
    let out = f;
    for (const { fd, m } of order) {
      if (!m.has(f.uid)) continue;
      const flashing = flash === fd.id;
      const level = flashing ? 1 : fd.off ? 0 : fd.level;
      const param = fd.param ?? "intensity";
      if (fd.kind === "look") {
        if (level <= 0) continue;
        const l = looks.find((x) => x.id === fd.ref);
        const st = l?.states.find((s) => s.uid === f.uid) ?? l?.states.find((s) => s.name === f.name);
        if (st) out = { ...out, ...blend(lookStateOf(out), st.state, level) };
      } else if (param === "intensity") {
        out = { ...out, intensity: out.intensity * level };
      } else if ((fd.touched || flashing) && !fd.off) {
        out = { ...out, ...paramValue(param, out, level) };
      }
    }
    if (soloM && !soloM.has(f.uid)) out = { ...out, intensity: 0 };
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
