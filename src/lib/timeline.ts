// Editing-style timeline: free layers with clips (fixture effects, pixel effects, REC sequences, level/colour ramps).
// The top layer (index 0) wins where clips overlap, like a video editor.
import type { FxParams, PatchedFixture } from "./dmx";
import type { PixelLayer } from "./pixels";
import type { LookState, Recording } from "./store";
import { statesAt } from "./recordings";

export type ClipKind = "fx" | "pixel" | "rec" | "level" | "adjust";
/** Automation point at local clip time: intensity 0..1 (adjust: multiplier), optional cct 0..1, hue 0-360 + sat 0..1. */
export interface TimelineKey { id: string; t: number; intensity: number; cct?: number | undefined; hue?: number | undefined; sat?: number | undefined }
export interface TimelineClip {
  id: string; track: string; kind: ClipKind; name: string;
  start: number; length: number; // seconds
  fadeIn?: number; fadeOut?: number;
  uids?: string[]; // target lights (fx, level, pixel override)
  fx?: FxParams; layer?: PixelLayer; recId?: string;
  from?: { intensity: number; cct?: number | undefined }; to?: { intensity: number; cct?: number | undefined };
  keys?: TimelineKey[] | undefined;
  /** playback speed of the clip's content (REC sequences); set when a layer/clip is stretched */
  rate?: number | undefined;
  /** adjustment-layer filter settings (applied on top of keyframes) */
  adj?: AdjustFilter | undefined;
}
/** Filter an adjustment clip lays over the lights below it. */
export interface AdjustFilter {
  contrast?: number | undefined; // 1 = unchanged, 0 = all 50%, 2 = twice the difference
  cctShift?: number | undefined; // Kelvin, +warmer? no: + = cooler (higher K)
  gmShift?: number | undefined; // -1..1
  hueShift?: number | undefined; // degrees
  satMul?: number | undefined; // 1 = unchanged
  tint?: string | undefined; // hex colour
  tintAmt?: number | undefined; // 0..1
}
export type BlendMode = "replace" | "add" | "htp";
/** adjust layers hold adjustment clips that scale/recolour everything on the layers below */
export interface TimelineTrack { id: string; name: string; muted?: boolean; adjust?: boolean; solo?: boolean; locked?: boolean; opacity?: number; blend?: BlendMode; color?: string }

type Val = { intensity: number; cct?: number | undefined; hue?: number | undefined; sat?: number | undefined };
const lerpField = (keys: TimelineKey[], t: number, get: (k: TimelineKey) => number | undefined) => {
  const ks = keys.filter((k) => get(k) != null);
  if (!ks.length) return undefined;
  if (t <= ks[0]!.t) return get(ks[0]!);
  for (let i = 1; i < ks.length; i++) {
    const a = ks[i - 1]!, b = ks[i]!;
    if (t <= b.t) { const k = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1; return get(a)! + (get(b)! - get(a)!) * k; }
  }
  return get(ks[ks.length - 1]!);
};
/** Value of a level/adjust clip at local time: keyframes when present, otherwise the from→to ramp. */
export function clipValue(c: TimelineClip, local: number): Val {
  const keys = [...(c.keys ?? [])].sort((a, b) => a.t - b.t);
  if (keys.length) return { intensity: lerpField(keys, local, (k) => k.intensity)!, cct: lerpField(keys, local, (k) => k.cct), hue: lerpField(keys, local, (k) => k.hue), sat: lerpField(keys, local, (k) => k.sat) };
  const from = c.from ?? { intensity: 1 }, to = c.to ?? from, k = c.length > 0 ? local / c.length : 1;
  return { intensity: from.intensity + (to.intensity - from.intensity) * k, cct: from.cct != null && to.cct != null ? from.cct + (to.cct - from.cct) * k : undefined };
}
export interface Timeline {
  tracks: TimelineTrack[]; clips: TimelineClip[];
  audio?: { name: string; duration: number } | undefined;
  /** playback pauses at each marker until GO is pressed */
  markers?: { id: string; t: number; name: string }[] | undefined;
}

