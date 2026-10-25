import { useEffect, useRef, useState, type PointerEvent as RPE, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import { Lock, Unlock, ArrowUp, ArrowDown, Copy, Flag, MousePointerSquareDashed, Repeat, SlidersHorizontal, MoveHorizontal, SkipForward, Eye, EyeOff, Music, Pause, Play, Plus, Square, Trash2, X, MonitorPlay, Magnet, ChevronDown, Undo2, Redo2, Scissors, Repeat2, ImagePlus, Contrast } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NumberField } from "@/components/console/NumberField";
import { useFxLibrary } from "@/lib/fxlib";
import { membersOf } from "@/lib/fixture-groups";
import { defaultFx, type FxParams, type PatchedFixture } from "@/lib/dmx";
import { PIXEL_LIBRARY, defaultLayer, isPixelFixture, type PixelLayer } from "@/lib/pixels";
import type { Recording } from "@/lib/store";
import { beats, splitClip, setLightKeyAt, type Ease, clipValue, newId, stretchTrack, timelineLength, type ClipKind, type Timeline, type TimelineClip, type TimelineKey, type TimelineTrack, type AdjustFilter, type BlendMode } from "@/lib/timeline";
import { editHistory } from "@/lib/edit-history";

const ROW = 52, HEAD = 150;
const KIND_STYLE: Record<ClipKind, string> = {
  fx: "bg-primary/70 border-primary", pixel: "bg-accent/80 border-accent-foreground/40", rec: "bg-success/70 border-success", level: "bg-warning/70 border-warning", adjust: "bg-muted/80 border-foreground/40",
};
const KIND_LABEL: Record<ClipKind, string> = { fx: "FX", pixel: "PIXEL", rec: "REC", level: "LEVEL", adjust: "ADJUST" };
const k2c = (k: number) => (k - 2000) / 8000, c2k = (c: number) => Math.round(2000 + c * 8000);
/** hue 0-360 / saturation 0..1 at full value ⇄ #rrggbb for the colour picker */
const hsvHex = (h: number, s: number) => { const f = (n: number) => { const k = (n + h / 60) % 6; return Math.round(255 * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)))); }; return `#${[f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, "0")).join("")}`; };
const hexHs = (hex: string): [number, number] => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const h = d === 0 ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round((h * 60 + 360) % 360), mx === 0 ? 0 : d / mx];
};
const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
const clash = (a: TimelineClip, b: TimelineClip) => a.id !== b.id && a.track === b.track && a.start < b.start + b.length - 1e-6 && b.start < a.start + a.length - 1e-6;
/** Keep clips from overlapping inside one layer: move a clashing clip to the nearest free layer, adding one if needed. */
export function placeClip(tl: Timeline, c: TimelineClip): Timeline {
  const others = tl.clips.filter((x) => x.id !== c.id);
  const from = Math.max(0, tl.tracks.findIndex((t) => t.id === c.track));
  const order = tl.tracks.map((_, i) => i).filter((i) => fits(tl.tracks[i], c)).sort((a, b) => Math.abs(a - from) - Math.abs(b - from) || b - a);
  for (const i of order) { const t = { ...c, track: tl.tracks[i]!.id }; if (!others.some((o) => clash(t, o))) return { ...tl, clips: [...others, t] }; }
  const adjust = c.kind === "adjust";
  const track = { id: newId(), name: adjust ? "Adjustment" : `Layer ${tl.tracks.length + 1}`, ...(adjust ? { adjust: true } : {}) };
  return { ...tl, tracks: adjust ? [track, ...tl.tracks] : [...tl.tracks, track], clips: [...others, { ...c, track: track.id }] };
}
/** New clips go on the highest layer that is free at their time; if every layer is busy, a new layer is added below. */
export function placeAtTop(tl: Timeline, c: TimelineClip): Timeline {
  for (const t of tl.tracks) { if (!fits(t, c)) continue; const x = { ...c, track: t.id }; if (!tl.clips.some((o) => clash(x, o))) return { ...tl, clips: [...tl.clips, x] }; }
  const track = { id: newId(), name: `Layer ${tl.tracks.length + 1}` };
  return { ...tl, tracks: [...tl.tracks, track], clips: [...tl.clips, { ...c, track: track.id }] };
}
/** Nearest target within range, otherwise t unchanged. */
export function snapTime(t: number, targets: number[], range: number): number {
  let best = t, dist = range;
  for (const x of targets) { const d = Math.abs(x - t); if (d <= dist) { dist = d; best = x; } }
  return best;
}
type MenuItem = { value: string; label: string; hint?: string };
/** Tidy add menu: a button that opens a panel of tiles grouped by section, with optional search. */
function AddMenu({ label, sections, onPick, search }: { label: string; sections: { title: string; items: MenuItem[]; empty?: string }[]; onPick: (v: string) => void; search?: boolean }) {
  const [open, setOpen] = useState(false), [q, setQ] = useState("");
  const s = q.trim().toLowerCase();
  return <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
    <PopoverTrigger asChild><Button variant="secondary" size="sm"><Plus />{label}<ChevronDown className="opacity-60" /></Button></PopoverTrigger>
    <PopoverContent align="start" className="w-80 p-0">
      {search && <div className="border-b border-border p-2"><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-full rounded-md border border-input bg-surface-elevated px-2 py-1.5 text-sm outline-none focus:border-primary" /></div>}
      <div className="max-h-96 space-y-3 overflow-auto p-2">
        {sections.map((sec) => { const items = sec.items.filter((i) => !s || i.label.toLowerCase().includes(s)); return <div key={sec.title}>
          <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{sec.title}</div>
          {items.length ? <div className="grid grid-cols-2 gap-1">{items.map((i) => <button key={i.value} onClick={() => { onPick(i.value); setOpen(false); setQ(""); }}
            className="flex min-w-0 items-center gap-1 rounded-md border border-border bg-surface-elevated px-2 py-1.5 text-left text-xs font-medium hover:border-primary hover:bg-primary/15">
            <span className="min-w-0 flex-1 truncate">{i.label}</span>{i.hint && <span className="shrink-0 text-[10px] text-muted-foreground">{i.hint}</span>}
          </button>)}</div> : <p className="px-1 text-xs text-muted-foreground">{s ? "No match" : sec.empty ?? "Nothing here"}</p>}
        </div>; })}
      </div>
    </PopoverContent>
  </Popover>;
}
/** Automation points of a clip; clips without points start from their from→to ramp. */
const keysOf = (c: TimelineClip): TimelineKey[] => c.keys?.length ? [...c.keys].sort((a, b) => a.t - b.t)
  : [{ id: newId(), t: 0, intensity: c.from?.intensity ?? 1, cct: c.from?.cct }, { id: newId(), t: c.length, intensity: c.to?.intensity ?? c.from?.intensity ?? 1, cct: c.to?.cct }];
const fits = (t: { adjust?: boolean | undefined } | undefined, c: TimelineClip) => !!t?.adjust === (c.kind === "adjust");
const hasKeys = (c: TimelineClip) => c.kind === "level" || c.kind === "adjust";
const field = "w-16 rounded border border-input bg-surface-elevated px-1 py-1 text-right font-mono text-xs";

export function TimelinePanel({ timeline, setTimeline: setTimelineRaw, time, playing, onPlay, onPause, onStop, onGo, waiting, repeat, onRepeat, groups, onSeek, fixtures, selected, recordings, layers, activeClips, audioPeaks, onAudio, onRemoveAudio, colorOf }: {
  timeline: Timeline; setTimeline: (t: Timeline) => void; time: number; playing: boolean;
  onPlay: () => void; onPause: () => void; onStop: () => void; onGo: () => void; waiting: boolean; repeat: boolean; onRepeat: () => void; groups: string[]; onSeek: (t: number) => void;
  fixtures: PatchedFixture[]; selected: string[]; recordings: Recording[]; layers: PixelLayer[]; activeClips: string[];
  audioPeaks: number[] | null; onAudio: (f: File) => void; onRemoveAudio: () => void;
  colorOf?: (f: PatchedFixture) => [number, number, number];
}) {
  const [viz, setViz] = useState(true);
  const hist = useRef(editHistory<Timeline>(80)), lastPush = useRef(0), [, bump] = useState(0);
  /** Every edit is undoable; rapid changes (a drag) collapse into one step. */
  const setTimeline = (t: Timeline) => { const now = Date.now(); if (now - lastPush.current > 400) hist.current.push(timeline); lastPush.current = now; setTimelineRaw(t); };
  const undo = () => { const v = hist.current.undo(timeline); if (v) { setTimelineRaw(v); setSel([]); bump((n) => n + 1); } };
  const redo = () => { const v = hist.current.redo(timeline); if (v) { setTimelineRaw(v); setSel([]); bump((n) => n + 1); } };
  const scroller = useRef<HTMLDivElement>(null), taps = useRef<number[]>([]);
  const split = () => {
    const targets = (sel.length ? timeline.clips.filter((c) => sel.includes(c.id)) : timeline.clips).filter((c) => time > c.start && time < c.start + c.length && !timeline.tracks.find((t) => t.id === c.track)?.locked);
    let clips = timeline.clips; const added: string[] = [];
    for (const c of targets) { const p = splitClip(c, time); if (!p) continue; clips = clips.flatMap((x) => (x.id === c.id ? p : [x])); added.push(p[1].id); }
    if (added.length) { setTimeline({ ...timeline, clips }); setSel(added); }
  };
  const setLoop = (p: Partial<NonNullable<Timeline["loop"]>>) => { const l = { a: 0, b: Math.max(4, time), on: false, ...timeline.loop, ...p }; if (l.b < l.a) [l.a, l.b] = [l.b, l.a]; setTimeline({ ...timeline, loop: l }); };
  const addMarker = () => { const m = timeline.markers ?? []; setTimeline({ ...timeline, markers: [...m, { id: newId(), t: Math.round(time * 10) / 10, name: `M${m.length + 1}` }].sort((a, b) => a.t - b.t) }); };
  const tap = () => { const now = performance.now(); taps.current = [...taps.current.filter((x) => now - x < 3000), now].slice(-8); const d = taps.current.slice(1).map((x, i) => x - taps.current[i]!); if (d.length >= 2) setTimeline({ ...timeline, bpm: Math.round(60000 / (d.reduce((a, b) => a + b, 0) / d.length)) }); };
  const lib = useFxLibrary();
  const [zoom, setZoom] = useState(40); // px per second
  const [track, setTrack] = useState(timeline.tracks[0]?.id ?? "");
  const [sel, setSel] = useState<string[]>([]);
  const [marq, setMarq] = useState<{ t0: number; t1: number; a: number; b: number } | null>(null);
  const [magnet, setMagnet] = useState(true);
  const [keySel, setKeySel] = useState<string | null>(null);
  const kdrag = useRef<{ clip: string; key: string; rect: DOMRect; moved: boolean } | null>(null);
  const drag = useRef<{ primary: string; ids: { id: string; orig: TimelineClip }[]; mode: "move" | "l" | "r"; x: number; y: number; moved: boolean } | null>(null);
  const mdrag = useRef<{ id: string; x: number; t: number; moved: boolean } | null>(null);
  const phDrag = useRef<{ x: number; t: number } | null>(null);
  /** Magnet: pull a time onto the nearest clip edge (or the playhead) within 10px. */
  const snapT = (t: number, skip: string[]) => magnet ? snapTime(t, [time, ...beats(timeline.bpm, len), ...timeline.clips.filter((c) => !skip.includes(c.id)).flatMap((c) => [c.start, c.start + c.length])], 10 / zoom) : t;
  const marqRef = useRef<{ idx: number; x: number; top: number; left: number; moved: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const len = Math.max(30, timelineLength(timeline) + 10, time + 5);
  const clip = sel.length === 1 ? timeline.clips.find((c) => c.id === sel[0]) : undefined;
  const selClips = timeline.clips.filter((c) => sel.includes(c.id));
  const set = (clips: TimelineClip[]) => setTimeline({ ...timeline, clips });
  const [layerOpen, setLayerOpen] = useState<string | null>(null);
  const setTrackP = (id: string, p: Partial<TimelineTrack>) => setTimeline({ ...timeline, tracks: timeline.tracks.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const moveTrack = (id: string, d: number) => { const ts = [...timeline.tracks]; const i = ts.findIndex((x) => x.id === id), j = i + d; if (i < 0 || j < 0 || j >= ts.length) return; [ts[i], ts[j]] = [ts[j]!, ts[i]!]; setTimeline({ ...timeline, tracks: ts }); };
  const patch = (id: string, p: Partial<TimelineClip>) => set(timeline.clips.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const targetTrack = timeline.tracks.find((t) => t.id === track)?.id ?? timeline.tracks[0]?.id;
  /** Shared value across the selection, or undefined when the clips disagree. */
  const shared = (get: (c: TimelineClip) => number | undefined) => {
    const v = selClips.length ? get(selClips[0]!) : undefined;
    return v !== undefined && selClips.every((c) => get(c) === v) ? v : undefined;
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,select,textarea")) return;
      if ((e.key === "Delete" || e.key === "Backspace") && sel.length) { set(timeline.clips.filter((c) => !sel.includes(c.id))); setSel([]); }
      if ((e.key === "a" || e.key === "A") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setSel(timeline.clips.map((c) => c.id)); }
      if (e.key === "Escape") { setSel([]); setMarq(null); }
      const k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
      if (mod && k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && k === "y") { e.preventDefault(); redo(); return; }
      if (!mod && k === "s") split();
      if (!mod && k === "i") setLoop({ a: time });
      if (!mod && k === "o") setLoop({ b: time, on: true });
      if (!mod && k === "l") setLoop({ on: !timeline.loop?.on });
      if (!mod && k === "m") addMarker();
      if (e.key === " ") { e.preventDefault(); if (playing) onPause(); else onPlay(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const addClip = (value: string) => {
    if (!targetTrack) return;
    const [kind, ref] = value.split(":") as [string, string | undefined];
    const uids = selected.length ? selected : fixtures.map((f) => f.uid);
    const base = { id: newId(), track: targetTrack, start: Math.round(time * 10) / 10, length: 8 };
    let c: TimelineClip | null = null;
    if (kind === "on" || kind === "group" || kind === "light") {
      const ids = kind === "group" ? membersOf(fixtures, ref ?? "").map((f) => f.uid) : kind === "light" ? [ref ?? ""] : uids;
      const f0 = fixtures.find((f) => ids.includes(f.uid));
      const lvl = { intensity: f0?.intensity || 1, cct: f0?.cct };
      c = { ...base, kind: "level", name: kind === "group" ? `${ref} ON` : kind === "light" ? `${f0?.name ?? "Light"} ON` : selected.length ? `${ids.length} lights ON` : "All lights ON", uids: ids, from: lvl, to: { ...lvl } };
    } else if (kind === "fxsel") { const f = fixtures.find((x) => selected.includes(x.uid) && x.fx.kind !== "none"); if (f) c = { ...base, kind: "fx", name: `${f.fx.kind} (${f.name})`, fx: structuredClone(f.fx), uids }; else alert("Select a light that has an effect set."); }
    else if (kind === "simple") { const fx = { ...defaultFx(), ...SIMPLE_FX.find((x) => x.id === ref)!.fx }; c = { ...base, kind: "fx", name: SIMPLE_FX.find((x) => x.id === ref)!.label, fx, uids }; }
    else if (kind === "spx") { const look = PIXEL_LIBRARY.find((x) => x.key === ref); if (look) { const l = { ...defaultLayer(look.label, fixtures.filter(isPixelFixture).map((f) => f.uid)), kind: look.kind, ...(look.gen ? { gen: look.gen } : {}) }; c = { ...base, kind: "pixel", name: `Pixel ${look.label}`, layer: l, uids: selected.filter((u) => fixtures.some((f) => f.uid === u && isPixelFixture(f))) }; } }
    else if (kind === "fx") { const s = lib.lib.fx.find((x) => x.id === ref); if (s) c = { ...base, kind: "fx", name: s.name, fx: structuredClone(s.fx), uids }; }
    else if (kind === "pxlayer") { const l = layers.find((x) => x.id === ref); if (l) c = { ...base, kind: "pixel", name: l.name, layer: structuredClone({ ...l, playing: false }) }; }
    else if (kind === "pixel") { const s = lib.lib.pixel.find((x) => x.id === ref); if (s) c = { ...base, kind: "pixel", name: s.name, layer: structuredClone(s.layer), uids: fixtures.filter((f) => selected.includes(f.uid)).map((f) => f.uid) }; }
    else if (kind === "rec") { const r = recordings.find((x) => x.id === ref); if (r) { const l = r.steps.reduce((a, s) => a + s.fadeIn + s.hold + s.fadeOut - (s.overlap ?? 0), 0); c = { ...base, kind: "rec", name: r.name, recId: r.id, length: Math.max(1, l) }; } }
    else if (kind === "fadein" || kind === "fadeout" || kind === "level") {
      const cur = fixtures.find((f) => uids.includes(f.uid));
      const from = kind === "fadein" ? 0 : cur?.intensity ?? 1, to = kind === "fadeout" ? 0 : kind === "fadein" ? cur?.intensity || 1 : 1;
      c = { ...base, kind: "level", length: 4, name: kind === "fadein" ? "Fade in" : kind === "fadeout" ? "Fade out" : "Level", uids, from: { intensity: from }, to: { intensity: to } };
    }
    if (c) { setTimeline(placeAtTop(timeline, c)); setSel([c.id]); }
  };

  const addAdjust = () => {
    const track = { id: newId(), name: `Adjustment ${timeline.tracks.filter((t) => t.adjust).length + 1}`, adjust: true };
    const c: TimelineClip = { id: newId(), track: track.id, kind: "adjust", name: "Adjustment", start: 0, length: Math.max(10, Math.ceil(timelineLength(timeline))), keys: [{ id: newId(), t: 0, intensity: 1 }] };
    setTimeline({ ...timeline, tracks: [track, ...timeline.tracks], clips: [...timeline.clips, c] }); setSel([c.id]); setKeySel(null); setTrack(track.id);
  };
  const setKeys = (c: TimelineClip, keys: TimelineKey[]) => patch(c.id, { keys: keys.sort((a, b) => a.t - b.t) });
  /** Double-click on a brightness/colour clip adds an automation point where you clicked. */
  const addKey = (e: ReactMouseEvent<HTMLDivElement>, c: TimelineClip) => {
    if (!hasKeys(c)) return;
    const r = e.currentTarget.getBoundingClientRect(), t = Math.max(0, Math.min(c.length, (e.clientX - r.left) / zoom));
    const v = clipValue(c, t), k: TimelineKey = { id: newId(), t: Math.round(t * 10) / 10, intensity: Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)) * (c.kind === "adjust" ? 2 : 1), cct: v.cct, hue: v.hue, sat: v.sat };
    setKeys(c, [...keysOf(c), k]); setSel([c.id]); setKeySel(k.id);
  };
  const keyMove = (e: RPE, c: TimelineClip) => {
    const d = kdrag.current; if (!d || d.clip !== c.id) return;
    d.moved = true;
    const t = Math.max(0, Math.min(c.length, Math.round(((e.clientX - d.rect.left) / zoom) * 10) / 10)), i = Math.max(0, Math.min(1, 1 - (e.clientY - d.rect.top) / d.rect.height)) * (c.kind === "adjust" ? 2 : 1);
    setKeys(c, keysOf(c).map((k) => (k.id === d.key ? { ...k, t, intensity: Math.round(i * 100) / 100 } : k)));
  };

  /** Pointer down on a clip: plain click selects only it, Shift/Ctrl/Cmd adds or removes it, and a clip already in the group keeps the group so all of them drag together. */
  const down = (e: RPE, c: TimelineClip, mode: "move" | "l" | "r") => {
    e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const add = e.shiftKey || e.metaKey || e.ctrlKey;
    const ids = add ? (sel.includes(c.id) ? sel.filter((x) => x !== c.id) : [...sel, c.id]) : sel.includes(c.id) ? sel : [c.id];
    setSel(ids);
    if (e.altKey && mode === "move") { const clones = ids.flatMap((id) => { const o = timeline.clips.find((x) => x.id === id); return o ? [{ ...structuredClone(o), id: newId() }] : []; }); setTimeline({ ...timeline, clips: [...timeline.clips, ...clones] }); }
    const group = mode === "move" ? ids : [c.id];
    drag.current = { primary: c.id, ids: group.flatMap((id) => { const o = timeline.clips.find((x) => x.id === id); return o ? [{ id, orig: { ...o } }] : []; }), mode, x: e.clientX, y: e.clientY, moved: false };
  };
  const move = (e: RPE) => {
    const d = drag.current; if (!d) return;
    let ds = Math.round(((e.clientX - d.x) / zoom) * 10) / 10;
    const dy = Math.round((e.clientY - d.y) / ROW);
    if (Math.abs(e.clientX - d.x) > 2 || Math.abs(e.clientY - d.y) > 2) d.moved = true;
    const skip = d.ids.map((x) => x.id), p = d.ids.find((x) => x.id === d.primary)?.orig ?? d.ids[0]?.orig;
    if (magnet && p) {
      if (d.mode === "move") {
        const s = p.start + (e.clientX - d.x) / zoom, a = snapT(s, skip), b = snapT(s + p.length, skip);
        if (a !== s) ds = a - p.start; else if (b !== s + p.length) ds = b - p.length - p.start;
      } else if (d.mode === "r") ds = snapT(p.start + p.length + (e.clientX - d.x) / zoom, skip) - p.start - p.length;
      else ds = snapT(p.start + (e.clientX - d.x) / zoom, skip) - p.start;
    }
    if (d.mode === "move") {
      set(timeline.clips.map((c) => {
        const o = d.ids.find((x) => x.id === c.id)?.orig; if (!o) return c;
        const ti = Math.max(0, Math.min(timeline.tracks.length - 1, timeline.tracks.findIndex((t) => t.id === o.track) + dy));
        const tr = timeline.tracks[ti]!;
        return { ...c, start: Math.max(0, o.start + ds), track: fits(tr, c) ? tr.id : o.track };
      }));
    } else if (d.ids[0]) {
      const o = d.ids[0].orig;
      if (d.mode === "r") patch(o.id, { length: Math.max(0.2, o.length + ds) });
      else { const s = Math.max(0, Math.min(o.start + o.length - 0.2, o.start + ds)); patch(o.id, { start: s, length: o.length - (s - o.start) }); }
    }
  };
  const up = () => {
    const d = drag.current; drag.current = null; if (!d) return;
    let tl = timeline;
    for (const { id } of d.ids) { const c = tl.clips.find((x) => x.id === id); if (c && tl.clips.some((o) => clash(c, o))) tl = placeClip(tl, c); }
    if (tl !== timeline) setTimeline(tl);
  };

  /** Pointer down on an empty lane: a click seeks, a drag draws a box across any number of layers that selects every clip it touches. */
  const laneDown = (e: RPE<HTMLDivElement>, t: string) => {
    const r = e.currentTarget.getBoundingClientRect(), idx = timeline.tracks.findIndex((x) => x.id === t);
    setTrack(t); marqRef.current = { idx, x: e.clientX, top: r.top - idx * ROW, left: r.left, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const marqBox = (m: NonNullable<typeof marqRef.current>, e: RPE) => {
    const i = Math.max(0, Math.min(timeline.tracks.length - 1, Math.floor((e.clientY - m.top) / ROW)));
    return { t0: Math.min(m.idx, i), t1: Math.max(m.idx, i), a: Math.max(0, (Math.min(m.x, e.clientX) - m.left) / zoom), b: Math.max(0, (Math.max(m.x, e.clientX) - m.left) / zoom) };
  };
  const laneMove = (e: RPE<HTMLDivElement>) => {
    const m = marqRef.current; if (!m) return;
    if (Math.abs(e.clientX - m.x) > 3) m.moved = true;
    if (m.moved) setMarq(marqBox(m, e));
  };
  const laneUp = (e: RPE<HTMLDivElement>) => {
    const m = marqRef.current; marqRef.current = null; if (!m) return;
    if (!m.moved) { setSel([]); setKeySel(null); onSeek(Math.max(0, (m.x - m.left) / zoom)); return; }
    const q = marqBox(m, e), ids = timeline.tracks.slice(q.t0, q.t1 + 1).map((t) => t.id);
    const hit = timeline.clips.filter((c) => ids.includes(c.track) && c.start < q.b && c.start + c.length > q.a).map((c) => c.id);
    setSel(e.shiftKey ? [...new Set([...sel, ...hit])] : hit);
    setMarq(null);
  };

  const seekAt = (e: RPE<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); onSeek(Math.max(0, (e.clientX - r.left) / zoom)); };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background" onPointerMove={move} onPointerUp={up}>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 border-b border-border bg-surface px-3 py-2 hw-bar">
        <Button size="icon" variant={playing ? "default" : "secondary"} aria-label={playing ? "Pause" : "Play"} onClick={playing ? onPause : onPlay}>{playing ? <Pause /> : <Play />}</Button>
        <Button size="icon" variant={waiting ? "default" : "secondary"} aria-label="GO — continue from marker" title="GO — continue from marker" disabled={!waiting} onClick={onGo} className={waiting ? "animate-pulse" : ""}><SkipForward /></Button>
        <Button size="icon" variant="secondary" aria-label="Stop" title="Stop — return lights to how they were" onClick={onStop}><Square /></Button>
        <Button size="icon" variant={repeat ? "default" : "secondary"} aria-label="Repeat" aria-pressed={repeat} title="Repeat" onClick={onRepeat}><Repeat /></Button>
        <span className="w-20 font-mono text-sm tabular-nums">{fmt(time)}</span>
        <span aria-hidden className="mx-1 h-6 w-px bg-border" />
        <AddMenu label="Fixture" onPick={addClip} search sections={[{ title: "Lights", items: fixtures.map((f, i) => ({ value: `light:${f.uid}`, label: f.name, hint: `${i + 1}` })), empty: "Patch lights first" }]} />
        <AddMenu label="Group" onPick={addClip} sections={[
          ...(selected.length > 1 ? [{ title: "Selection", items: [{ value: "on", label: "Selected lights", hint: `${selected.length}` }] }] : []),
          { title: "Groups", items: groups.map((g) => ({ value: `group:${g}`, label: g, hint: `${membersOf(fixtures, g).length}` })), empty: "No groups yet — make one in Groups" },
        ]} />
        <AddMenu label="Effect" onPick={addClip} sections={[
          { title: "Light", items: SIMPLE_FX.map((x) => ({ value: `simple:${x.id}`, label: x.label })) },
          { title: "Pixel", items: SIMPLE_PX.flatMap((k) => { const l = PIXEL_LIBRARY.find((x) => x.key === k); return l ? [{ value: `spx:${k}`, label: l.label }] : []; }) },
          { title: "Brightness", items: [{ value: "fadein", label: "Fade in" }, { value: "fadeout", label: "Fade out" }, { value: "level", label: "Level / CCT ramp" }] },
        ]} />
        <AddMenu label="REC" onPick={addClip} search sections={[
          { title: "REC sequences", items: recordings.map((r) => ({ value: `rec:${r.id}`, label: r.name })), empty: "Nothing recorded yet" },
          { title: "Saved light effects", items: [{ value: "fxsel", label: "From selected light" }, ...lib.lib.fx.map((x) => ({ value: `fx:${x.id}`, label: x.name }))] },
          { title: "Saved pixel effects", items: [...layers.map((l) => ({ value: `pxlayer:${l.id}`, label: l.name, hint: "PIXEL" })), ...lib.lib.pixel.map((x) => ({ value: `pixel:${x.id}`, label: x.name }))], empty: "None saved yet" },
        ]} />
        <span aria-hidden className="mx-1 h-6 w-px bg-border" />
        <Button variant={magnet ? "default" : "secondary"} size="sm" aria-pressed={magnet} title="Magnet — clips snap to the ends of other clips and the playhead" onClick={() => setMagnet((m) => !m)}><Magnet />Magnet</Button>
        <Button variant="secondary" size="sm" title="Playback stops here until GO" onClick={addMarker}><Flag />Marker</Button>
        <span aria-hidden className="mx-1 h-6 w-px bg-border" />
        <Button size="icon" variant="secondary" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!hist.current.canUndo} onClick={undo}><Undo2 /></Button>
        <Button size="icon" variant="secondary" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!hist.current.canRedo} onClick={redo}><Redo2 /></Button>
        <Button variant="secondary" size="sm" title="Split clips at the playhead (S)" onClick={split}><Scissors />Split</Button>
        <Button variant="secondary" size="sm" title="Loop start at playhead (I)" onClick={() => setLoop({ a: time })}>In</Button>
        <Button variant="secondary" size="sm" title="Loop end at playhead (O)" onClick={() => setLoop({ b: time, on: true })}>Out</Button>
        <Button variant={timeline.loop?.on ? "default" : "secondary"} size="sm" aria-pressed={!!timeline.loop?.on} title="Loop the In–Out region (L)" onClick={() => setLoop({ on: !timeline.loop?.on })}><Repeat2 />Loop</Button>
        <label className="flex items-center gap-1 text-xs">BPM<NumberField aria-label="Tempo" allowEmpty placeholder="—" min={20} max={300} value={timeline.bpm} onChange={(v) => setTimeline({ ...timeline, bpm: v })} className={field} /></label>
        <Button variant="secondary" size="sm" title="Tap 3+ times to set the tempo" onClick={tap}>Tap</Button>
        <Button variant="secondary" size="sm" onClick={() => setTimeline({ ...timeline, tracks: [{ id: newId(), name: `Layer ${timeline.tracks.length + 1}` }, ...timeline.tracks] })}><Plus />Layer</Button>
        <Button variant="secondary" size="sm" title="Adjustment layer — changes brightness and colour of every layer below it" onClick={addAdjust}><SlidersHorizontal />Adjust</Button>
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}><Music />{timeline.audio ? "Replace audio" : "Add audio"}</Button>
        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onAudio(f); e.target.value = ""; }} />
        <span aria-hidden className="mx-1 h-6 w-px bg-border" />
        <Button variant={viz ? "default" : "secondary"} size="sm" title="Show or hide the light visualiser" onClick={() => setViz((v) => !v)}><MonitorPlay />Visualiser</Button>
        <Button variant="secondary" size="sm" title="Select every clip" onClick={() => setSel(timeline.clips.map((c) => c.id))}><MousePointerSquareDashed />Select all</Button>
        <Button variant="secondary" size="sm" aria-label="Delete selected" title="Delete the selected clips" disabled={!sel.length} onClick={() => { set(timeline.clips.filter((c) => !sel.includes(c.id))); setSel([]); setKeySel(null); }}><Trash2 />Delete</Button>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">Zoom<input type="range" min={5} max={200} value={zoom} onChange={(e) => setZoom(+e.target.value)} className="w-28" /></label>
      </div>

      <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {viz && <TimelineVisualiser fixtures={fixtures} timeline={timeline} time={time} setTimeline={setTimeline} colorOf={colorOf} onClose={() => setViz(false)} onPicked={(id) => { setSel([id]); setKeySel(null); }} />}
      <Minimap timeline={timeline} len={len} time={time} zoom={zoom} scroller={scroller} />
      <div ref={scroller} className="min-h-0 flex-1 overflow-auto">
        <div className="relative" style={{ width: HEAD + len * zoom }}>
          {/* ruler */}
          <div className="sticky top-0 z-[35] flex h-7 border-b border-border bg-surface hw-ruler">
            <div className="sticky left-0 z-50 shrink-0 border-r border-border bg-surface" style={{ width: HEAD }} />
            <div className="relative flex-1 cursor-pointer touch-none" onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); seekAt(e); }} onPointerMove={(e) => { if (e.buttons) seekAt(e); }}>
              {Array.from({ length: Math.ceil(len) + 1 }, (_, s) => s).filter((s) => s % (zoom < 15 ? 10 : zoom < 40 ? 5 : 1) === 0).map((s) => (
                <span key={s} className="absolute top-0 h-full border-l border-border pl-1 text-[10px] text-muted-foreground" style={{ left: s * zoom }}>{fmt(s).replace(/\.0$/, "")}</span>
              ))}
              {zoom >= 20 && beats(timeline.bpm, len).map((b, i) => <span key={`b${i}`} className={`pointer-events-none absolute bottom-0 border-l ${i % 4 ? "h-1.5 border-muted-foreground/40" : "h-3 border-primary"}`} style={{ left: b * zoom }} />)}
              {timeline.loop && <span className={`pointer-events-none absolute inset-y-0 border-x-2 ${timeline.loop.on ? "border-primary bg-primary/25" : "border-muted-foreground/50 bg-muted/30"}`} style={{ left: timeline.loop.a * zoom, width: Math.max(2, (timeline.loop.b - timeline.loop.a) * zoom) }} />}
            </div>
          </div>
          {timeline.tracks.map((t, i) => (
            <div key={t.id} className={`flex border-b border-border ${t.muted ? "opacity-40" : ""}`} style={{ height: ROW }}>
              <div className="sticky left-0 z-40 flex shrink-0 items-center gap-1 border-r border-border bg-surface px-2" style={{ width: HEAD, backgroundImage: track === t.id ? "linear-gradient(color-mix(in oklab, var(--primary) 15%, transparent), color-mix(in oklab, var(--primary) 15%, transparent))" : undefined }} onClick={() => setTrack(t.id)}>
                <input aria-label="Layer name" value={t.name} onChange={(e) => setTimeline({ ...timeline, tracks: timeline.tracks.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)) })} className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-foreground outline-none" />
                {t.color && <span aria-hidden="true" className="h-3 w-1.5 shrink-0 rounded-sm" style={{ background: t.color }} />}
                <button aria-label="Solo layer" title="Solo — play only this layer" onClick={(e) => { e.stopPropagation(); setTrackP(t.id, { solo: !t.solo }); }} className={`text-[10px] font-bold ${t.solo ? "text-warning" : "text-muted-foreground"}`}>S</button>
                <button aria-label={t.locked ? "Unlock layer" : "Lock layer"} title={t.locked ? "Unlock layer" : "Lock layer — no accidental edits"} onClick={(e) => { e.stopPropagation(); setTrackP(t.id, { locked: !t.locked }); }} className={t.locked ? "text-primary" : "text-muted-foreground"}>{t.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}</button>
                <button aria-label="Layer settings" title="Layer settings and every step" onClick={(e) => { e.stopPropagation(); setLayerOpen(layerOpen === t.id ? null : t.id); }} className={layerOpen === t.id ? "text-primary" : "text-muted-foreground hover:text-foreground"}><SlidersHorizontal className="h-3.5 w-3.5" /></button>
                <button aria-label="Stretch layer" title="Stretch layer — change the speed of everything on it" onClick={() => { const v = prompt(`Speed of ${t.name} in % (50 = twice as slow, 200 = twice as fast)`, "100"); const pct = Number(v); if (v && pct > 0) setTimeline(stretchTrack(timeline, t.id, 100 / pct)); }} className="text-muted-foreground hover:text-foreground"><MoveHorizontal className="h-3.5 w-3.5" /></button>
                <button aria-label={t.muted ? "Show layer" : "Hide layer"} title={t.muted ? "Turn layer on" : "Turn layer off"} onClick={() => setTimeline({ ...timeline, tracks: timeline.tracks.map((x) => (x.id === t.id ? { ...x, muted: !x.muted } : x)) })} className="text-muted-foreground">{t.muted ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                {timeline.tracks.length > 1 && <button aria-label="Delete layer" onClick={() => { if (!timeline.clips.some((c) => c.track === t.id) || confirm(`Delete ${t.name} and its clips?`)) { setTimeline({ ...timeline, tracks: timeline.tracks.filter((x) => x.id !== t.id), clips: timeline.clips.filter((c) => c.track !== t.id) }); setSel([]); } }} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>}
              </div>
              <div data-track={t.id} className={`relative flex-1 ${i % 2 ? "bg-muted/15" : ""} ${t.locked ? "[&>div]:cursor-not-allowed" : ""}`} style={t.opacity != null && t.opacity < 1 ? { opacity: 0.4 + 0.6 * t.opacity } : undefined} onPointerDown={(e) => laneDown(e, t.id)} onPointerMove={laneMove} onPointerUp={laneUp}>
                {timeline.clips.filter((c) => c.track === t.id).map((c) => (
                  <div key={c.id} onPointerDown={(e) => { if (t.locked) { e.stopPropagation(); setSel([c.id]); return; } down(e, c, "move"); }} onDoubleClick={(e) => { if (!t.locked) addKey(e, c); }}
                    className={`absolute top-1 bottom-1 cursor-grab touch-none select-none overflow-hidden rounded-md border px-2 text-xs text-foreground ${KIND_STYLE[c.kind]} ${sel.includes(c.id) ? "ring-2 ring-foreground" : ""} ${activeClips.includes(c.id) ? "brightness-125" : ""}`}
                    style={{ left: c.start * zoom, width: Math.max(8, c.length * zoom), ...(c.color ? { borderLeft: `4px solid ${c.color}`, boxShadow: `inset 0 -3px 0 ${c.color}` } : {}) }}>
                    {(c.fadeIn ?? 0) > 0 && <div className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-background/70 to-transparent" style={{ width: (c.fadeIn ?? 0) * zoom }} />}
                    {(c.fadeOut ?? 0) > 0 && <div className="pointer-events-none absolute inset-y-0 right-0 bg-gradient-to-l from-background/70 to-transparent" style={{ width: (c.fadeOut ?? 0) * zoom }} />}
                    {hasKeys(c) && (() => { const ks = keysOf(c), h = ROW - 8, sc = c.kind === "adjust" ? 2 : 1; return <>
                      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
                        <polyline fill="none" stroke="currentColor" strokeWidth={1.5} points={[{ t: 0, intensity: ks[0]!.intensity }, ...ks, { t: c.length, intensity: ks[ks.length - 1]!.intensity }].map((k) => `${k.t * zoom},${(1 - k.intensity / sc) * h}`).join(" ")} />
                      </svg>
                      {c.keys?.length ? ks.map((k) => <div key={k.id} title={`${Math.round(k.intensity * 100)}%${k.cct != null ? ` · ${c2k(k.cct)}K` : ""}${k.hue != null ? ` · hue ${Math.round(k.hue)}°` : ""} — drag to move, double-click to delete`}
                        className={`absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border-2 border-foreground ${keySel === k.id ? "bg-primary" : "bg-background"}`}
                        style={{ left: k.t * zoom, top: (1 - k.intensity / sc) * h, ...(k.hue != null ? { backgroundColor: `hsl(${k.hue} ${Math.round((k.sat ?? 1) * 100)}% 50%)` } : {}) }}
                        onPointerDown={(e) => { e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId); setSel([c.id]); setKeySel(k.id); kdrag.current = { clip: c.id, key: k.id, rect: (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect(), moved: false }; }}
                        onPointerMove={(e) => keyMove(e, c)} onPointerUp={() => { kdrag.current = null; }}
                        onDoubleClick={(e) => { e.stopPropagation(); setKeys(c, ks.filter((x) => x.id !== k.id)); setKeySel(null); }} />) : null}
                    </>; })()}
                    <div className="relative truncate pt-1 text-[9px] font-bold opacity-80">{KIND_LABEL[c.kind]}</div>
                    <div className="relative truncate font-semibold">{c.name}</div>
                    <div onPointerDown={(e) => down(e, c, "l")} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize" />
                    <div onPointerDown={(e) => down(e, c, "r")} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize" />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {timeline.audio && (
            <div className="flex border-b border-border" style={{ height: ROW }}>
              <div className="sticky left-0 z-40 flex shrink-0 items-center gap-1 border-r border-border bg-surface px-2" style={{ width: HEAD }}>
                <Music className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate text-xs" title={timeline.audio.name}>{timeline.audio.name}</span>
                <button aria-label="Remove audio" onClick={() => { if (confirm("Remove the audio track?")) onRemoveAudio(); }} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
              </div>
              <div className="relative flex-1 cursor-pointer" onPointerDown={seekAt}>
                <svg className="absolute inset-y-0 left-0 h-full text-primary" width={timeline.audio.duration * zoom} preserveAspectRatio="none" viewBox={`0 0 ${audioPeaks?.length ?? 1} 2`}>
                  {audioPeaks?.map((p, i) => <rect key={i} x={i} y={1 - p} width={1} height={Math.max(0.02, p * 2)} fill="currentColor" />)}
                </svg>
              </div>
            </div>
          )}
          {(timeline.markers ?? []).map((m) => <div key={m.id} className="absolute top-0 bottom-0 z-[36]" style={{ left: HEAD + m.t * zoom }}>
            <div className="pointer-events-none absolute inset-y-0 w-px bg-warning/70" />
            <div title={`${m.name} — playback waits here for GO. Drag to move.`}
              className="absolute top-0 flex h-7 cursor-grab touch-none select-none items-center gap-0.5 rounded-r bg-warning px-1 text-[10px] font-bold text-primary-foreground"
              onPointerDown={(e) => { e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId); mdrag.current = { id: m.id, x: e.clientX, t: m.t, moved: false }; }}
              onPointerMove={(e) => { const d = mdrag.current; if (d?.id !== m.id) return; const dx = e.clientX - d.x; if (Math.abs(dx) > 3) d.moved = true; if (!d.moved) return; setTimeline({ ...timeline, markers: (timeline.markers ?? []).map((x) => (x.id === m.id ? { ...x, t: Math.max(0, Math.round((d.t + dx / zoom) * 10) / 10) } : x)) }); }}
              onPointerUp={(e) => { const d = mdrag.current; mdrag.current = null; (e.target as HTMLElement).releasePointerCapture(e.pointerId); if (!d) return; if (!d.moved) onSeek(m.t); else setTimeline({ ...timeline, markers: [...(timeline.markers ?? [])].sort((a, b) => a.t - b.t) }); }}>
              <Flag className="h-3 w-3" />{m.name}
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setTimeline({ ...timeline, markers: (timeline.markers ?? []).map((x) => (x.id === m.id ? { ...x, action: x.action === "pass" ? "pause" : "pass" } : x)) })} title={m.action === "pass" ? "Label only — playback keeps going. Click to make it wait for GO" : "Waits for GO. Click to make it a label only"} className="ml-0.5 rounded bg-primary-foreground/20 px-0.5">{m.action === "pass" ? "▶" : "⏸"}</button>
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setTimeline({ ...timeline, markers: (timeline.markers ?? []).filter((x) => x.id !== m.id) })} aria-label={`Delete marker ${m.name}`} title="Delete marker" className="ml-0.5 text-primary-foreground/70 hover:text-primary-foreground"><X className="h-3 w-3" /></button>
            </div>
          </div>)}
          {marq && <div className="pointer-events-none absolute z-30 border border-primary bg-primary/20" style={{ left: HEAD + marq.a * zoom, width: Math.max(2, (marq.b - marq.a) * zoom), top: 28 + marq.t0 * ROW, height: (marq.t1 - marq.t0 + 1) * ROW }} />}
          <div className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-destructive" style={{ left: HEAD + time * zoom }} />
          <div aria-label="Playhead — drag along the time bar" title="Drag to move the playhead"
            className="absolute z-[37] h-0 w-0 -translate-x-1/2 cursor-ew-resize touch-none border-x-[8px] border-t-[12px] border-x-transparent border-t-destructive drop-shadow-[0_0_4px_var(--destructive)]"
            style={{ left: HEAD + time * zoom, top: 16 }}
            onPointerDown={(e) => { e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId); phDrag.current = { x: e.clientX, t: time }; }}
            onPointerMove={(e) => { const d = phDrag.current; if (!d) return; onSeek(snapT(Math.max(0, d.t + (e.clientX - d.x) / zoom), [])); }}
            onPointerUp={() => { phDrag.current = null; }} />
        </div>
        {timeline.clips.length === 0 && <p className="sticky left-0 mx-auto max-w-2xl p-6 text-center text-sm text-muted-foreground">Select lights, move the red playhead and add effects, pixel effects, REC sequences or fades. Drag clips to move them, drag their edges to trim. The top layer wins where clips overlap.</p>}
        {timeline.clips.length > 0 && <p className="sticky left-0 mx-auto max-w-3xl px-6 py-2 text-center text-xs text-muted-foreground">Click a clip to pick it. Shift-click adds clips to the selection, drag a box across empty space (over several layers) to select several; double-click a brightness clip to add a point, then drag any one of them to move the whole group. Ctrl/Cmd+A picks everything, Esc clears.</p>}
      </div>
      </div>

      {(sel.length > 0 || layerOpen) && <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l border-border bg-surface p-3 text-xs [&>div]:flex-col [&>div]:items-stretch [&>div]:border-0 [&>div]:p-0" aria-label="Clip settings">
        {layerOpen && <LayerSettings key={layerOpen} timeline={timeline} trackId={layerOpen} onTrack={(p) => setTrackP(layerOpen, p)} onMove={(d) => moveTrack(layerOpen, d)} onClip={patch} onClose={() => setLayerOpen(null)} />}
      {sel.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-surface px-4 py-2 text-xs hw-bar" >
          <span className="font-semibold">{sel.length} clips selected</span>
          <label className="flex items-center gap-1">Fade in<NumberField aria-label="Fade in all" min={0} step={0.1} allowEmpty placeholder="—" value={shared((c) => c.fadeIn ?? 0)} onChange={(v) => set(timeline.clips.map((c) => (sel.includes(c.id) ? { ...c, fadeIn: Math.max(0, v ?? 0) } : c)))} className={field} />s</label>
          <label className="flex items-center gap-1">Fade out<NumberField aria-label="Fade out all" min={0} step={0.1} allowEmpty placeholder="—" value={shared((c) => c.fadeOut ?? 0)} onChange={(v) => set(timeline.clips.map((c) => (sel.includes(c.id) ? { ...c, fadeOut: Math.max(0, v ?? 0) } : c)))} className={field} />s</label>
          {selClips.length > 0 && selClips.every((c) => c.kind === "level") && <>
            <label className="flex items-center gap-1">From<NumberField aria-label="From intensity all" min={0} max={100} value={Math.round((selClips[0]!.from?.intensity ?? 0) * 100)} onChange={(v) => v !== undefined && set(timeline.clips.map((c) => (sel.includes(c.id) ? { ...c, from: { ...c.from!, intensity: v / 100 } } : c)))} className={field} />%</label>
            <label className="flex items-center gap-1">To<NumberField aria-label="To intensity all" min={0} max={100} value={Math.round((selClips[0]!.to?.intensity ?? 0) * 100)} onChange={(v) => v !== undefined && set(timeline.clips.map((c) => (sel.includes(c.id) ? { ...c, to: { ...c.to!, intensity: v / 100 } } : c)))} className={field} />%</label>
          </>}
          {selected.length > 0 && <Button size="sm" variant="secondary" onClick={() => set(timeline.clips.map((c) => (sel.includes(c.id) && c.kind !== "rec" ? { ...c, uids: [...selected] } : c)))}>Use selected lights</Button>}
          <Button size="sm" variant="secondary" onClick={() => { const dups = timeline.clips.filter((c) => sel.includes(c.id)).map((c) => ({ ...structuredClone(c), id: newId(), start: c.start + c.length })); let tl = timeline; for (const c of dups) tl = placeClip(tl, c); setTimeline(tl); setSel(dups.map((c) => c.id)); }}><Copy />Duplicate</Button>
          <Button size="sm" variant="ghost" onClick={() => setSel([])}>Clear</Button>
          <div className="ml-auto"><Button size="icon" variant="ghost" aria-label="Delete selected clips" title="Delete selected clips" onClick={() => { set(timeline.clips.filter((c) => !sel.includes(c.id))); setSel([]); }}><Trash2 /></Button></div>
        </div>
      )}

      {clip && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-surface px-4 py-2 text-xs hw-bar">
          <span className={`rounded px-1.5 py-0.5 font-bold ${KIND_STYLE[clip.kind]}`}>{KIND_LABEL[clip.kind]}</span>
          <input aria-label="Clip name" value={clip.name} onChange={(e) => patch(clip.id, { name: e.target.value })} className="w-40 rounded border border-input bg-surface-elevated px-2 py-1 text-xs" />
          <label className="flex items-center gap-1">Start<NumberField aria-label="Start" min={0} step={0.1} value={+clip.start.toFixed(2)} onChange={(v) => v !== undefined && patch(clip.id, { start: Math.max(0, v) })} className={field} />s</label>
          <label className="flex items-center gap-1">Length<NumberField aria-label="Length" min={0.2} step={0.1} value={+clip.length.toFixed(2)} onChange={(v) => v !== undefined && patch(clip.id, { length: Math.max(0.2, v) })} className={field} />s</label>
          <label className="flex items-center gap-1">Fade in<NumberField aria-label="Fade in" min={0} step={0.1} value={clip.fadeIn ?? 0} onChange={(v) => patch(clip.id, { fadeIn: Math.max(0, v ?? 0) })} className={field} />s</label>
          <label className="flex items-center gap-1">Fade out<NumberField aria-label="Fade out" min={0} step={0.1} value={clip.fadeOut ?? 0} onChange={(v) => patch(clip.id, { fadeOut: Math.max(0, v ?? 0) })} className={field} />s</label>
          {clip.kind === "level" && clip.from && clip.to && <>
            <label className="flex items-center gap-1">From<NumberField aria-label="From intensity" min={0} max={100} value={Math.round(clip.from.intensity * 100)} onChange={(v) => v !== undefined && patch(clip.id, { from: { ...clip.from!, intensity: v / 100 } })} className={field} />%</label>
            <label className="flex items-center gap-1">To<NumberField aria-label="To intensity" min={0} max={100} value={Math.round(clip.to.intensity * 100)} onChange={(v) => v !== undefined && patch(clip.id, { to: { ...clip.to!, intensity: v / 100 } })} className={field} />%</label>
            <label className="flex items-center gap-1">CCT<NumberField aria-label="From CCT" allowEmpty placeholder="—" min={2000} max={10000} value={clip.from.cct != null ? c2k(clip.from.cct) : undefined} onChange={(v) => patch(clip.id, { from: { ...clip.from!, cct: v == null ? undefined : k2c(v) }, to: { ...clip.to!, cct: v == null ? undefined : clip.to!.cct ?? k2c(v) } })} className={field} />→
              <NumberField aria-label="To CCT" allowEmpty placeholder="—" min={2000} max={10000} value={clip.to.cct != null ? c2k(clip.to.cct) : undefined} onChange={(v) => patch(clip.id, { to: { ...clip.to!, cct: v == null ? undefined : k2c(v) }, from: { ...clip.from!, cct: v == null ? undefined : clip.from!.cct ?? k2c(v) } })} className={field} />K</label>
          </>}
          {clip.kind === "fx" && clip.fx && <>
            <label className="flex items-center gap-1">Effect<select aria-label="Change effect" value={SIMPLE_FX.find((x) => x.fx.kind === clip.fx!.kind && x.fx.rate === clip.fx!.rate)?.id ?? ""} onChange={(e) => { const s = SIMPLE_FX.find((x) => x.id === e.target.value); if (s) patch(clip.id, { fx: { ...defaultFx(), ...s.fx }, name: s.label }); }} className="rounded border border-input bg-surface-elevated px-2 py-1 text-xs">
              <option value="" disabled>{clip.fx.kind}</option>{SIMPLE_FX.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
            <label className="flex items-center gap-1">Speed<NumberField aria-label="Effect speed" min={0.05} max={30} step={0.05} value={+clip.fx.rate.toFixed(2)} onChange={(v) => v !== undefined && patch(clip.id, { fx: { ...clip.fx!, rate: Math.max(0.05, v) } })} className={field} />Hz</label>
          </>}
          {clip.kind === "pixel" && clip.layer && <>
            <label className="flex items-center gap-1">Effect<select aria-label="Change pixel effect" value={PIXEL_LIBRARY.find((x) => x.kind === clip.layer!.kind && (x.gen ?? undefined) === (clip.layer!.gen ?? undefined))?.key ?? ""} onChange={(e) => { const look = PIXEL_LIBRARY.find((x) => x.key === e.target.value); if (look) { const { gen: _g, ...rest } = clip.layer!; patch(clip.id, { layer: { ...rest, kind: look.kind, ...(look.gen ? { gen: look.gen } : {}) } as PixelLayer, name: `Pixel ${look.label}` }); } }} className="max-w-44 rounded border border-input bg-surface-elevated px-2 py-1 text-xs">
              <option value="" disabled>{clip.layer.kind}</option>{PIXEL_LIBRARY.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></label>
            <label className="flex items-center gap-1">Speed<NumberField aria-label="Pixel speed" min={0.01} max={100} step={0.1} value={+clip.layer.speed.toFixed(2)} onChange={(v) => v !== undefined && patch(clip.id, { layer: { ...clip.layer!, speed: Math.max(0.01, v) } })} className={field} />×</label>
            {clip.layer.colors[0] && <label className="flex items-center gap-1">Colour<input type="color" aria-label="Pixel colour" value={clip.layer.colors[0]} onChange={(e) => patch(clip.id, { layer: { ...clip.layer!, colors: [e.target.value, ...clip.layer!.colors.slice(1)] } })} className="h-6 w-8 cursor-pointer rounded border border-input bg-transparent" /></label>}
          </>}
          <label className="flex items-center gap-1">Colour<input type="color" aria-label="Clip colour" value={clip.color ?? "#888888"} onChange={(e) => patch(clip.id, { color: e.target.value })} className="h-6 w-8 cursor-pointer rounded border border-input bg-transparent" />{clip.color && <button className="text-muted-foreground" onClick={() => patch(clip.id, { color: undefined })}>×</button>}</label>
          {(clip.kind === "fx" || clip.kind === "level") && (clip.uids?.length ?? 0) > 1 && <label className="flex items-center gap-1" title="Delay between each light starting — makes a wave across them">Stagger<NumberField aria-label="Stagger" min={0} max={10} step={0.05} value={clip.stagger ?? 0} onChange={(v) => patch(clip.id, { stagger: Math.max(0, v ?? 0) })} className={field} />s</label>}
          {clip.kind === "adjust" && <AdjustControls value={clip.adj ?? {}} onChange={(adj) => patch(clip.id, { adj })} />}
          {hasKeys(clip) && <StepList clip={clip} onKeys={(keys) => patch(clip.id, { keys })} />}
          {hasKeys(clip) && (() => {
            const ks = keysOf(clip), k = clip.keys?.find((x) => x.id === keySel);
            const upd = (p: Partial<TimelineKey>) => k && setKeys(clip, ks.map((x) => (x.id === k.id ? { ...x, ...p } : x)));
            if (!k) return <span className="text-muted-foreground">Double-click the clip to add a point · {clip.keys?.length ?? 0} points</span>;
            return <span className="flex flex-wrap items-center gap-2 rounded border border-primary/50 px-2 py-1">
              <b>Point</b>
              <label className="flex items-center gap-1">At<NumberField aria-label="Point time" min={0} max={clip.length} step={0.1} value={+k.t.toFixed(2)} onChange={(v) => v !== undefined && upd({ t: Math.max(0, Math.min(clip.length, v)) })} className={field} />s</label>
              <label className="flex items-center gap-1">{clip.kind === "adjust" ? "Level" : "Intensity"}<NumberField aria-label="Point intensity" min={0} max={clip.kind === "adjust" ? 200 : 100} value={Math.round(k.intensity * 100)} onChange={(v) => v !== undefined && upd({ intensity: v / 100 })} className={field} />%</label>
              <label className="flex items-center gap-1">Curve<select aria-label="Point curve" value={k.ease ?? "linear"} onChange={(e) => upd({ ease: e.target.value as Ease })} className="rounded border border-input bg-surface-elevated px-1 py-0.5 text-xs"><option value="linear">Linear</option><option value="smooth">Smooth</option><option value="step">Step</option></select></label>
              <label className="flex items-center gap-1">CCT<NumberField aria-label="Point CCT" allowEmpty placeholder="—" min={2000} max={10000} step={100} value={k.cct != null ? c2k(k.cct) : undefined} onChange={(v) => upd({ cct: v == null ? undefined : k2c(v), ...(v != null ? { hue: undefined, sat: undefined } : {}) })} className={field} />K</label>
              <label className="flex items-center gap-1">Colour<input type="color" aria-label="Point colour" value={k.hue != null ? hsvHex(k.hue, k.sat ?? 1) : "#ffffff"} onChange={(e) => { const [h, sa] = hexHs(e.target.value); upd({ hue: h, sat: sa, cct: undefined }); }} className="h-6 w-8 cursor-pointer rounded border border-input bg-transparent" /></label>
              {(k.hue != null || k.cct != null) && <Button size="sm" variant="ghost" onClick={() => upd({ hue: undefined, sat: undefined, cct: undefined })}>No colour</Button>}
              <Button size="sm" variant="ghost" onClick={() => { setKeys(clip, ks.filter((x) => x.id !== k.id)); setKeySel(null); }}><Trash2 />Point</Button>
            </span>;
          })()}
          {clip.kind !== "rec" && clip.kind !== "adjust" && <span className="text-muted-foreground">{clip.uids?.length ? `${clip.uids.length} lights` : clip.kind === "pixel" ? "layer's own lights" : "no lights"}</span>}
          {clip.kind === "adjust" && <span className="text-muted-foreground">{clip.uids?.length ? `${clip.uids.length} lights` : "all lights below"}</span>}
          {clip.kind !== "rec" && <Button size="sm" variant="secondary" disabled={!selected.length} onClick={() => patch(clip.id, { uids: [...selected] })}>Use selected lights</Button>}
          <div className="ml-auto flex gap-1">
            <Button size="icon" variant="ghost" aria-label="Duplicate clip" title="Duplicate after this clip" onClick={() => { const c = { ...structuredClone(clip), id: newId(), start: clip.start + clip.length }; setTimeline(placeClip(timeline, c)); setSel([c.id]); }}><Copy /></Button>
            <Button size="icon" variant="ghost" aria-label="Delete clip" onClick={() => { set(timeline.clips.filter((c) => c.id !== clip.id)); setSel([]); }}><Trash2 /></Button>
          </div>
        </div>
      )}
      </aside>}
      </div>
    </div>
  );
}

