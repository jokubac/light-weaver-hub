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
}
/** adjust layers hold adjustment clips that scale/recolour everything on the layers below */
export interface TimelineTrack { id: string; name: string; muted?: boolean; adjust?: boolean }

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
  // bottom layer first so upper layers override
  for (const track of [...tl.tracks].reverse()) {
    if (track.muted) continue;
    for (const c of tl.clips.filter((x) => x.track === track.id && t >= x.start && t < x.start + x.length).sort((a, b) => a.start - b.start)) {
      active.push(c.id);
      const local = t - c.start, env = envelope(c, local);
      if (c.kind === "rec") {
        const rec = recordings.find((r) => r.id === c.recId);
        const res = rec ? statesAt(rec, fixtures, origin, local) : null;
        res?.states.forEach((s, uid) => { const { mix: _m, ...st } = s; merge(uid, { ...st, intensity: st.intensity * env }); });
      } else if (c.kind === "fx" && c.fx) {
        for (const uid of c.uids ?? []) { const f = base(uid); merge(uid, { fx: c.fx, fxPlaying: true, on: true, intensity: (states.get(uid)?.intensity ?? (f?.intensity || 1)) * env }); }
      } else if (c.kind === "level" && (c.keys?.length || (c.from && c.to))) {
        const v = clipValue(c, local);
        for (const uid of c.uids ?? []) {
          const p: TimelinePatch = { on: true, intensity: v.intensity * env };
          if (v.cct != null) { p.cct = v.cct; p.cctOnly = true; }
          if (v.hue != null) { p.hue = v.hue; p.saturation = v.sat ?? 1; p.cctOnly = false; }
          merge(uid, p);
        }
      } else if (c.kind === "adjust") {
        const v = clipValue(c, local);
        for (const uid of c.uids?.length ? c.uids : fixtures.map((f) => f.uid)) {
          const cur = states.get(uid), f = base(uid);
          const p: TimelinePatch = { intensity: (cur?.intensity ?? f?.intensity ?? 0) * (1 + (v.intensity - 1) * env) };
          if (v.cct != null) { p.cct = v.cct; p.cctOnly = true; }
          if (v.hue != null) { p.hue = v.hue; p.saturation = v.sat ?? 1; p.cctOnly = false; }
          merge(uid, p);
        }
      } else if (c.kind === "pixel" && c.layer) {
        pixels.unshift({ ...c.layer, id: `tl-${c.id}`, playing: true, order: c.uids?.length ? c.uids : c.layer.order });
      }
    }
  }
  return { states, pixels: pixels.length ? pixels : null, active };
}