export const newId = () => Math.random().toString(36).slice(2, 10);
export const emptyTimeline = (): Timeline => ({ tracks: [1, 2, 3].map((n) => ({ id: newId(), name: `Layer ${n}` })), clips: [] });
export const timelineLength = (tl: Timeline) => Math.max(tl.audio?.duration ?? 0, ...tl.clips.map((c) => c.start + c.length), 0);

/** 0..1 envelope from a clip's fade in/out at local time. */
export function envelope(c: TimelineClip, local: number): number {
  const fi = c.fadeIn ?? 0, fo = c.fadeOut ?? 0;
  let k = 1;
  if (fi > 0 && local < fi) k = Math.min(k, local / fi);
  if (fo > 0 && local > c.length - fo) k = Math.min(k, (c.length - local) / fo);
  return Math.max(0, Math.min(1, k));
}

export type TimelinePatch = Partial<Pick<PatchedFixture, "intensity" | "cct" | "fx" | "fxPlaying" | "on">> & Partial<LookState>;

/** Output at time t: per-fixture patches plus the pixel layers that should play (null when no pixel clip is active). */
export function timelineAt(tl: Timeline, t: number, fixtures: PatchedFixture[], recordings: Recording[], origin: Map<string, LookState>) {
  const states = new Map<string, TimelinePatch>();
  const pixels: PixelLayer[] = [];
  const active: string[] = [];
  const merge = (uid: string, p: TimelinePatch) => states.set(uid, { ...states.get(uid), ...p });
  const base = (uid: string) => fixtures.find((f) => f.uid === uid);
  const anySolo = tl.tracks.some((x) => x.solo);
  // bottom layer first so upper layers override
  for (const track of [...tl.tracks].reverse()) {
    if (track.muted || (anySolo && !track.solo)) continue;
    const op = Math.max(0, Math.min(1, track.opacity ?? 1)), blend = track.blend ?? "replace";
    // collect this layer's own patches, then mix them over what's below
    const own = new Map<string, TimelinePatch>();
    const put = (uid: string, p: TimelinePatch) => own.set(uid, { ...own.get(uid), ...p });
    const below = (uid: string) => ({ ...fixtureLook(base(uid)), ...states.get(uid), ...own.get(uid) });
    for (const c of tl.clips.filter((x) => x.track === track.id && t >= x.start && t < x.start + x.length).sort((a, b) => a.start - b.start)) {
      active.push(c.id);
      const local = t - c.start, env = envelope(c, local);
      if (c.kind === "rec") {
        const rec = recordings.find((r) => r.id === c.recId);
        const res = rec ? statesAt(rec, fixtures, origin, local * (c.rate ?? 1)) : null;
        res?.states.forEach((s, uid) => { const { mix: _m, ...st } = s; put(uid, { ...st, intensity: st.intensity * env }); });
      } else if (c.kind === "fx" && c.fx) {
        for (const uid of c.uids ?? []) { const f = base(uid); put(uid, { fx: c.fx, fxPlaying: true, on: true, intensity: (states.get(uid)?.intensity ?? (f?.intensity || 1)) * env }); }
      } else if (c.kind === "level" && (c.keys?.length || (c.from && c.to))) {
        const v = clipValue(c, local);
        for (const uid of c.uids ?? []) {
          const p: TimelinePatch = { on: true, intensity: v.intensity * env };
          if (v.cct != null) { p.cct = v.cct; p.cctOnly = true; }
          if (v.hue != null) { p.hue = v.hue; p.saturation = v.sat ?? 1; p.cctOnly = false; }
          put(uid, p);
        }
      } else if (c.kind === "adjust") {
        const v = clipValue(c, local);
        for (const uid of c.uids?.length ? c.uids : fixtures.map((f) => f.uid)) {
          const cur = below(uid);
          const p: TimelinePatch = { intensity: Math.min(1, (cur.intensity ?? 0) * (1 + (v.intensity - 1) * env)) };
          if (v.cct != null) { p.cct = v.cct; p.cctOnly = true; }
          if (v.hue != null) { p.hue = v.hue; p.saturation = v.sat ?? 1; p.cctOnly = false; }
          Object.assign(p, applyFilter({ ...cur, ...p }, c.adj, env));
          put(uid, p);
        }
      } else if (c.kind === "pixel" && c.layer) {
        pixels.unshift({ ...c.layer, id: `tl-${c.id}`, playing: true, order: c.uids?.length ? c.uids : c.layer.order });
      }
    }
    for (const [uid, p] of own) {
      const prev = states.get(uid), lo = prev?.intensity ?? (prev ? 0 : base(uid)?.on === false ? 0 : 0);
      const hi = p.intensity ?? lo;
      const intensity = blend === "add" ? Math.min(1, lo + hi * op) : blend === "htp" ? Math.max(lo, hi * op) : lo + (hi - lo) * op;
      merge(uid, track.adjust || op >= 0.5 || blend !== "replace" ? { ...p, intensity } : { intensity });
    }
  }
  return { states, pixels: pixels.length ? pixels : null, active };
}

