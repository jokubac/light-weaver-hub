import { useEffect, useRef, useState, type PointerEvent as RPE, type MouseEvent as ReactMouseEvent } from "react";
import { Copy, Flag, MousePointerSquareDashed, Repeat, SlidersHorizontal, SkipForward, Eye, EyeOff, Music, Pause, Play, Plus, Square, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/console/NumberField";
import { useFxLibrary } from "@/lib/fxlib";
import { membersOf } from "@/lib/fixture-groups";
import type { PatchedFixture } from "@/lib/dmx";
import type { PixelLayer } from "@/lib/pixels";
import type { Recording } from "@/lib/store";
import { clipValue, newId, timelineLength, type ClipKind, type Timeline, type TimelineClip, type TimelineKey } from "@/lib/timeline";

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
/** Automation points of a clip; clips without points start from their from→to ramp. */
const keysOf = (c: TimelineClip): TimelineKey[] => c.keys?.length ? [...c.keys].sort((a, b) => a.t - b.t)
  : [{ id: newId(), t: 0, intensity: c.from?.intensity ?? 1, cct: c.from?.cct }, { id: newId(), t: c.length, intensity: c.to?.intensity ?? c.from?.intensity ?? 1, cct: c.to?.cct }];
const fits = (t: { adjust?: boolean | undefined } | undefined, c: TimelineClip) => !!t?.adjust === (c.kind === "adjust");
const hasKeys = (c: TimelineClip) => c.kind === "level" || c.kind === "adjust";
const field = "w-16 rounded border border-input bg-surface-elevated px-1 py-1 text-right font-mono text-xs";

export function TimelinePanel({ timeline, setTimeline, time, playing, onPlay, onPause, onStop, onGo, waiting, repeat, onRepeat, groups, onSeek, fixtures, selected, recordings, layers, activeClips, audioPeaks, onAudio, onRemoveAudio }: {
  timeline: Timeline; setTimeline: (t: Timeline) => void; time: number; playing: boolean;
  onPlay: () => void; onPause: () => void; onStop: () => void; onGo: () => void; waiting: boolean; repeat: boolean; onRepeat: () => void; groups: string[]; onSeek: (t: number) => void;
  fixtures: PatchedFixture[]; selected: string[]; recordings: Recording[]; layers: PixelLayer[]; activeClips: string[];
  audioPeaks: number[] | null; onAudio: (f: File) => void; onRemoveAudio: () => void;
}) {
  const lib = useFxLibrary();
  const [zoom, setZoom] = useState(40); // px per second
  const [track, setTrack] = useState(timeline.tracks[0]?.id ?? "");
  const [sel, setSel] = useState<string[]>([]);
  const [marq, setMarq] = useState<{ t0: number; t1: number; a: number; b: number } | null>(null);
  const [addKind, setAddKind] = useState("");
  const [keySel, setKeySel] = useState<string | null>(null);
  const kdrag = useRef<{ clip: string; key: string; rect: DOMRect; moved: boolean } | null>(null);
  const drag = useRef<{ ids: { id: string; orig: TimelineClip }[]; mode: "move" | "l" | "r"; x: number; y: number; moved: boolean } | null>(null);
  const mdrag = useRef<{ id: string; x: number; t: number; moved: boolean } | null>(null);
  const marqRef = useRef<{ idx: number; x: number; top: number; left: number; moved: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const len = Math.max(30, timelineLength(timeline) + 10, time + 5);
  const clip = sel.length === 1 ? timeline.clips.find((c) => c.id === sel[0]) : undefined;
  const selClips = timeline.clips.filter((c) => sel.includes(c.id));
  const set = (clips: TimelineClip[]) => setTimeline({ ...timeline, clips });
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
    else if (kind === "fx") { const s = lib.lib.fx.find((x) => x.id === ref); if (s) c = { ...base, kind: "fx", name: s.name, fx: structuredClone(s.fx), uids }; }
    else if (kind === "pxlayer") { const l = layers.find((x) => x.id === ref); if (l) c = { ...base, kind: "pixel", name: l.name, layer: structuredClone({ ...l, playing: false }) }; }
    else if (kind === "pixel") { const s = lib.lib.pixel.find((x) => x.id === ref); if (s) c = { ...base, kind: "pixel", name: s.name, layer: structuredClone(s.layer), uids: fixtures.filter((f) => selected.includes(f.uid)).map((f) => f.uid) }; }
    else if (kind === "rec") { const r = recordings.find((x) => x.id === ref); if (r) { const l = r.steps.reduce((a, s) => a + s.fadeIn + s.hold + s.fadeOut - (s.overlap ?? 0), 0); c = { ...base, kind: "rec", name: r.name, recId: r.id, length: Math.max(1, l) }; } }
    else if (kind === "fadein" || kind === "fadeout" || kind === "level") {
      const cur = fixtures.find((f) => uids.includes(f.uid));
      const from = kind === "fadein" ? 0 : cur?.intensity ?? 1, to = kind === "fadeout" ? 0 : kind === "fadein" ? cur?.intensity || 1 : 1;
      c = { ...base, kind: "level", length: 4, name: kind === "fadein" ? "Fade in" : kind === "fadeout" ? "Fade out" : "Level", uids, from: { intensity: from }, to: { intensity: to } };
    }
    if (c) { setTimeline(placeClip(timeline, c)); setSel([c.id]); }
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
    const v = clipValue(c, t), k: TimelineKey = { id: newId(), t: Math.round(t * 10) / 10, intensity: Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)), cct: v.cct, hue: v.hue, sat: v.sat };
    setKeys(c, [...keysOf(c), k]); setSel([c.id]); setKeySel(k.id);
  };
  const keyMove = (e: RPE, c: TimelineClip) => {
    const d = kdrag.current; if (!d || d.clip !== c.id) return;
    d.moved = true;
    const t = Math.max(0, Math.min(c.length, Math.round(((e.clientX - d.rect.left) / zoom) * 10) / 10)), i = Math.max(0, Math.min(1, 1 - (e.clientY - d.rect.top) / d.rect.height));
    setKeys(c, keysOf(c).map((k) => (k.id === d.key ? { ...k, t, intensity: Math.round(i * 100) / 100 } : k)));
  };

  /** Pointer down on a clip: plain click selects only it, Shift/Ctrl/Cmd adds or removes it, and a clip already in the group keeps the group so all of them drag together. */
  const down = (e: RPE, c: TimelineClip, mode: "move" | "l" | "r") => {
    e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const add = e.shiftKey || e.metaKey || e.ctrlKey;
    const ids = add ? (sel.includes(c.id) ? sel.filter((x) => x !== c.id) : [...sel, c.id]) : sel.includes(c.id) ? sel : [c.id];
    setSel(ids);
    const group = mode === "move" ? ids : [c.id];
    drag.current = { ids: group.flatMap((id) => { const o = timeline.clips.find((x) => x.id === id); return o ? [{ id, orig: { ...o } }] : []; }), mode, x: e.clientX, y: e.clientY, moved: false };
  };
  const move = (e: RPE) => {
    const d = drag.current; if (!d) return;
    const ds = Math.round(((e.clientX - d.x) / zoom) * 10) / 10, dy = Math.round((e.clientY - d.y) / ROW);
    if (Math.abs(e.clientX - d.x) > 2 || Math.abs(e.clientY - d.y) > 2) d.moved = true;
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
    <div className="flex min-h-0 flex-1 flex-col bg-background" onPointerMove={move} onPointerUp={up}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2">
        <Button size="icon" variant={playing ? "default" : "secondary"} aria-label={playing ? "Pause" : "Play"} onClick={playing ? onPause : onPlay}>{playing ? <Pause /> : <Play />}</Button>
        <Button size="icon" variant={waiting ? "default" : "secondary"} aria-label="GO — continue from marker" title="GO — continue from marker" disabled={!waiting} onClick={onGo} className={waiting ? "animate-pulse" : ""}><SkipForward /></Button>
        <Button size="icon" variant="secondary" aria-label="Stop" title="Stop — return lights to how they were" onClick={onStop}><Square /></Button>
        <Button size="icon" variant={repeat ? "default" : "secondary"} aria-label="Repeat" aria-pressed={repeat} title="Repeat" onClick={onRepeat}><Repeat /></Button>
        <span className="w-20 font-mono text-sm tabular-nums">{fmt(time)}</span>
        <select aria-label="Add fixture" title="Add lights or a group at the playhead" value={addKind} onChange={(e) => { addClip(e.target.value); setAddKind(""); }} className="rounded-md border border-input bg-secondary px-2 py-2 text-sm font-medium text-secondary-foreground">
          <option value="">+ Fixture</option>
          <optgroup label="Lights / groups">
            {selected.length > 1 && <option value="on">Selected lights ON ({selected.length})</option>}
            {groups.map((g) => <option key={g} value={`group:${g}`}>Group {g} ON</option>)}
          </optgroup>
          <optgroup label="Single light ON">
            {fixtures.map((f, i) => <option key={f.uid} value={`light:${f.uid}`}>{i + 1}. {f.name}</option>)}
          </optgroup>
          <optgroup label="Brightness / colour"><option value="fadein">Fade in</option><option value="fadeout">Fade out</option><option value="level">Level / CCT ramp</option></optgroup>
        </select>
        <select aria-label="Add effect" title="Add an effect at the playhead" value={addKind} onChange={(e) => { addClip(e.target.value); setAddKind(""); }} className="rounded-md border border-input bg-secondary px-2 py-2 text-sm font-medium text-secondary-foreground">
          <option value="">+ Effect</option>
          <optgroup label="Light effects">
            <option value="fxsel">Effect from selected light</option>
            {lib.lib.fx.map((s) => <option key={s.id} value={`fx:${s.id}`}>{s.name}</option>)}
          </optgroup>
          <optgroup label="Pixel effects">
            {layers.map((l) => <option key={l.id} value={`pxlayer:${l.id}`}>{l.name} (current layer)</option>)}
            {lib.lib.pixel.map((s) => <option key={s.id} value={`pixel:${s.id}`}>{s.name}</option>)}
          </optgroup>
          <optgroup label="REC sequences">{recordings.map((r) => <option key={r.id} value={`rec:${r.id}`}>{r.name}</option>)}</optgroup>
        </select>
        <span className="text-xs text-muted-foreground">on</span>
        <select aria-label="Layer" value={targetTrack} onChange={(e) => setTrack(e.target.value)} className="rounded-md border border-input bg-surface-elevated px-2 py-2 text-sm">
          {timeline.tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <Button variant="secondary" size="sm" title="Playback stops here until GO" onClick={() => { const m = timeline.markers ?? []; setTimeline({ ...timeline, markers: [...m, { id: newId(), t: Math.round(time * 10) / 10, name: `M${m.length + 1}` }].sort((a, b) => a.t - b.t) }); }}><Flag />Marker</Button>
        <Button variant="secondary" size="sm" onClick={() => setTimeline({ ...timeline, tracks: [{ id: newId(), name: `Layer ${timeline.tracks.length + 1}` }, ...timeline.tracks] })}><Plus />Layer</Button>
        <Button variant="secondary" size="sm" title="Adjustment layer — changes brightness and colour of every layer below it" onClick={addAdjust}><SlidersHorizontal />Adjustment layer</Button>
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}><Music />{timeline.audio ? "Replace audio" : "Add audio"}</Button>
        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onAudio(f); e.target.value = ""; }} />
        <Button variant="secondary" size="sm" title="Select every clip" onClick={() => setSel(timeline.clips.map((c) => c.id))}><MousePointerSquareDashed />Select all</Button>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">Zoom<input type="range" min={5} max={200} value={zoom} onChange={(e) => setZoom(+e.target.value)} className="w-28" /></label>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="relative" style={{ width: HEAD + len * zoom }}>
          {/* ruler */}
          <div className="sticky top-0 z-50 flex h-7 border-b border-border bg-surface">
            <div className="sticky left-0 z-50 shrink-0 border-r border-border bg-surface" style={{ width: HEAD }} />
            <div className="relative flex-1 cursor-pointer" onPointerDown={seekAt}>
              {Array.from({ length: Math.ceil(len) + 1 }, (_, s) => s).filter((s) => s % (zoom < 15 ? 10 : zoom < 40 ? 5 : 1) === 0).map((s) => (
                <span key={s} className="absolute top-0 h-full border-l border-border pl-1 text-[10px] text-muted-foreground" style={{ left: s * zoom }}>{fmt(s).replace(/\.0$/, "")}</span>
              ))}
            </div>
          </div>
          {timeline.tracks.map((t, i) => (
            <div key={t.id} className={`flex border-b border-border ${t.muted ? "opacity-40" : ""}`} style={{ height: ROW }}>
              <div className={`sticky left-0 z-40 flex shrink-0 items-center gap-1 border-r border-border px-2 ${track === t.id ? "bg-primary/15" : "bg-surface"}`} style={{ width: HEAD }} onClick={() => setTrack(t.id)}>
                <input aria-label="Layer name" value={t.name} onChange={(e) => setTimeline({ ...timeline, tracks: timeline.tracks.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)) })} className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-foreground outline-none" />
                <button aria-label={t.muted ? "Show layer" : "Hide layer"} title={t.muted ? "Turn layer on" : "Turn layer off"} onClick={() => setTimeline({ ...timeline, tracks: timeline.tracks.map((x) => (x.id === t.id ? { ...x, muted: !x.muted } : x)) })} className="text-muted-foreground">{t.muted ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                {timeline.tracks.length > 1 && <button aria-label="Delete layer" onClick={() => { if (!timeline.clips.some((c) => c.track === t.id) || confirm(`Delete ${t.name} and its clips?`)) { setTimeline({ ...timeline, tracks: timeline.tracks.filter((x) => x.id !== t.id), clips: timeline.clips.filter((c) => c.track !== t.id) }); setSel([]); } }} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>}
              </div>
              <div data-track={t.id} className={`relative flex-1 ${i % 2 ? "bg-muted/15" : ""}`} onPointerDown={(e) => laneDown(e, t.id)} onPointerMove={laneMove} onPointerUp={laneUp}>
                {timeline.clips.filter((c) => c.track === t.id).map((c) => (
                  <div key={c.id} onPointerDown={(e) => down(e, c, "move")} onDoubleClick={(e) => addKey(e, c)}
                    className={`absolute top-1 bottom-1 cursor-grab touch-none select-none overflow-hidden rounded-md border px-2 text-xs text-foreground ${KIND_STYLE[c.kind]} ${sel.includes(c.id) ? "ring-2 ring-foreground" : ""} ${activeClips.includes(c.id) ? "brightness-125" : ""}`}
                    style={{ left: c.start * zoom, width: Math.max(8, c.length * zoom) }}>
                    {(c.fadeIn ?? 0) > 0 && <div className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-background/70 to-transparent" style={{ width: (c.fadeIn ?? 0) * zoom }} />}
                    {(c.fadeOut ?? 0) > 0 && <div className="pointer-events-none absolute inset-y-0 right-0 bg-gradient-to-l from-background/70 to-transparent" style={{ width: (c.fadeOut ?? 0) * zoom }} />}
                    {hasKeys(c) && (() => { const ks = keysOf(c), h = ROW - 8; return <>
                      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
                        <polyline fill="none" stroke="currentColor" strokeWidth={1.5} points={[{ t: 0, intensity: ks[0]!.intensity }, ...ks, { t: c.length, intensity: ks[ks.length - 1]!.intensity }].map((k) => `${k.t * zoom},${(1 - k.intensity) * h}`).join(" ")} />
                      </svg>
                      {c.keys?.length ? ks.map((k) => <div key={k.id} title={`${Math.round(k.intensity * 100)}%${k.cct != null ? ` · ${c2k(k.cct)}K` : ""}${k.hue != null ? ` · hue ${Math.round(k.hue)}°` : ""} — drag to move, double-click to delete`}
                        className={`absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border-2 border-foreground ${keySel === k.id ? "bg-primary" : "bg-background"}`}
                        style={{ left: k.t * zoom, top: (1 - k.intensity) * h, ...(k.hue != null ? { backgroundColor: `hsl(${k.hue} ${Math.round((k.sat ?? 1) * 100)}% 50%)` } : {}) }}
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
          {(timeline.markers ?? []).map((m) => <div key={m.id} className="absolute top-0 bottom-0 z-20" style={{ left: HEAD + m.t * zoom }}>
            <div className="pointer-events-none absolute inset-y-0 w-px bg-warning/70" />
            <div title={`${m.name} — playback waits here for GO. Drag to move.`}
              className="absolute top-0 flex h-7 cursor-grab touch-none select-none items-center gap-0.5 rounded-r bg-warning px-1 text-[10px] font-bold text-primary-foreground"
              onPointerDown={(e) => { e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId); mdrag.current = { id: m.id, x: e.clientX, t: m.t, moved: false }; }}
              onPointerMove={(e) => { const d = mdrag.current; if (d?.id !== m.id) return; const dx = e.clientX - d.x; if (Math.abs(dx) > 3) d.moved = true; if (!d.moved) return; setTimeline({ ...timeline, markers: (timeline.markers ?? []).map((x) => (x.id === m.id ? { ...x, t: Math.max(0, Math.round((d.t + dx / zoom) * 10) / 10) } : x)) }); }}
              onPointerUp={(e) => { const d = mdrag.current; mdrag.current = null; (e.target as HTMLElement).releasePointerCapture(e.pointerId); if (!d) return; if (!d.moved) onSeek(m.t); else setTimeline({ ...timeline, markers: [...(timeline.markers ?? [])].sort((a, b) => a.t - b.t) }); }}>
              <Flag className="h-3 w-3" />{m.name}
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setTimeline({ ...timeline, markers: (timeline.markers ?? []).filter((x) => x.id !== m.id) })} aria-label={`Delete marker ${m.name}`} title="Delete marker" className="ml-0.5 text-primary-foreground/70 hover:text-primary-foreground"><X className="h-3 w-3" /></button>
            </div>
          </div>)}
          {marq && <div className="pointer-events-none absolute z-30 border border-primary bg-primary/20" style={{ left: HEAD + marq.a * zoom, width: Math.max(2, (marq.b - marq.a) * zoom), top: 28 + marq.t0 * ROW, height: (marq.t1 - marq.t0 + 1) * ROW }} />}
          <div className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-destructive" style={{ left: HEAD + time * zoom }} />
        </div>
        {timeline.clips.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Select lights, move the red playhead and add effects, pixel effects, REC sequences or fades. Drag clips to move them, drag their edges to trim. The top layer wins where clips overlap.</p>}
        {timeline.clips.length > 0 && <p className="px-6 py-2 text-center text-xs text-muted-foreground">Click a clip to pick it. Shift-click adds clips to the selection, drag a box across empty space (over several layers) to select several; double-click a brightness clip to add a point, then drag any one of them to move the whole group. Ctrl/Cmd+A picks everything, Esc clears.</p>}
      </div>

      {sel.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-surface px-4 py-2 text-xs">
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
        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-surface px-4 py-2 text-xs">
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
          {hasKeys(clip) && (() => {
            const ks = keysOf(clip), k = clip.keys?.find((x) => x.id === keySel);
            const upd = (p: Partial<TimelineKey>) => k && setKeys(clip, ks.map((x) => (x.id === k.id ? { ...x, ...p } : x)));
            if (!k) return <span className="text-muted-foreground">Double-click the clip to add a point · {clip.keys?.length ?? 0} points</span>;
            return <span className="flex flex-wrap items-center gap-2 rounded border border-primary/50 px-2 py-1">
              <b>Point</b>
              <label className="flex items-center gap-1">At<NumberField aria-label="Point time" min={0} max={clip.length} step={0.1} value={+k.t.toFixed(2)} onChange={(v) => v !== undefined && upd({ t: Math.max(0, Math.min(clip.length, v)) })} className={field} />s</label>
              <label className="flex items-center gap-1">{clip.kind === "adjust" ? "Level" : "Intensity"}<NumberField aria-label="Point intensity" min={0} max={100} value={Math.round(k.intensity * 100)} onChange={(v) => v !== undefined && upd({ intensity: v / 100 })} className={field} />%</label>
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
    </div>
  );
}
