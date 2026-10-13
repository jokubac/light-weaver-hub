import { useState } from "react";
import { ChevronDown, ChevronRight, Play, Pause, Square, Trash2, RefreshCw, ArrowUp, ArrowDown, Repeat, Hand, SkipForward } from "lucide-react";
import { ItemMenu } from "./ItemMenu";
import { NumberField } from "./NumberField";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { snapshot } from "./LooksPanel";
import type { PatchedFixture } from "@/lib/dmx";
import type { PixelLayer } from "@/lib/pixels";
import { kelvin } from "@/lib/dmx";
import { recLength, stepLength, stepStarts } from "@/lib/recordings";
import { uid, type RecStep, type Recording, type StepTweak } from "@/lib/store";

export const makeStep = (src: PatchedFixture[], n: number, pixels?: PixelLayer[]): RecStep => ({
  id: uid(), name: `Cue ${n}`, fadeIn: 2, hold: 3, fadeOut: 0,
  states: src.map((f) => ({ uid: f.uid, name: f.name, state: snapshot(f) })),
  ...(pixels?.length ? { pixels: structuredClone(pixels) } : {}),
});

/** REC dialog: save the selected lights as a new recording or as the next cue of an existing one. */
export function RecDialog({ open, onOpenChange, src, recordings, setRecordings, pixels }: {
  open: boolean; onOpenChange: (o: boolean) => void; src: PatchedFixture[]; recordings: Recording[]; setRecordings: (r: Recording[]) => void; pixels?: PixelLayer[];
}) {
  const [name, setName] = useState("");
  const [naming, setNaming] = useState(false);
  const create = () => {
    const n = name.trim() || `REC ${recordings.length + 1}`;
    setRecordings([{ id: uid(), name: n, createdAt: Date.now(), steps: [makeStep(src, 1, pixels)] }, ...recordings]);
    setName(""); setNaming(false); onOpenChange(false);
  };
  const append = (id: string) => {
    setRecordings(recordings.map((r) => (r.id === id ? { ...r, steps: [...r.steps, makeStep(src, r.steps.length + 1, pixels)] } : r)));
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setNaming(false); onOpenChange(o); }}>
      <DialogContent className="max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader><DialogTitle>REC — {src.length} light{src.length === 1 ? "" : "s"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {!naming ? (
            <button onClick={() => setNaming(true)} className="w-full rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground">+ Create new REC</button>
          ) : <div className="flex gap-2">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder={`REC ${recordings.length + 1}`}
              className="min-w-0 flex-1 rounded-lg border border-input bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-primary" aria-label="Recording name" />
            <button onClick={create} className="rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground">Save</button>
          </div>}
          {recordings.length > 0 && <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Add as next cue to</p>}
          <div className="max-h-60 space-y-1 overflow-auto">
            {recordings.map((r) => (
              <button key={r.id} onClick={() => append(r.id)} className="flex w-full items-center justify-between rounded-lg bg-surface-elevated px-3 py-2 text-left text-xs active:scale-95">
                <span className="truncate font-semibold">{r.name}</span><span className="text-muted-foreground">{r.steps.length} steps → +1</span>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const STEP_HUES = ["var(--color-primary)", "var(--color-amber-glow)", "var(--color-success)", "var(--color-warning)"];

/** Editing-timeline style list of recordings in the side rail. */
type RailProps = {
  recordings: Recording[]; setRecordings: (r: Recording[]) => void; selectedFixtures: PatchedFixture[];
  playing: string | null; paused?: boolean; progress: { t: number; step: number } | null; waiting?: number | undefined; onGo?: () => void; onPlay: (id: string) => void; onPause: () => void; onStop: () => void;
};

/** Larger REC editing window, opened by pressing and holding the REC button. */
export function RecEditor({ open, onOpenChange, ...rail }: RailProps & { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader><DialogTitle>REC editor</DialogTitle></DialogHeader>
        <div className="space-y-2"><RecRail {...rail} large /></div>
      </DialogContent>
    </Dialog>
  );
}

export function RecRail({ recordings, setRecordings, selectedFixtures, playing, paused, progress, waiting, onGo, onPlay, onPause, onStop, large }: RailProps & { large?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const [stepOpen, setStepOpen] = useState<string | null>(null);
  const upd = (id: string, fn: (r: Recording) => Recording) => setRecordings(recordings.map((r) => (r.id === id ? fn(r) : r)));
  const updStep = (rid: string, sid: string, p: Partial<RecStep>) => upd(rid, (r) => ({ ...r, steps: r.steps.map((s) => (s.id === sid ? { ...s, ...p } : s)) }));
  const num = large ? "w-20 rounded border border-input bg-surface px-2 py-1.5 text-sm" : "w-14 rounded border border-input bg-surface px-1 py-1 text-[11px]";

  return (
    <>
      {!large && <p className="w-full shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:mt-3 lg:border-t lg:border-border lg:pt-3">REC</p>}
      {recordings.length === 0 && <p className="text-[11px] text-muted-foreground">Select lights and press REC to record.</p>}
      {recordings.map((r) => {
        const total = recLength(r) || 1;
        const isPlay = playing === r.id;
        return (
          <div key={r.id} className={`space-y-2 rounded-lg p-1.5 ${isPlay ? "bg-destructive/15 ring-1 ring-destructive" : "bg-surface-elevated"}`}>
            <div className="flex items-center gap-1">
              <button onClick={() => setOpen(open === r.id ? null : r.id)} aria-label={`Open ${r.name}`} className="p-1">{open === r.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">{r.name}</div>
                <div className="text-[10px] text-muted-foreground">{r.steps.length} cues · {recLength(r).toFixed(1)} s</div>
              </div>
              <button onClick={() => upd(r.id, (x) => ({ ...x, loop: !x.loop }))} aria-pressed={!!r.loop} title="Loop" className={`rounded p-1.5 ${r.loop ? "text-primary" : "text-muted-foreground"}`}><Repeat className="h-3.5 w-3.5" /></button>
              <button onClick={() => (isPlay && !paused ? onPause() : onPlay(r.id))} aria-label={isPlay && !paused ? `Pause ${r.name}` : `Play ${r.name}`} className="rounded-md bg-primary p-1.5 text-primary-foreground">
                {isPlay && !paused ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              {isPlay && waiting != null && <button onClick={onGo} title="Start the next cue" className="flex items-center gap-1 rounded-md bg-success px-2 py-1 text-[11px] font-black text-primary-foreground animate-pulse"><SkipForward className="h-3.5 w-3.5" />GO {waiting + 1}</button>}
              <button onClick={onStop} disabled={!isPlay} aria-label={`Stop ${r.name}`} className="rounded-md bg-destructive p-1.5 text-destructive-foreground disabled:opacity-30"><Square className="h-3.5 w-3.5" /></button>
              <ItemMenu name={r.name} onRename={(n) => upd(r.id, (x) => ({ ...x, name: n }))}
                onDuplicate={() => setRecordings([{ ...structuredClone(r), id: uid(), name: `${r.name} copy`, createdAt: Date.now() }, ...recordings])}
                onDelete={() => setRecordings(recordings.filter((x) => x.id !== r.id))} />
            </div>
            {/* timeline like an editing track: overlapping cues sit on a second lane and dissolve through their fades */}
            {(() => {
              const starts = stepStarts(r);
              const lanes = r.steps.some((s) => (s.overlap ?? 0) > 0);
              return (
                <div className={`relative overflow-hidden rounded bg-background ${large ? (lanes ? "h-20" : "h-12") : (lanes ? "h-10" : "h-6")}`}>
                  {r.steps.map((s, i) => {
                    const L = stepLength(s) || 0.0001;
                    const lane = lanes ? i % 2 : 0;
                    return (
                      <button key={s.id} onClick={() => { setOpen(r.id); setStepOpen(s.id); }} title={`${s.name}: in ${s.fadeIn}s · hold ${s.hold}s · out ${s.fadeOut}s${s.overlap ? ` · overlap ${s.overlap}s` : ""}`}
                        className={`absolute flex overflow-hidden rounded-sm border-r border-background text-[9px] font-bold text-primary-foreground ${isPlay && progress?.step === i ? "brightness-125" : "opacity-80"}`}
                        style={{ left: `${(starts[i]! / total) * 100}%`, width: `${(L / total) * 100}%`, top: lanes ? `${lane * 50}%` : 0, height: lanes ? "50%" : "100%", background: STEP_HUES[i % STEP_HUES.length] }}>
                        <span className="h-full bg-background/40" style={{ width: `${(s.fadeIn / L) * 100}%`, clipPath: "polygon(0 100%,100% 0,100% 100%)" }} />
                        <span className="flex flex-1 items-center truncate px-0.5">{s.manual && "✋"}{i + 1}{s.tweak && " ✎"}</span>
                        <span className="h-full bg-background/40" style={{ width: `${(s.fadeOut / L) * 100}%`, clipPath: "polygon(0 0,100% 100%,0 100%)" }} />
                      </button>
                    );
                  })}
                  {isPlay && progress && <span className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${Math.min(100, ((progress.t % total) / total) * 100)}%` }} />}
                </div>
              );
            })()}
            {open === r.id && (
              <div className="space-y-1.5">
                {r.steps.map((s, i) => (
                  <div key={s.id} className="rounded-md bg-surface p-1.5">
                    <div className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: STEP_HUES[i % STEP_HUES.length] }} />
                      <input value={s.name} onChange={(e) => updStep(r.id, s.id, { name: e.target.value })} className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold outline-none" aria-label="Cue name" />
                      <button disabled={i === 0} onClick={() => upd(r.id, (x) => { const st = [...x.steps]; [st[i - 1], st[i]] = [st[i]!, st[i - 1]!]; return { ...x, steps: st }; })} className="p-0.5 disabled:opacity-30" aria-label="Move cue up"><ArrowUp className="h-3 w-3" /></button>
                      <button disabled={i === r.steps.length - 1} onClick={() => upd(r.id, (x) => { const st = [...x.steps]; [st[i + 1], st[i]] = [st[i]!, st[i + 1]!]; return { ...x, steps: st }; })} className="p-0.5 disabled:opacity-30" aria-label="Move cue down"><ArrowDown className="h-3 w-3" /></button>
                      <button disabled={!selectedFixtures.length} title="Overwrite this cue with the selected lights" onClick={() => { const fresh = makeStep(selectedFixtures, 0).states; updStep(r.id, s.id, { states: [...s.states.filter((x) => !fresh.some((y) => y.uid === x.uid)), ...fresh] }); }} className="p-0.5 text-destructive disabled:opacity-30" aria-label="Re-record cue"><RefreshCw className="h-3 w-3" /></button>
                      <button onClick={() => { if (confirm(`Delete ${s.name}?`)) upd(r.id, (x) => ({ ...x, steps: x.steps.filter((y) => y.id !== s.id) })); }} className="p-0.5 text-muted-foreground" aria-label="Delete cue"><Trash2 className="h-3 w-3" /></button>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                      <label className="flex items-center gap-1">In<NumberField min={0} max={600} value={s.fadeIn} onChange={(v) => updStep(r.id, s.id, { fadeIn: v ?? 0 })} className={num} aria-label="Fade in seconds" /></label>
                      <label className="flex items-center gap-1">Hold<NumberField min={0} max={3600} value={s.hold} onChange={(v) => updStep(r.id, s.id, { hold: v ?? 0 })} className={num} aria-label="Hold seconds" /></label>
                      <label className="flex items-center gap-1">Out<NumberField min={0} max={600} value={s.fadeOut} onChange={(v) => updStep(r.id, s.id, { fadeOut: v ?? 0 })} className={num} aria-label="Fade out seconds" /></label>
                      {i > 0 && <button onClick={() => updStep(r.id, s.id, { manual: !s.manual })} aria-pressed={!!s.manual} title="Wait for GO — the previous cue stays on until you press GO"
                        className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold ${s.manual ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}><Hand className="h-3 w-3" />{s.manual ? "Wait GO" : "Auto"}</button>}
                    </div>
                    {i > 0 && <label className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground" title="Start this cue before the previous one ends — they dissolve into each other">Overlap
                      <NumberField min={0} max={600} value={s.overlap ?? 0} onChange={(v) => updStep(r.id, s.id, { overlap: v || undefined })} className={num} aria-label="Overlap seconds" />s</label>}
                    <TweakEditor tweak={s.tweak} onChange={(tweak) => updStep(r.id, s.id, { tweak })} hasPixels={!!s.pixels?.length} />
                    <button onClick={() => setStepOpen(stepOpen === s.id ? null : s.id)} className="mt-1 text-[10px] font-semibold text-primary">{stepOpen === s.id ? "Hide" : "Edit"} lights ({s.states.length})</button>
                    {stepOpen === s.id && s.states.map((x) => {
                      const set = (p: Partial<typeof x.state>) => updStep(r.id, s.id, { states: s.states.map((y) => (y.uid === x.uid ? { ...y, state: { ...y.state, ...p } } : y)) });
                      return (
                        <div key={x.uid} className="mt-1 space-y-1 rounded bg-surface-elevated p-1.5 text-[10px]">
                          <div className="flex items-center justify-between font-semibold"><span className="truncate">{x.name}</span>
                            <button onClick={() => updStep(r.id, s.id, { states: s.states.filter((y) => y.uid !== x.uid) })} className="text-muted-foreground" aria-label={`Remove ${x.name} from cue`}><Trash2 className="h-3 w-3" /></button></div>
                          <label className="flex items-center gap-1">Int<input type="range" min={0} max={1} step={0.01} value={x.state.intensity} onChange={(e) => set({ intensity: +e.target.value })} className="flex-1" /><span className="w-8 text-right">{Math.round(x.state.intensity * 100)}%</span></label>
                          <label className="flex items-center gap-1">CCT<input type="range" min={0} max={1} step={0.005} value={x.state.cct} onChange={(e) => set({ cct: +e.target.value })} className="flex-1" /><span className="w-10 text-right">{kelvin(x.state.cct)}K</span></label>
                          <label className="flex items-center gap-1">Hue<input type="range" min={0} max={360} step={1} value={x.state.hue} onChange={(e) => set({ hue: +e.target.value })} className="flex-1" /><span className="h-3 w-8 rounded-sm" style={{ background: `hsl(${x.state.hue} ${x.state.saturation * 100}% 50%)` }} /></label>
                          <label className="flex items-center gap-1">Sat<input type="range" min={0} max={1} step={0.01} value={x.state.saturation} onChange={(e) => set({ saturation: +e.target.value })} className="flex-1" /><span className="w-8 text-right">{Math.round(x.state.saturation * 100)}%</span></label>
                          <label className="flex items-center gap-1">CCT↔HSI<input type="range" min={0} max={1} step={0.01} value={x.state.crossfade ?? 0} onChange={(e) => set({ crossfade: +e.target.value })} className="flex-1" /></label>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

const TWEAKS: { k: keyof StepTweak; label: string; min: number; max: number; step: number; def: number; fmt: (v: number) => string }[] = [
  { k: "intensity", label: "Intensity", min: 0, max: 2, step: 0.01, def: 1, fmt: (v) => `${Math.round(v * 100)}%` },
  { k: "cct", label: "CCT shift", min: -0.5, max: 0.5, step: 0.005, def: 0, fmt: (v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}` },
  { k: "fxSpeed", label: "FX speed", min: 0.1, max: 4, step: 0.05, def: 1, fmt: (v) => `×${v.toFixed(2)}` },
  { k: "fxSize", label: "FX size", min: 0, max: 2, step: 0.05, def: 1, fmt: (v) => `×${v.toFixed(2)}` },
  { k: "pixelSpeed", label: "Pixel speed", min: 0.1, max: 4, step: 0.05, def: 1, fmt: (v) => `×${v.toFixed(2)}` },
];

/** Per-cue playback corrections, like grading a clip without re-recording it. */
function TweakEditor({ tweak, onChange, hasPixels }: { tweak?: StepTweak; onChange: (t: StepTweak | undefined) => void; hasPixels: boolean }) {
  const [open, setOpen] = useState(false);
  const set = (k: keyof StepTweak, v: number, def: number) => {
    const next = { ...tweak, [k]: v === def ? undefined : v };
    (Object.keys(next) as (keyof StepTweak)[]).forEach((x) => next[x] === undefined && delete next[x]);
    onChange(Object.keys(next).length ? next : undefined);
  };
  return (
    <div className="mt-1">
      <button onClick={() => setOpen(!open)} className="text-[10px] font-semibold text-primary">{open ? "Hide" : "Tweak"} cue{tweak ? " ✎" : ""}</button>
      {open && <div className="mt-1 space-y-1 rounded bg-surface-elevated p-1.5 text-[10px]">
        {TWEAKS.filter((t) => t.k !== "pixelSpeed" || hasPixels).map((t) => {
          const v = tweak?.[t.k] ?? t.def;
          return (
            <label key={t.k} className="flex items-center gap-1"><span className="w-16 shrink-0">{t.label}</span>
              <input type="range" min={t.min} max={t.max} step={t.step} value={v} onChange={(e) => set(t.k, +e.target.value, t.def)} onDoubleClick={() => set(t.k, t.def, t.def)} className="flex-1" aria-label={t.label} />
              <span className="w-10 text-right font-mono">{t.fmt(v)}</span></label>
          );
        })}
        {tweak && <button onClick={() => onChange(undefined)} className="text-[10px] text-muted-foreground underline">Reset tweaks</button>}
      </div>}
    </div>
  );
}