/** Stretch every clip on a layer around its first clip: factor 2 = twice as long (half speed). Points, fades and REC speed follow. */
export function stretchTrack(tl: Timeline, trackId: string, factor: number): Timeline {
  const cs = tl.clips.filter((c) => c.track === trackId);
  if (!cs.length || !(factor > 0)) return tl;
  const t0 = Math.min(...cs.map((c) => c.start));
  return { ...tl, clips: tl.clips.map((c) => c.track !== trackId ? c : {
    ...c, start: t0 + (c.start - t0) * factor, length: c.length * factor,
    ...(c.fadeIn ? { fadeIn: c.fadeIn * factor } : {}), ...(c.fadeOut ? { fadeOut: c.fadeOut * factor } : {}),
    ...(c.keys ? { keys: c.keys.map((k) => ({ ...k, t: k.t * factor })) } : {}),
    ...(c.kind === "rec" ? { rate: (c.rate ?? 1) / factor } : {}),
  }) };
}

type Look = { intensity?: number | undefined; cct?: number | undefined; hue?: number | undefined; saturation?: number | undefined; gm?: number | undefined; cctOnly?: boolean | undefined };
const fixtureLook = (f: PatchedFixture | undefined): Look => (f ? { intensity: f.intensity, cct: f.cct, hue: f.hue, saturation: f.saturation, gm: f.gm, cctOnly: f.cctOnly } : {});
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const hexHs = (hex: string): [number, number] => {
  const n = parseInt(hex.replace("#", ""), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60) + 360) % 360, mx ? d / mx : 0];
};
/** Apply an adjustment filter (scaled by env 0..1) to a light's look. */
export function applyFilter(cur: Look, a: AdjustFilter | undefined, env = 1): TimelinePatch {
  if (!a) return {};
  const p: TimelinePatch = {};
  const i0 = cur.intensity ?? 0;
  if (a.contrast != null && a.contrast !== 1) p.intensity = clamp(i0 + ((0.5 + (i0 - 0.5) * a.contrast) - i0) * env, 0, 1);
  if (a.cctShift) p.cct = clamp((cur.cct ?? 0.45) + (a.cctShift / 8000) * env, 0, 1);
  if (a.gmShift) p.gm = clamp((cur.gm ?? 0) + a.gmShift * env, -1, 1);
  let hue = cur.hue ?? 0, sat = cur.saturation ?? 0, coloured = !cur.cctOnly;
  if (a.hueShift && coloured) { hue = (((hue + a.hueShift * env) % 360) + 360) % 360; p.hue = hue; }
  if (a.satMul != null && a.satMul !== 1 && coloured) { sat = clamp(sat * (1 + (a.satMul - 1) * env), 0, 1); p.saturation = sat; }
  if (a.tint && (a.tintAmt ?? 0) > 0) {
    const [th, ts] = hexHs(a.tint), k = clamp((a.tintAmt ?? 0) * env, 0, 1);
    if (!coloured) { hue = th; sat = 0; }
    const dh = ((th - hue + 540) % 360) - 180;
    p.hue = (hue + dh * k + 360) % 360; p.saturation = clamp(sat + (ts - sat) * k, 0, 1); p.cctOnly = false;
  }
  return p;
}
