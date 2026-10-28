// Playback bank (submasters) and cue stack helpers — pure, browser-safe.
import type { PatchedFixture } from "./dmx";
import type { FaderSnap, BankFader, Cue, Look, LookState } from "./store";
import { blend } from "./recordings";
import { membersOf } from "./fixture-groups";

export const BANK_SIZE = 6;
/** fader pages: Bank 1 = faders 1–6, Bank 2 = 7–12 … */
export const BANK_PAGES = 4;
/** fader slots a project can hold — divisible by every size in FADER_PAGE_SIZES */
export const BANK_TOTAL = 96;
/** how many faders one page of the full FADERS window can show */
export const FADER_PAGE_SIZES = [4, 8, 16, 24, 32];
/** a saved page size, or 8 when the stored value is missing or outdated */
export const perPageOf = (n: number) => (FADER_PAGE_SIZES.includes(n) ? n : 8);
/** bank pages available at a given faders-per-page */
export const bankPages = (perPage: number) => Math.max(1, Math.floor(BANK_TOTAL / perPage));


export const lookStateOf = (f: PatchedFixture): LookState => {
  const { intensity, cct, gm, hue, saturation, crossfade, cctOnly, fx, on, fxPlaying, fan, gel } = f;
  return JSON.parse(JSON.stringify({ intensity, cct, gm, hue, saturation, crossfade, cctOnly, fx, on, fxPlaying, fan, gel })) as LookState;
};

/** Fader travel → output through the fader's curve (S = soft ends, log = fast start, exp = fine at the bottom). */
export function faderCurve(curve: BankFader["curve"], x: number): number {
  const v = Math.min(1, Math.max(0, x));
  switch (curve) {
    case "s": return v * v * (3 - 2 * v);
    case "log": return Math.log10(1 + 9 * v);
    case "exp": return v * v;
    default: return v;
  }
}
/** Fader travel → output level: curve, then squeezed into the limiter range [min, max]. */
export function faderOutput(fd: BankFader, x: number): number {
  const lo = Math.min(1, Math.max(0, fd.min ?? 0)), hi = Math.min(1, Math.max(lo, fd.max ?? 1));
  return lo + faderCurve(fd.curve, x) * (hi - lo);
}
/** Lights driven by timeline/REC faders, keyed "timeline" and "rec:<id>". */
export type ExtraMembers = Record<string, string[]>;

export function faderMembers(fd: BankFader, fixtures: PatchedFixture[], looks: Look[], extra?: ExtraMembers): Set<string> {
  if (fd.kind === "timeline") return new Set(extra?.["timeline"] ?? []);
  if (fd.kind === "rec") return new Set(extra?.[`rec:${fd.ref}`] ?? []);
  if (fd.kind === "group") return new Set(membersOf(fixtures, fd.ref ?? "").map((f) => f.uid));
  if (fd.kind === "fixtures") return new Set(fd.uids ?? []);
  const l = looks.find((x) => x.id === fd.ref);
  if (!l) return new Set();
  return new Set(fixtures.filter((f) => l.states.some((s) => s.uid === f.uid || s.name === f.name)).map((f) => f.uid));
}

const BEAM_OF = { pan: "Pan", tilt: "Tilt", zoom: "Zoom", focus: "Focus", iris: "Iris", frost: "Frost", strobe: "Strobe" } as const;
/** Value a fader at `level` writes for a set-type param (cct/hue/sat/fx). */
export function paramValue(param: NonNullable<BankFader["param"]>, f: PatchedFixture, level: number): Partial<PatchedFixture> {
  switch (param) {
    case "cct": return { cct: level, cctOnly: true, crossfade: 0 };
    case "hue": return { hue: level * 360, crossfade: 1, cctOnly: false, saturation: f.saturation || 1 };
    case "saturation": return { saturation: level };
    case "fxSpeed": return { fx: { ...f.fx, rate: +(0.05 * Math.pow(400, level)).toFixed(3) } }; // 0.05–20 Hz, log
    case "fxSize": return { fx: { ...f.fx, max: Math.max(f.fx.min, level) } };
    case "gm": return { gm: level * 2 - 1 };
    case "pan": case "tilt": case "zoom": case "focus": case "iris": case "frost": case "strobe": {
      const a = BEAM_OF[param]; return { beam: { ...f.beam, [a]: level } };
    }
    default: return {};
  }
}

/**
 * Applies the bank on top of the live fixtures for output only (live state is never changed).
 * Faders apply oldest-moved first so the last moved fader wins (LTP).
 * Intensity faders scale; colour/effect faders set their value once they have been moved.
 * flash: fader id held at full; solo: only that fader's lights stay lit.
 */
export function applyBank(fixtures: PatchedFixture[], bank: BankFader[] | undefined, looks: Look[], flash: string | null = null, solo: string | null = null, extra?: ExtraMembers): PatchedFixture[] {
  if (!bank?.length) return fixtures;
  const order = bank.map((fd, i) => ({ fd, i, m: faderMembers(fd, fixtures, looks, extra) }))
    .filter((x) => x.fd.kind !== "master")
    .sort((a, b) => (a.fd.touched ?? 0) - (b.fd.touched ?? 0) || a.i - b.i);
  const soloM = solo ? order.find((x) => x.fd.id === solo)?.m : undefined;
  return fixtures.map((f) => {
    let out = f;
    for (const { fd, m } of order) {
      if (!m.has(f.uid)) continue;
      const flashing = flash === fd.id;
      const level = fd.off ? 0 : flashing ? faderOutput(fd, 1) : fd.level <= 0 && (fd.kind === "timeline" || fd.kind === "rec") ? 0 : faderOutput(fd, fd.level);
      const param = fd.param ?? "intensity";
      if (fd.kind === "look") {
        if (level <= 0) continue;
        const l = looks.find((x) => x.id === fd.ref);
        const st = l?.states.find((s) => s.uid === f.uid) ?? l?.states.find((s) => s.name === f.name);
        if (st) out = { ...out, ...blend(lookStateOf(out), st.state, level) };
      } else if (fd.kind === "timeline" || fd.kind === "rec") {
        if (level > 0) out = { ...out, intensity: out.intensity * level }; // at zero the playback is stopped and lights return to the console
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

/** Bank levels part-way (k 0..1) from `from` levels to a snapshot; faders missing from it stay put. */
export function snapBank(bank: BankFader[], snap: FaderSnap, from: Record<string, number>, k: number, now = Date.now()): BankFader[] {
  return bank.map((fd) => {
    const to = snap.levels[fd.id];
    if (to == null) return fd;
    const a = from[fd.id] ?? fd.level;
    return { ...fd, level: a + (to - a) * Math.min(1, Math.max(0, k)), touched: now };
  });
}

/** Releases every fader: intensity back to 100 %, colour/effect/look faders back to untouched zero. */
export const releaseBank = (bank: BankFader[]): BankFader[] =>
  bank.map(({ touched: _t, ...fd }) => ({ ...fd, level: fd.kind === "master" ? fd.level : fd.kind !== "look" && (fd.param ?? "intensity") === "intensity" ? 1 : 0, off: false }));

/** Moves linked faders by the same amount as the dragged one (clamped). */
export function moveLinked(bank: BankFader[], i: number, level: number, linked: Set<string>, now = Date.now()): BankFader[] {
  const src = bank[i]; if (!src) return bank;
  const d = level - src.level;
  return bank.map((fd, k) => k === i ? { ...fd, level, touched: now } : linked.has(src.id) && linked.has(fd.id) && fd.kind !== "master" ? { ...fd, level: Math.min(1, Math.max(0, fd.level + d)), touched: now } : fd);
}