const SIMPLE_FX: { id: string; label: string; fx: Partial<FxParams> }[] = [
  { id: "strobe", label: "Strobe", fx: { kind: "strobe", rate: 8, duty: 0.3 } },
  { id: "strobe-slow", label: "Slow strobe", fx: { kind: "strobe", rate: 2, duty: 0.3 } },
  { id: "pulse", label: "Pulse", fx: { kind: "pulse", rate: 1 } },
  { id: "breathe", label: "Breathe (slow pulse)", fx: { kind: "pulse", rate: 0.25, min: 0.2 } },
  { id: "flicker", label: "Flicker / fire", fx: { kind: "fire", rate: 1 } },
  { id: "candle", label: "Candle", fx: { kind: "candle", rate: 1 } },
  { id: "tv", label: "TV", fx: { kind: "tv", rate: 1 } },
  { id: "lightning", label: "Lightning", fx: { kind: "lightning", rate: 1 } },
];
const SIMPLE_PX = ["solid", "rainbow", "chase", "runner", "wave", "sparkle", "strobe", "police"];

/** Docked stage above the overview: place lights over a photo, watch them play, tap a light to set its value at the playhead. */
function TimelineVisualiser({ fixtures, timeline, time, setTimeline, colorOf, onClose, onPicked }: { fixtures: PatchedFixture[]; timeline: Timeline; time: number; setTimeline: (t: Timeline) => void; colorOf?: ((f: PatchedFixture) => [number, number, number]) | undefined; onClose: () => void; onPicked: (clipId: string) => void }) {
  const viz = timeline.viz ?? {};
  const [h, setH] = useState(viz.h ?? 220);
  const [edit, setEdit] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null), photo = useRef<HTMLInputElement>(null);
  const drag = useRef<{ uid: string; moved: boolean; pos: [number, number] } | null>(null);
  const [dragPos, setDragPos] = useState<{ uid: string; p: [number, number] } | null>(null);
  const used = new Set(timeline.clips.flatMap((c) => c.uids?.length ? c.uids : c.layer?.order ?? []));
  const list = used.size ? fixtures.filter((f) => used.has(f.uid)) : fixtures;
  const posOf = (f: PatchedFixture, i: number): [number, number] => dragPos?.uid === f.uid ? dragPos.p : viz.pos?.[f.uid] ?? [((i % 10) + 0.5) / 10, (Math.floor(i / 10) + 0.5) / Math.max(1, Math.ceil(list.length / 10)) * 0.8 + 0.1];
  const setViz = (p: Partial<NonNullable<Timeline["viz"]>>) => setTimeline({ ...timeline, viz: { ...viz, ...p } });
  const toStage = (e: { clientX: number; clientY: number }): [number, number] => { const r = stage.current!.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
  const loadPhoto = (file: File) => { const img = new Image(); img.onload = () => { const s = Math.min(1, 1280 / img.width); const c = document.createElement("canvas"); c.width = img.width * s; c.height = img.height * s; c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height); setViz({ image: c.toDataURL("image/jpeg", 0.75) }); URL.revokeObjectURL(img.src); }; img.src = URL.createObjectURL(file); };
  const resize = (e: RPE) => { e.preventDefault(); const y0 = e.clientY, h0 = h; let last = h0;
    const mv = (ev: PointerEvent) => { last = Math.max(120, Math.min(700, h0 + ev.clientY - y0)); setH(last); };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); setViz({ h: last }); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); };
  const ef = fixtures.find((f) => f.uid === edit);
  const cur = (() => { if (!ef) return null; const c = timeline.clips.find((x) => x.kind === "level" && x.uids?.length === 1 && x.uids[0] === ef.uid && time >= x.start && time <= x.start + x.length);
    return c ? clipValue(c, time - c.start) : { intensity: ef.intensity, cct: ef.cctOnly === false ? undefined : ef.cct, hue: ef.cctOnly === false ? ef.hue : undefined, sat: ef.saturation }; })();
  const setVal = (p: Partial<TimelineKey>) => { if (!ef || !cur) return; const r = setLightKeyAt(timeline, ef.uid, ef.name, time, { ...cur, ...p }); setTimeline(r.timeline); if (r.clipId) onPicked(r.clipId); };
  return (
    <div className="relative shrink-0 border-b border-border bg-background" style={{ height: h }} aria-label="Visualiser">
      <div className="absolute left-2 top-1 z-10 flex items-center gap-1 text-xs">
        <span className="rounded bg-surface/80 px-1.5 py-0.5 font-semibold"><MonitorPlay className="mr-1 inline h-3.5 w-3.5" />Visualiser · {time.toFixed(1)}s</span>
        <Button size="sm" variant="secondary" className="h-6" onClick={() => photo.current?.click()}><ImagePlus />{viz.image ? "Photo" : "Add photo"}</Button>
        {viz.image && <Button size="sm" variant="ghost" className="h-6" aria-label="Remove photo" onClick={() => setViz({ image: undefined })}><X /></Button>}
        <input ref={photo} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadPhoto(f); e.target.value = ""; }} />
        <span className="text-muted-foreground">drag lights to place · tap to set at the red line</span>
      </div>
      <button aria-label="Close visualiser" onClick={onClose} className="absolute right-2 top-1 z-10 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      <div ref={stage} className="absolute inset-0 overflow-hidden bg-cover bg-center" style={viz.image ? { backgroundImage: `url(${viz.image})` } : undefined} onPointerDown={(e) => { if (e.target === e.currentTarget) setEdit(null); }}>
        {list.map((f, i) => { const c = colorOf?.(f) ?? [0, 0, 0], [x, y] = posOf(f, i); const rgb = `rgb(${c[0]},${c[1]},${c[2]})`; return (
          <div key={f.uid} title={f.name} className={`absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none items-end justify-center overflow-hidden rounded-full border-2 text-[8px] font-semibold ${edit === f.uid ? "border-primary" : "border-border"}`}
            style={{ left: `${x * 100}%`, top: `${y * 100}%`, background: rgb, boxShadow: `0 0 18px 4px ${rgb.replace("rgb", "rgba").replace(")", ",0.55)")}` }}
            onPointerDown={(e) => { e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = { uid: f.uid, moved: false, pos: [x, y] }; }}
            onPointerMove={(e) => { const d = drag.current; if (!d || d.uid !== f.uid) return; const p = toStage(e); if (!d.moved && Math.hypot(p[0] - d.pos[0], p[1] - d.pos[1]) < 0.01) return; d.moved = true; d.pos = p; setDragPos({ uid: f.uid, p }); }}
            onPointerUp={() => { const d = drag.current; drag.current = null; if (!d) return; if (d.moved) { setViz({ pos: { ...viz.pos, [f.uid]: d.pos } }); setDragPos(null); } else setEdit(edit === f.uid ? null : f.uid); }}>
            <span className="max-w-full truncate px-0.5">{f.name}</span>
          </div>); })}
        {!list.length && <p className="p-10 text-center text-muted-foreground">Add lights in PATCH to see them here.</p>}
      </div>
      {ef && cur && <div className="absolute bottom-2 right-2 z-20 w-64 space-y-1.5 rounded-lg border border-border bg-surface p-2 text-xs shadow-2xl" aria-label="Light at playhead">
        <div className="flex items-center gap-1"><b className="flex-1 truncate">{ef.name} @ {time.toFixed(1)}s</b><button aria-label="Close light editor" onClick={() => setEdit(null)}><X className="h-3.5 w-3.5" /></button></div>
        <label className="flex items-center gap-2">Int<input type="range" min={0} max={100} value={Math.round(cur.intensity * 100)} onChange={(e) => setVal({ intensity: +e.target.value / 100 })} className="flex-1" /><span className="w-9 text-right font-mono">{Math.round(cur.intensity * 100)}%</span></label>
        <label className="flex items-center gap-2">CCT<input type="range" min={2000} max={10000} step={100} value={c2k(cur.cct ?? k2c(5600))} onChange={(e) => setVal({ cct: k2c(+e.target.value), hue: undefined, sat: undefined })} className="flex-1" /><span className="w-12 text-right font-mono">{cur.hue != null ? "—" : `${c2k(cur.cct ?? k2c(5600))}K`}</span></label>
        <label className="flex items-center gap-2">Colour<input type="color" aria-label="Light colour at playhead" value={cur.hue != null ? hsvHex(cur.hue, cur.sat ?? 1) : "#ffffff"} onChange={(e) => { const [hh, sa] = hexHs(e.target.value); setVal({ hue: hh, sat: sa, cct: undefined }); }} className="h-6 w-8 cursor-pointer rounded border border-input bg-transparent" /></label>
        <p className="text-muted-foreground">Each change adds a point at the red line; move the line and change again to make the light fade between them.</p>
      </div>}
      <div aria-label="Resize visualiser" onPointerDown={resize} className="absolute inset-x-0 bottom-0 z-10 h-1.5 cursor-ns-resize touch-none bg-border/60 hover:bg-primary" />
    </div>
  );
}

