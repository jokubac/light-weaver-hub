import { useEffect, useRef, useState, type PointerEvent as RPE } from "react";
import { Copy, Eye, EyeOff, Music, Pause, Play, Plus, Square, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/console/NumberField";
import { useFxLibrary } from "@/lib/fxlib";
import type { PatchedFixture } from "@/lib/dmx";
import type { PixelLayer } from "@/lib/pixels";
import type { Recording } from "@/lib/store";
import { newId, timelineLength, type ClipKind, type Timeline, type TimelineClip } from "@/lib/timeline";

const ROW = 52, HEAD = 120;
const KIND_STYLE: Record<ClipKind, string> = {
  fx: "bg-primary/70 border-primary", pixel: "bg-accent/80 border-accent-foreground/40", rec: "bg-success/70 border-success", level: "bg-warning/70 border-warning",
};
const KIND_LABEL: Record<ClipKind, string> = { fx: "FX", pixel: "PIXEL", rec: "REC", level: "LEVEL" };
const k2c = (k: number) => (k - 2000) / 8000, c2k = (c: number) => Math.round(2000 + c * 8000);
const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
const field = "w-16 rounded border border-input bg-surface-elevated px-1 py-1 text-right font-mono text-xs";

export function TimelinePanel({ timeline, setTimeline, time, playing, onPlay, onPause, onStop, onSeek, fixtures, selected, recordings, layers, activeClips, audioPeaks, onAudio, onRemoveAudio }: {
  timeline: Timeline; setTimeline: (t: Timeline) => void; time: number; playing: boolean;
  onPlay: () => void; onPause: () => void; onStop: () => void; onSeek: (t: number) => void;
  fixtures: PatchedFixture[]; selected: string[]; recordings: Recording[]; layers: PixelLayer[]; activeClips: string[];
  audioPeaks: number[] | null; onAudio: (f: File) => void; onRemoveAudio: () => void;
}) {
  const lib = useFxLibrary();
  const [zoom, setZoom] = useState(40); // px per second
  const [track, setTrack] = useState(timeline.tracks[0]?.id ?? "");
  const [picked, setPicked] = useState<string | null>(null);
  const [addKind, setAddKind] = useState("");
  const drag = useRef<{ id: string; mode: "move" | "l" | "r"; x: number; y: number; orig: TimelineClip } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const len = Math.max(30, timelineLength(timeline) + 10, time + 5);
  const clip = timeline.clips.find((c) => c.id === picked);
  const set = (clips: TimelineClip[]) => setTimeline({ ...timeline, clips });
  const patch = (id: string, p: Partial<TimelineClip>) => set(timeline.clips.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const targetTrack = timeline.tracks.find((t) => t.id === track)?.id ?? timeline.tracks[0]?.id;

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,select,textarea")) return;
      if ((e.key === "Delete" || e.key === "Backspace") && picked) { set(timeline.clips.filter((c) => c.id !== picked)); setPicked(null); }
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
    if (kind === "fxsel") { const f = fixtures.find((x) => selected.includes(x.uid) && x.fx.kind !== "none"); if (f) c = { ...base, kind: "fx", name: `${f.fx.kind} (${f.name})`, fx: structuredClone(f.fx), uids }; else alert("Select a light that has an effect set."); }
    else if (kind === "fx") { const s = lib.lib.fx.find((x) => x.id === ref); if (s) c = { ...base, kind: "fx", name: s.name, fx: structuredClone(s.fx), uids }; }
    else if (kind === "pxlayer") { const l = layers.find((x) => x.id === ref); if (l) c = { ...base, kind: "pixel", name: l.name, layer: structuredClone({ ...l, playing: false }) }; }
    else if (kind === "pixel") { const s = lib.lib.pixel.find((x) => x.id === ref); if (s) c = { ...base, kind: "pixel", name: s.name, layer: structuredClone(s.layer), uids: fixtures.filter((f) => selected.includes(f.uid)).map((f) => f.uid) }; }
    else if (kind === "rec") { const r = recordings.find((x) => x.id === ref); if (r) { const l = r.steps.reduce((a, s) => a + s.fadeIn + s.hold + s.fadeOut - (s.overlap ?? 0), 0); c = { ...base, kind: "rec", name: r.name, recId: r.id, length: Math.max(1, l) }; } }
    else if (kind === "fadein" || kind === "fadeout" || kind === "level") {
      const cur = fixtures.find((f) => uids.includes(f.uid));
      const from = kind === "fadein" ? 0 : cur?.intensity ?? 1, to = kind === "fadeout" ? 0 : kind === "fadein" ? cur?.intensity || 1 : 1;
      c = { ...base, kind: "level", length: 4, name: kind === "fadein" ? "Fade in" : kind === "fadeout" ? "Fade out" : "Level", uids, from: { intensity: from }, to: { intensity: to } };
    }
    if (c) { set([...timeline.clips, c]); setPicked(c.id); }
  };

  const down = (e: RPE, c: TimelineClip, mode: "move" | "l" | "r") => {
    e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setPicked(c.id); drag.current = { id: c.id, mode, x: e.clientX, y: e.clientY, orig: { ...c } };
  };
  const move = (e: RPE) => {
    const d = drag.current; if (!d) return;
    const ds = Math.round(((e.clientX - d.x) / zoom) * 10) / 10, o = d.orig;
    if (d.mode === "move") {
      const ti = Math.max(0, Math.min(timeline.tracks.length - 1, timeline.tracks.findIndex((t) => t.id === o.track) + Math.round((e.clientY - d.y) / ROW)));
      patch(d.id, { start: Math.max(0, o.start + ds), track: timeline.tracks[ti]!.id });
    } else if (d.mode === "r") patch(d.id, { length: Math.max(0.2, o.length + ds) });
    else { const s = Math.max(0, Math.min(o.start + o.length - 0.2, o.start + ds)); patch(d.id, { start: s, length: o.length - (s - o.start) }); }
  };
  const seekAt = (e: RPE<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); onSeek(Math.max(0, (e.clientX - r.left) / zoom)); };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background" onPointerMove={move} onPointerUp={() => (drag.current = null)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2">
        <Button size="icon" variant={playing ? "default" : "secondary"} aria-label={playing ? "Pause" : "Play"} onClick={playing ? onPause : onPlay}>{playing ? <Pause /> : <Play />}</Button>
        <Button size="icon" variant="secondary" aria-label="Stop" onClick={onStop}><Square /></Button>
        <span className="w-20 font-mono text-sm tabular-nums">{fmt(time)}</span>
        <select aria-label="Add clip" value={addKind} onChange={(e) => { addClip(e.target.value); setAddKind(""); }} className="rounded-md border border-input bg-surface-elevated px-2 py-2 text-sm">
          <option value="">+ Add clip at playhead…</option>
          <optgroup label="Light effects">
            <option value="fxsel">Effect from selected light</option>
            {lib.lib.fx.map((s) => <option key={s.id} value={`fx:${s.id}`}>{s.name}</option>)}
          </optgroup>
          <optgroup label="Pixel effects">
            {layers.map((l) => <option key={l.id} value={`pxlayer:${l.id}`}>{l.name} (current layer)</option>)}
            {lib.lib.pixel.map((s) => <option key={s.id} value={`pixel:${s.id}`}>{s.name}</option>)}
          </optgroup>
          <optgroup label="REC sequences">{recordings.map((r) => <option key={r.id} value={`rec:${r.id}`}>{r.name}</option>)}</optgroup>
          <optgroup label="Brightness / colour"><option value="fadein">Fade in</option><option value="fadeout">Fade out</option><option value="level">Level / CCT ramp</option></optgroup>
        </select>
        <span className="text-xs text-muted-foreground">on</span>
        <select aria-label="Layer" value={targetTrack} onChange={(e) => setTrack(e.target.value)} className="rounded-md border border-input bg-surface-elevated px-2 py-2 text-sm">
          {timeline.tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <Button variant="secondary" size="sm" onClick={() => setTimeline({ ...timeline, tracks: [{ id: newId(), name: `Layer ${timeline.tracks.length + 1}` }, ...timeline.tracks] })}><Plus />Layer</Button>
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}><Music />{timeline.audio ? "Replace audio" : "Add audio"}</Button>
        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onAudio(f); e.target.value = ""; }} />
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">Zoom<input type="range" min={5} max={200} value={zoom} onChange={(e) => setZoom(+e.target.value)} className="w-28" /></label>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="relative" style={{ width: HEAD + len * zoom }}>
          {/* ruler */}
          <div className="sticky top-0 z-20 flex h-7 border-b border-border bg-surface">
            <div className="sticky left-0 z-10 shrink-0 border-r border-border bg-surface" style={{ width: HEAD }} />
            <div className="relative flex-1 cursor-pointer" onPointerDown={seekAt}>
              {Array.from({ length: Math.ceil(len) + 1 }, (_, s) => s).filter((s) => s % (zoom < 15 ? 10 : zoom < 40 ? 5 : 1) === 0).map((s) => (
                <span key={s} className="absolute top-0 h-full border-l border-border pl-1 text-[10px] text-muted-foreground" style={{ left: s * zoom }}>{fmt(s).replace(/\.0$/, "")}</span>
              ))}
            </div>
          </div>
          {timeline.tracks.map((t, i) => (
            <div key={t.id} className={`flex border-b border-border ${t.muted ? "opacity-40" : ""}`} style={{ height: ROW }}>
              <div className={`sticky left-0 z-10 flex shrink-0 items-center gap-1 border-r border-border px-2 ${track === t.id ? "bg-primary/15" : "bg-surface"}`} style={{ width: HEAD }} onClick={() => setTrack(t.id)}>
                <input aria-label="Layer name" value={t.name} onChange={(e) => setTimeline({ ...timeline, tracks: timeline.tracks.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)) })} className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none" />
                <button aria-label={t.muted ? "Show layer" : "Hide layer"} title={t.muted ? "Turn layer on" : "Turn layer off"} onClick={() => setTimeline({ ...timeline, tracks: timeline.tracks.map((x) => (x.id === t.id ? { ...x, muted: !x.muted } : x)) })} className="text-muted-foreground">{t.muted ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                {timeline.tracks.length > 1 && <button aria-label="Delete layer" onClick={() => { if (!timeline.clips.some((c) => c.track === t.id) || confirm(`Delete ${t.name} and its clips?`)) setTimeline({ ...timeline, tracks: timeline.tracks.filter((x) => x.id !== t.id), clips: timeline.clips.filter((c) => c.track !== t.id) }); }} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>}
              </div>
              <div className="relative flex-1" onPointerDown={(e) => { setTrack(t.id); setPicked(null); seekAt(e); }} style={{ background: i % 2 ? "hsl(var(--muted) / 0.15)" : undefined }}>
                {timeline.clips.filter((c) => c.track === t.id).map((c) => (
                  <div key={c.id} onPointerDown={(e) => down(e, c, "move")}
                    className={`absolute top-1 bottom-1 cursor-grab touch-none select-none overflow-hidden rounded-md border px-2 text-xs text-foreground ${KIND_STYLE[c.kind]} ${picked === c.id ? "ring-2 ring-foreground" : ""} ${activeClips.includes(c.id) ? "brightness-125" : ""}`}
                    style={{ left: c.start * zoom, width: Math.max(8, c.length * zoom) }}>
                    {(c.fadeIn ?? 0) > 0 && <div className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-background/70 to-transparent" style={{ width: (c.fadeIn ?? 0) * zoom }} />}
                    {(c.fadeOut ?? 0) > 0 && <div className="pointer-events-none absolute inset-y-0 right-0 bg-gradient-to-l from-background/70 to-transparent" style={{ width: (c.fadeOut ?? 0) * zoom }} />}
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
              <div className="sticky left-0 z-10 flex shrink-0 items-center gap-1 border-r border-border bg-surface px-2" style={{ width: HEAD }}>
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
          <div className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-destructive" style={{ left: HEAD + time * zoom }} />
        </div>
        {timeline.clips.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Select lights, move the red playhead and add effects, pixel effects, REC sequences or fades. Drag clips to move them, drag their edges to trim. The top layer wins where clips overlap.</p>}
      </div>

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
          {clip.kind !== "rec" && <span className="text-muted-foreground">{clip.uids?.length ? `${clip.uids.length} lights` : clip.kind === "pixel" ? "layer's own lights" : "no lights"}</span>}
          {clip.kind !== "rec" && <Button size="sm" variant="secondary" disabled={!selected.length} onClick={() => patch(clip.id, { uids: [...selected] })}>Use selected lights</Button>}
          <div className="ml-auto flex gap-1">
            <Button size="icon" variant="ghost" aria-label="Duplicate clip" title="Duplicate after this clip" onClick={() => { const c = { ...structuredClone(clip), id: newId(), start: clip.start + clip.length }; set([...timeline.clips, c]); setPicked(c.id); }}><Copy /></Button>
            <Button size="icon" variant="ghost" aria-label="Delete clip" onClick={() => { set(timeline.clips.filter((c) => c.id !== clip.id)); setPicked(null); }}><Trash2 /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