const BLENDS: [BlendMode, string][] = [["replace", "Replace"], ["add", "Add"], ["htp", "Brightest (HTP)"]];
const LAYER_COLOURS = ["#e5484d", "#f5a524", "#30a46c", "#0090ff", "#8e4ec6", "#e93d82", "#a1a1aa"];
const sel3 = "rounded border border-input bg-surface-elevated px-2 py-1 text-xs";

function LayerSettings({ timeline, trackId, onTrack, onMove, onClip, onClose }: { timeline: Timeline; trackId: string; onTrack: (p: Partial<TimelineTrack>) => void; onMove: (d: number) => void; onClip: (id: string, p: Partial<TimelineClip>) => void; onClose: () => void }) {
  const t = timeline.tracks.find((x) => x.id === trackId);
  if (!t) return null;
  const clips = timeline.clips.filter((c) => c.track === t.id).sort((a, b) => a.start - b.start);
  return <section className="space-y-2 rounded border border-primary/50 p-2" aria-label="Layer settings">
    <div className="flex items-center gap-1"><b className="flex-1 truncate">{t.name}{t.adjust ? " · adjustment" : ""}</b>
      <Button size="icon" variant="ghost" aria-label="Move layer up" onClick={() => onMove(-1)}><ArrowUp /></Button>
      <Button size="icon" variant="ghost" aria-label="Move layer down" onClick={() => onMove(1)}><ArrowDown /></Button>
      <Button size="icon" variant="ghost" aria-label="Close layer settings" onClick={onClose}><X /></Button></div>
    <label className="flex items-center gap-2">Name<input aria-label="Layer name (settings)" value={t.name} onChange={(e) => onTrack({ name: e.target.value })} className={`${sel3} min-w-0 flex-1`} /></label>
    <div className="flex flex-wrap items-center gap-1">Colour
      {LAYER_COLOURS.map((c) => <button key={c} aria-label={`Layer colour ${c}`} onClick={() => onTrack({ color: t.color === c ? undefined : c })} className={`h-5 w-5 rounded-full border-2 ${t.color === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />)}</div>
    <label className="flex items-center gap-2">Opacity<input type="range" min={0} max={100} value={Math.round((t.opacity ?? 1) * 100)} onChange={(e) => onTrack({ opacity: +e.target.value / 100 })} className="flex-1" /><span className="w-9 text-right font-mono">{Math.round((t.opacity ?? 1) * 100)}%</span></label>
    {!t.adjust && <label className="flex items-center gap-2">Blend<select aria-label="Blend mode" value={t.blend ?? "replace"} onChange={(e) => onTrack({ blend: e.target.value as BlendMode })} className={sel3}>{BLENDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>}
    <div className="flex gap-1">
      <Button size="sm" variant={t.solo ? "default" : "secondary"} onClick={() => onTrack({ solo: !t.solo })}>Solo</Button>
      <Button size="sm" variant={t.locked ? "default" : "secondary"} onClick={() => onTrack({ locked: !t.locked })}>{t.locked ? "Locked" : "Lock"}</Button>
      <Button size="sm" variant={t.muted ? "default" : "secondary"} onClick={() => onTrack({ muted: !t.muted })}>{t.muted ? "Off" : "On"}</Button>
    </div>
    <h4 className="pt-1 text-[10px] font-semibold uppercase text-muted-foreground">Every step on this layer</h4>
    {!clips.length && <p className="text-muted-foreground">No clips on this layer yet.</p>}
    {clips.map((c) => <div key={c.id} className="space-y-1 rounded bg-surface-elevated p-1.5">
      <div className="flex items-center gap-2"><b className="flex-1 truncate">{c.name}</b><span className="font-mono text-muted-foreground">{c.start.toFixed(1)}–{(c.start + c.length).toFixed(1)}s</span></div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1">Start<NumberField aria-label={`${c.name} start`} min={0} step={0.1} value={+c.start.toFixed(2)} onChange={(v) => v !== undefined && !t.locked && onClip(c.id, { start: Math.max(0, v) })} className={field} /></label>
        <label className="flex items-center gap-1">Len<NumberField aria-label={`${c.name} length`} min={0.2} step={0.1} value={+c.length.toFixed(2)} onChange={(v) => v !== undefined && !t.locked && onClip(c.id, { length: Math.max(0.2, v) })} className={field} /></label>
      </div>
      {(c.kind === "level" || c.kind === "adjust") && <StepList clip={c} disabled={t.locked} onKeys={(keys) => onClip(c.id, { keys })} />}
      {c.kind === "adjust" && <AdjustControls value={c.adj ?? {}} disabled={t.locked} onChange={(adj) => onClip(c.id, { adj })} />}
    </div>)}
  </section>;
}

/** Table of every point in a clip: time, intensity, CCT, colour — all editable, with add/remove. */
function StepList({ clip, onKeys, disabled }: { clip: TimelineClip; onKeys: (k: TimelineKey[]) => void; disabled?: boolean | undefined }) {
  const ks = clip.keys?.length ? [...clip.keys].sort((a, b) => a.t - b.t) : [
    { id: newId(), t: 0, intensity: clip.from?.intensity ?? 1, cct: clip.from?.cct }, { id: newId(), t: clip.length, intensity: clip.to?.intensity ?? clip.from?.intensity ?? 1, cct: clip.to?.cct }];
  const max = clip.kind === "adjust" ? 200 : 100;
  const upd = (id: string, p: Partial<TimelineKey>) => !disabled && onKeys(ks.map((k) => (k.id === id ? { ...k, ...p } : k)));
  return <div className="space-y-1">
    <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-1 text-[10px] uppercase text-muted-foreground"><span>Time s</span><span>{clip.kind === "adjust" ? "Level %" : "Int %"}</span><span>CCT K</span><span>Col</span><span /></div>
    {ks.map((k) => <div key={k.id} className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-center gap-1">
      <NumberField aria-label="Step time" min={0} max={clip.length} step={0.1} value={+k.t.toFixed(2)} onChange={(v) => v !== undefined && upd(k.id, { t: Math.max(0, Math.min(clip.length, v)) })} className={`${field} w-full`} />
      <NumberField aria-label="Step intensity" min={0} max={max} value={Math.round(k.intensity * 100)} onChange={(v) => v !== undefined && upd(k.id, { intensity: v / 100 })} className={`${field} w-full`} />
      <NumberField aria-label="Step CCT" allowEmpty placeholder="—" min={2000} max={10000} step={100} value={k.cct != null ? c2k(k.cct) : undefined} onChange={(v) => upd(k.id, { cct: v == null ? undefined : k2c(v), ...(v != null ? { hue: undefined, sat: undefined } : {}) })} className={`${field} w-full`} />
      <input type="color" aria-label="Step colour" value={k.hue != null ? hsvHex(k.hue, k.sat ?? 1) : "#ffffff"} onChange={(e) => { const [h, sa] = hexHs(e.target.value); upd(k.id, { hue: h, sat: sa, cct: undefined }); }} className="h-6 w-7 cursor-pointer rounded border border-input bg-transparent" />
      <button aria-label="Delete step" disabled={disabled || ks.length <= 1} onClick={() => onKeys(ks.filter((x) => x.id !== k.id))} className="text-muted-foreground hover:text-destructive disabled:opacity-30"><X className="h-3.5 w-3.5" /></button>
    </div>)}
    <Button size="sm" variant="secondary" disabled={disabled} onClick={() => { const last = ks[ks.length - 1]; onKeys([...ks, { id: newId(), t: Math.min(clip.length, (last?.t ?? 0) + 1), intensity: last?.intensity ?? 1 }]); }}><Plus />Step</Button>
  </div>;
}

/** Filter controls for an adjustment clip. */
function AdjustControls({ value: a, onChange, disabled }: { value: AdjustFilter; onChange: (a: AdjustFilter) => void; disabled?: boolean | undefined }) {
  const set = (p: Partial<AdjustFilter>) => !disabled && onChange({ ...a, ...p });
  const row = (label: string, v: number, min: number, max: number, step: number, unit: string, on: (n: number) => void) =>
    <label className="flex items-center gap-2"><span className="w-20">{label}</span><input type="range" min={min} max={max} step={step} value={v} onChange={(e) => on(+e.target.value)} className="flex-1" /><span className="w-14 text-right font-mono">{v}{unit}</span></label>;
  return <div className="space-y-1 rounded border border-border p-2">
    <div className="flex items-center"><b className="flex-1">Filter</b><Button size="sm" variant="ghost" disabled={disabled} onClick={() => onChange({})}>Reset</Button></div>
    {row("Contrast", Math.round((a.contrast ?? 1) * 100), 0, 200, 5, "%", (n) => set({ contrast: n / 100 }))}
    {row("CCT shift", a.cctShift ?? 0, -3000, 3000, 100, "K", (n) => set({ cctShift: n }))}
    {row("Green/Mag", Math.round((a.gmShift ?? 0) * 100), -100, 100, 5, "", (n) => set({ gmShift: n / 100 }))}
    {row("Hue shift", a.hueShift ?? 0, -180, 180, 5, "°", (n) => set({ hueShift: n }))}
    {row("Saturation", Math.round((a.satMul ?? 1) * 100), 0, 200, 5, "%", (n) => set({ satMul: n / 100 }))}
    <label className="flex items-center gap-2"><span className="w-20">Tint / gel</span><input type="color" aria-label="Tint colour" value={a.tint ?? "#ff8800"} onChange={(e) => set({ tint: e.target.value, tintAmt: a.tintAmt || 0.5 })} className="h-6 w-8 cursor-pointer rounded border border-input bg-transparent" />
      <input type="range" aria-label="Tint amount" min={0} max={100} value={Math.round((a.tintAmt ?? 0) * 100)} onChange={(e) => set({ tintAmt: +e.target.value / 100, tint: a.tint ?? "#ff8800" })} className="flex-1" /><span className="w-14 text-right font-mono">{Math.round((a.tintAmt ?? 0) * 100)}%</span></label>
  </div>;
}

/** Overview strip of the whole timeline; click or drag to jump the view there. */
function Minimap({ timeline, len, time, zoom, scroller }: { timeline: Timeline; len: number; time: number; zoom: number; scroller: RefObject<HTMLDivElement | null> }) {
  const [view, setView] = useState({ l: 0, w: 1 });
  useEffect(() => { const el = scroller.current; if (!el) return; const f = () => setView({ l: el.scrollLeft, w: el.clientWidth }); f(); el.addEventListener("scroll", f); const ro = new ResizeObserver(f); ro.observe(el); return () => { el.removeEventListener("scroll", f); ro.disconnect(); }; }, [scroller]);
  const total = HEAD + len * zoom, n = Math.max(1, timeline.tracks.length);
  const jump = (e: RPE<HTMLDivElement>) => { const el = scroller.current; if (!el) return; const r = e.currentTarget.getBoundingClientRect(); el.scrollLeft = ((e.clientX - r.left) / r.width) * total - el.clientWidth / 2; };
  return <div aria-label="Timeline overview" className="relative h-5 shrink-0 cursor-pointer touch-none border-b border-border bg-muted/30" onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); jump(e); }} onPointerMove={(e) => { if (e.buttons) jump(e); }}>
    {timeline.clips.map((c) => { const ti = timeline.tracks.findIndex((t) => t.id === c.track); return <span key={c.id} className={`pointer-events-none absolute ${c.color ? "" : KIND_STYLE[c.kind]}`} style={{ left: `${((HEAD + c.start * zoom) / total) * 100}%`, width: `${Math.max(0.3, (c.length * zoom / total) * 100)}%`, top: `${(ti / n) * 100}%`, height: `${100 / n}%`, ...(c.color ? { background: c.color } : {}) }} />; })}
    <span className="pointer-events-none absolute inset-y-0 w-px bg-destructive" style={{ left: `${((HEAD + time * zoom) / total) * 100}%` }} />
    <span className="pointer-events-none absolute inset-y-0 rounded-sm border border-primary bg-primary/10" style={{ left: `${(view.l / total) * 100}%`, width: `${Math.min(100, (view.w / total) * 100)}%` }} />
  </div>;
}
