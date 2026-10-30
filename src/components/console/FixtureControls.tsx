import { useState } from "react";
import { ChevronDown, Plus, Trash2, Zap, AlertTriangle, Play, Square, TrendingUp, Lock, Pencil } from "lucide-react";
import {
  caps,
  cctFromKelvin,
  cctRangeOf,
  type Curve,
  CURVES,
  DEFAULT_CCT,
  EFFECTS,
  fixtureColor,
  FX_PRESETS,
  type FxParams,
  fxRateAt,
  fxTime,
  getDef,
  getMode,
  hexToRgb,
  kelvin,
  overlaps,
  type PatchedFixture,
  sampleEffect,
  seedOf,
  type Step,
  type TriggerKind,
  TRIGGERS,
} from "@/lib/dmx";
import { ColorSource } from "./ColorSource";
import { ColourControls, HexColourControls } from "./ColourControls";
import { Button } from "@/components/ui/button";
import { PaletteEditor } from "./PaletteEditor";
import { SpeedControl } from "./SpeedControl";
import { hexToHs } from "@/lib/gels";
import { NumberField } from "./NumberField";
import { useClock } from "./PixelPanel";
import { BeamControls, beamChannels } from "./BeamControls";
import { IntensityMacros, FanControl, GelPicker } from "./AdvancedControls";

import { t as tr } from "@/lib/i18n";
export function Control({
  label, value, display, onChange, onReset, gradient, min = 0, max = 1, entry,
}: {
  label: string; value: number; display: string; onChange: (v: number) => void; onReset?: () => void; gradient?: string; min?: number; max?: number;
  /** makes the readout typeable: shows `text`, parses typed text back to a slider value */
  entry?: { text: string; suffix: string; parse: (n: number) => number };
}) {
  return (
    <div onDoubleClick={onReset} title={onReset ? "Double-tap to reset" : undefined}>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        {entry ? <EntryField label={label} entry={entry} onChange={onChange} /> : <span className="flex items-center gap-1 font-mono"><NumberField aria-label={`${label} value`} min={min * (display.endsWith("%") ? 100 : 1)} max={max * (display.endsWith("%") ? 100 : 1)} value={+(value * (display.endsWith("%") ? 100 : 1)).toFixed(2)} onChange={(n) => { if (n !== undefined) onChange(Math.max(min, Math.min(max, n / (display.endsWith("%") ? 100 : 1)))); }} className="w-16 rounded border border-input bg-surface-elevated px-1 py-0.5 text-right" />{display.endsWith("%") ? tr("%") : tr("")}</span>}
      </div>
      <input
        type="range" min={min} max={max} step={(max - min) / 10000} value={value}
        onChange={(e) => onChange(+e.target.value)}
        aria-label={`${label} slider`}
        className="w-full"
        style={gradient ? { "--fader-gradient": gradient } as React.CSSProperties : undefined}
      />
    </div>
  );
}

function EntryField({ entry, onChange, label }: { entry: { text: string; suffix: string; parse: (n: number) => number }; onChange: (v: number) => void; label: string }) {
  return <span className="flex items-center gap-0.5"><NumberField aria-label={`${label} value`} value={Number(entry.text)} onChange={(n) => { if (n !== undefined) onChange(entry.parse(n)); }} className="w-16 rounded border border-input bg-surface-elevated px-1 py-0.5 text-right font-mono text-xs" /><span className="font-mono">{entry.suffix}</span></span>;
}

// Double-tap support for touch screens (dblclick is unreliable on iPad)
let lastTap = 0;
const tapReset = (fn: () => void) => () => {
  const now = Date.now();
  if (now - lastTap < 300) fn();
  lastTap = now;
};

export function FixtureControls({
  fixtures, sel, update, updateEach, remove, fire, locked, onFlash,
}: {
  fixtures: PatchedFixture[];
  sel: PatchedFixture[];
  update: (patch: Partial<PatchedFixture>) => void;
  updateEach: (fn: (f: PatchedFixture) => Partial<PatchedFixture>) => void;
  locked: boolean;
  remove: () => void;
  fire: (k: TriggerKind) => void;
  onFlash: () => void;
}) {
  const first = sel[0];
  if (!first) return null;
  const mode = getMode(first);
  const anyCaps = sel.reduce(
    (a, f) => { const c = caps(getMode(f).kind); return { cct: a.cct || c.cct, gm: a.gm || c.gm, color: a.color || c.color }; },
    { cct: false, gm: false, color: false },
  );
  const fx = first.fx;
  const setFx = (p: Partial<FxParams>) => update({ fx: { ...fx, ...p } });
  const conflicts = sel.length === 1 ? overlaps(fixtures, first.universe, first.address, mode.channels, first.uid) : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {sel.length === 1 ? first.name : `${sel.length} fixtures`}
        </h2>
        <button onClick={remove} disabled={locked} title={locked ? "Unlock patch to remove" : "Remove"} className="disabled:opacity-30 text-muted-foreground hover:text-destructive" aria-label={tr("Remove")}><Trash2 className="h-4 w-4" /></button>
      </div>

      {sel.length === 1 && (
        <div className="rounded-xl border border-input/60 bg-surface-elevated/30 px-2.5 pb-1.5 pt-1">
          <div className="flex items-center gap-1.5">
            <Pencil className="h-3 w-3 shrink-0 text-muted-foreground/70" />
            <input
              value={first.name}
              aria-label={tr("Fixture name")}
              onChange={(e) => update({ name: e.target.value })}
              className="min-w-0 flex-1 border-b border-dashed border-input/70 bg-transparent py-0.5 text-sm font-semibold text-foreground outline-none hover:bg-input/30 focus:border-primary focus:bg-input/40"
            />
            <span className="text-[10px] font-bold text-primary/80">U</span>
            <NumberField aria-label={tr("Universe")} integer min={1} max={64} disabled={locked} value={first.universe} onChange={(v) => v && update({ universe: v })} className={`w-10 text-center ${locked ? "opacity-50" : ""}`} />
            <span className="text-[10px] font-bold text-primary/80">@</span>
            <NumberField aria-label={tr("Address")} integer min={1} max={512} disabled={locked} value={first.address} onChange={(v) => v && update({ address: v })} className={`w-12 text-center ${locked ? "opacity-50" : ""}`} />
            {locked && <span title={tr("Patch locked — unlock to edit")}><Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /></span>}
          </div>
          <p className="mt-1 truncate text-[10px] text-muted-foreground">{getDef(first.defId).brand} {getDef(first.defId).model} · {mode.name} · {mode.channels}{tr("ch")}</p>
          {conflicts.length > 0 && <p className="mt-1 flex items-center gap-1.5 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{tr("Overlaps")} {conflicts.map((c) => c.name).join(", ")}</p>}
        </div>
      )}


      <Control label={tr("Intensity")} value={first.intensity} display="" onChange={(v) => update({ intensity: v })}
        entry={{ text: String(+(first.intensity * 100).toFixed(2)), suffix: "%", parse: (n) => Math.min(1, Math.max(0, n / 100)) }} />
      <div className="flex gap-2">
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <button key={v} onClick={() => update({ intensity: v })} className="flex-1 rounded-md bg-surface-elevated py-2 text-xs font-semibold active:scale-95">{v * 100}</button>
        ))}
      </div>
      <IntensityMacros updateEach={updateEach} />

      <Section title={tr("CCT & Colour")}>
        {!anyCaps.color && <p className="rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">{tr("This fixture is patched in a CCT-only mode — colours and colour gels can't be shown. Change the mode in Patch (fixture ⋯ menu) to an HSI/RGB mode.")}</p>}
        <ColourControls value={first} update={update} range={cctRangeOf(first)} {...(anyCaps.gm ? { gm: first.gm, onGm: (gm: number) => update({ gm }) } : {})} />
        <GelPicker {...(first.gel ? { value: first.gel } : {})} update={update} range={cctRangeOf(first)} />
      </Section>

      {sel.some((f) => [...beamChannels(f).keys()].some((a) => a !== "Strobe")) && <Section title={tr("Position & Beam")}><BeamControls first={first} updateEach={updateEach} /></Section>}

      {<>{sel.some((f) => { const p = getMode(f).profile ?? ""; return p === "nanlux-evoke-cct" || p.startsWith("nanlux-dyno"); }) && <Section title={tr("Advanced")}>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{tr("Fan")}</div>
        <FanControl value={first.fan} update={update} />
      </Section>}

      <Section title={tr("Trigger")}>
        <div className="grid grid-cols-2 gap-2">
          {TRIGGERS.map((tr) => (
            <button key={tr.id} onClick={() => fire(tr.id)} className="flex items-center justify-center gap-1.5 rounded-md bg-surface-elevated py-3 text-xs font-bold active:scale-95 active:bg-amber-glow active:text-primary-foreground">
              <Zap className="h-3.5 w-3.5 text-amber-glow" />{tr.label}
            </button>
          ))}
        </div>
      </Section></>}

      {<Section title={tr("Effect")}>
        {fx.kind !== "none" && (
          <button onClick={() => update({ fxPlaying: first.fxPlaying === false })}
            className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold active:scale-95 ${first.fxPlaying === false ? "bg-amber-glow text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}>
            {first.fxPlaying === false ? <><Play className="h-4 w-4" />{tr("PLAY")}{fx.kind.toUpperCase()}</> : <><Square className="h-4 w-4" />{tr("STOP")}{fx.kind.toUpperCase()}</>}
          </button>
        )}
        <div className="grid grid-cols-4 gap-2">
          {EFFECTS.map((e) => (
            <button key={e.id} onClick={() => update({ fx: { ...fx, ...FX_PRESETS[e.id], kind: e.id }, fxPlaying: fx.kind === "none" ? false : sel.some((f) => f.fx.kind !== "none" && f.fxPlaying !== false) || first.fxPlaying !== false })} className={`rounded-md py-2.5 text-xs font-semibold active:scale-95 ${fx.kind === e.id ? "bg-amber-glow text-primary-foreground" : "bg-surface-elevated"}`}>
              {e.label}
            </button>
          ))}
        </div>
        {fx.kind !== "none" && <>
          {first.fxPlaying === false && <p className="text-[11px] text-amber-glow">{tr("Armed — watch the preview, then press PLAY to send it to the")}{sel.length}{tr("selected light")}{sel.length > 1 ? tr("s") : tr("")}.</p>}
          <EffectEditor fx={fx} setFx={setFx} seed={seedOf(first.uid)} colour={fixtureColor({ ...first, intensity: 1, on: true, fx: { ...first.fx, kind: "none" } }, 0)} />
          <details open className="border-t border-border pt-3"><summary className="mb-3 cursor-pointer text-xs font-semibold text-muted-foreground">{tr("Effect colours")}</summary>
            <PaletteEditor colours={fx.colors ?? []} onChange={(colors) => setFx({ colors })} onReset={() => setFx({ colors: [] })} />
          </details>
        </>}
      </Section>}
    </div>
  );
}

function EffectEditor({ fx, setFx, seed = 0.3, colour = "var(--color-amber-glow)" }: { fx: FxParams; setFx: (p: Partial<FxParams>) => void; seed?: number; colour?: string }) {
  const now = useClock();
  const periodic = fx.kind === "pulse" || fx.kind === "strobe";
  const W = 300, H = 60;
  const secs = fx.kind === "steps" ? fx.steps.reduce((sum, step) => sum + step.hold + step.fade, 0) / fx.rate : 3 / fx.rate;
  // same absolute time + per-light seed as the real output, so graph and preview match the light
  const winStart = Math.floor(now / secs) * secs;
  const pts = Array.from({ length: 300 }, (_, i) => {
    const t = winStart + (i / 299) * secs;
    return `${(i / 299) * W},${H - sampleEffect(fx, t, seed) * H}`;
  }).join(" ");
  const live = sampleEffect(fx, now, seed);

  // effect colours: the palette while it cycles, the fixture colour otherwise — same maths as the real output
  const cols = fx.colors?.length ? fx.colors : [colour];
  let liveColour = colour;
  if (fx.colors?.length) {
    const phase = ((fxTime(fx, now) * fx.rate % fx.colors.length) + fx.colors.length) % fx.colors.length;
    const index = Math.floor(phase);
    const a = hexToRgb(fx.colors[index] ?? "#ffffff");
    const next = hexToRgb(fx.colors[(index + 1) % fx.colors.length] ?? "#ffffff");
    liveColour = `rgb(${a.map((v, i) => Math.round(v + ((next[i] ?? v) - v) * (phase - index))).join(",")})`;
  }
  const gradId = `fx-grad-${seed}`;

  return (
    <div className="space-y-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full rounded-md bg-surface-elevated" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2={cols.length > 1 ? "1" : "0"} y2="0">
            {cols.map((c, i) => <stop key={i} offset={`${(i / Math.max(1, cols.length - 1)) * 100}%`} stopColor={c} />)}
          </linearGradient>
        </defs>
        <polyline points={pts} fill="none" stroke={`url(#${gradId})`} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <line x1={((now - winStart) / secs) * W} x2={((now - winStart) / secs) * W} y1={0} y2={H} stroke="var(--color-primary)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{tr("Preview")}</span>
        <div className="h-5 flex-1 rounded" style={{ background: cols.length > 1 ? `linear-gradient(90deg, ${cols.join(", ")})` : colour, opacity: Math.max(0.03, live) }} />
        <span className="h-5 w-5 rounded ring-1 ring-border" style={{ background: liveColour }} aria-label={tr("Current effect colour")} />
        <span className="w-10 text-right font-mono">{Math.round(live * 100)}%</span>
      </div>

      <SpeedControl
        label={fx.kind === "steps" ? "Speed" : fx.kind === "lightning" ? "Strike rate" : "Rate"}
        value={fx.rate}
        unit={fx.kind === "steps" ? "×" : "Hz"}
        onChange={(rate) => setFx({ rate })}
      />
      <div className="space-y-2 rounded-md bg-surface-elevated p-2">
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" checked={fx.rampTo != null} onChange={(e) => setFx(e.target.checked ? { rampTo: fx.rate * 3, rampTime: 4 } : { rampTo: undefined, rampTime: undefined })} />{tr("Speed ramp")}{fx.rampTo != null && <span className="ml-auto font-mono text-[10px] text-muted-foreground">{tr("now")}{fxRateAt(fx, now).toFixed(2)}{fx.kind === "steps" ? tr("×") : tr(" Hz")}</span>}
        </label>
        {fx.rampTo != null && <>
          <SpeedControl label={tr("Ramp to")} value={fx.rampTo} unit={fx.kind === "steps" ? "×" : "Hz"} onChange={(rampTo) => setFx({ rampTo })} />
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">{tr("Ramp time")}<input type="range" min={0.5} max={60} step={0.5} value={fx.rampTime ?? 4} onChange={(e) => setFx({ rampTime: +e.target.value })} className="flex-1" aria-label={tr("Ramp time seconds")} />
            <span className="w-10 text-right font-mono">{fx.rampTime ?? 4}{tr("s")}</span></label>
          <p className="text-[10px] text-muted-foreground">{tr("Speeds up gradually to the target, then slows back down, and repeats.")}</p>
        </>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Control label={tr("Low")} value={fx.min} display="" entry={{ text: String(+(fx.min * 100).toFixed(2)), suffix: "%", parse: (n) => Math.min(fx.max, Math.max(0, n / 100)) }} onChange={(v) => setFx({ min: Math.min(fx.max, v) })} />
        <Control label={tr("High")} value={fx.max} display="" entry={{ text: String(+(fx.max * 100).toFixed(2)), suffix: "%", parse: (n) => Math.max(fx.min, Math.min(1, n / 100)) }} onChange={(v) => setFx({ max: Math.max(fx.min, v) })} />
      </div>
      {periodic && (
        <>
          <Control label={tr("On time (gap)")} value={fx.duty} display="" entry={{ text: String(+(fx.duty * 100).toFixed(2)), suffix: "%", parse: (n) => Math.max(0.001, Math.min(1, n / 100)) }} onChange={(v) => setFx({ duty: Math.max(0.001, v) })} />
          <div className="flex justify-between font-mono text-[10px] text-muted-foreground"><span>{tr("On:")}{+(fx.duty / fx.rate * 1000).toFixed(2)}{tr("ms")}</span><span>{tr("Gap:")}{+((1 - fx.duty) / fx.rate * 1000).toFixed(2)}{tr("ms")}</span></div>
          <div className="grid grid-cols-2 gap-3">
            <Control label={tr("Attack")} value={fx.attack} display="" entry={{ text: String(+(fx.attack * 100).toFixed(2)), suffix: "%", parse: (n) => Math.max(0, Math.min(1, n / 100)) }} onChange={(v) => setFx({ attack: v })} />
            <Control label={tr("Release")} value={fx.release} display="" entry={{ text: String(+(fx.release * 100).toFixed(2)), suffix: "%", parse: (n) => Math.max(0, Math.min(1, n / 100)) }} onChange={(v) => setFx({ release: v })} />
          </div>
        </>
      )}
      {fx.kind !== "steps" && <Control label={tr("Irregularity")} value={fx.random} display={`${Math.round(fx.random * 100)}%`} onChange={(v) => setFx({ random: v })} />}

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr("Curve")}</div>
        <div className="grid grid-cols-5 gap-1.5">
          {CURVES.map((c) => (
            <button key={c.id} onClick={() => setFx({
              curve: c.id,
              // a curve only shapes fades: give hard-edged pulses some attack/release and let steps follow the global curve
              ...(periodic && fx.attack === 0 && fx.release === 0 ? { attack: 0.3, release: 0.3 } : {}),
              ...(fx.kind === "steps" ? { steps: fx.steps.map(({ curve: _c, ...st }) => st) } : {}),
            })} className={`rounded-md px-1 py-2 text-[10px] font-semibold ${fx.curve === c.id ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>{c.label}</button>
          ))}
        </div>
      </div>

      {fx.kind === "steps" && <StepsEditor fx={fx} setFx={setFx} />}
    </div>
  );
}

function StepsEditor({ fx, setFx }: { fx: FxParams; setFx: (p: Partial<FxParams>) => void }) {
  const set = (i: number, p: Partial<Step>) => setFx({ steps: fx.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const [ramp, setRamp] = useState({ from: 20, to: 100, secs: 3, k1: 3200, k2: 5600, c1: "", c2: "", hold: 1 });
  const num = "w-full rounded-md border border-input bg-surface px-2 py-1.5 text-xs";
  const buildRamp = () => setFx({
    steps: [
      { level: ramp.from / 100, fade: 0, hold: ramp.hold, ...(ramp.c1 ? { color: ramp.c1 } : { kelvin: ramp.k1 }) },
      { level: ramp.to / 100, fade: ramp.secs, hold: ramp.hold, ...(ramp.c2 ? { color: ramp.c2 } : { kelvin: ramp.k2 }), curve: "linear" },
    ],
    min: 0, max: 1, rate: 1,
  });
  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-lg border border-border p-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground"><TrendingUp className="h-3.5 w-3.5 text-amber-glow" />{tr("Quick ramp")}</div>
        <div className="grid grid-cols-3 gap-1.5 text-[10px] uppercase text-muted-foreground">
          <label>{tr("From %")}<NumberField value={ramp.from} min={0} max={100} onChange={(v) => setRamp({ ...ramp, from: v ?? 0 })} className={num} /></label>
          <label>{tr("To %")}<NumberField value={ramp.to} min={0} max={100} onChange={(v) => setRamp({ ...ramp, to: v ?? 0 })} className={num} /></label>
          <label>{tr("Over s")}<NumberField value={ramp.secs} min={0} onChange={(v) => setRamp({ ...ramp, secs: v ?? 0 })} className={num} /></label>
          <label>{tr("Start K")}<NumberField integer value={ramp.k1} min={2000} max={10000} onChange={(v) => setRamp({ ...ramp, k1: v ?? 3200 })} className={num} /></label>
          <label>{tr("End K")}<NumberField integer value={ramp.k2} min={2000} max={10000} onChange={(v) => setRamp({ ...ramp, k2: v ?? 5600 })} className={num} /></label>
          <label>{tr("Hold s")}<NumberField value={ramp.hold} min={0} onChange={(v) => setRamp({ ...ramp, hold: v ?? 0 })} className={num} /></label>
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase text-muted-foreground">
          <span>{tr("or colours")}</span>
          <ColorPick value={ramp.c1} onChange={(c) => setRamp({ ...ramp, c1: c })} />→
          <ColorPick value={ramp.c2} onChange={(c) => setRamp({ ...ramp, c2: c })} />
          <button onClick={buildRamp} className="ml-auto rounded-md bg-amber-glow px-3 py-1.5 text-[11px] font-bold text-primary-foreground">{tr("Build")}</button>
        </div>
      </div>

      {fx.steps.map((s, i) => (
        <div key={i} className="space-y-1.5 rounded-lg bg-surface-elevated p-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-amber-glow">{tr("Step")}{i + 1}</span>
            <button onClick={() => setFx({ steps: fx.steps.filter((_, j) => j !== i) })} disabled={fx.steps.length <= 1} className="text-muted-foreground hover:text-destructive disabled:opacity-30" aria-label={tr("Remove step")}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[10px] uppercase text-muted-foreground">
            <label>{tr("Level %")}<NumberField min={0} max={100} value={Math.round(s.level * 100)} onChange={(v) => set(i, { level: (v ?? 0) / 100 })} className={num} /></label>
            <label>{tr("Fade in s")}<NumberField min={0} value={s.fade} onChange={(v) => set(i, { fade: v ?? 0 })} className={num} /></label>
            <label>{tr("Hold s")}<NumberField min={0} value={s.hold} onChange={(v) => set(i, { hold: v ?? 0 })} className={num} /></label>
            <label>{tr("Kelvin")}<NumberField integer allowEmpty placeholder="—" min={2000} max={10000} value={s.kelvin} onChange={(v) => set(i, { kelvin: v })} className={num} /></label>
            <div>{tr("Colour")}<div className="mt-0.5"><ColorPick value={s.color ?? ""} onChange={(c) => set(i, { color: c || undefined })} /></div></div>
            <label>{tr("Curve")}<select value={s.curve ?? ""} onChange={(e) => set(i, { curve: (e.target.value || undefined) as Curve | undefined })} className={num}>
                <option value="">{tr("Default")}</option>
                {CURVES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
          </div>
          <HexColourControls value={s.color ?? "#ffffff"} onChange={(color) => set(i, { color, kelvin: undefined })} />
          <ColorSource noCct compact onPick={(hex, lbl) => (lbl.endsWith("K") ? set(i, { kelvin: parseInt(lbl, 10), color: undefined }) : set(i, { color: hex, kelvin: undefined }))} />
        </div>
      ))}
      <button onClick={() => setFx({ steps: [...fx.steps, { level: 1, fade: 0.5, hold: 0.5 }] })} className="flex w-full items-center justify-center gap-1.5 rounded-md bg-surface-elevated py-2 text-xs font-semibold"><Plus className="h-3.5 w-3.5" />{tr("Add step")}</button>
      <p className="text-[10px] text-muted-foreground">{tr("Each step fades from the previous one. Set Kelvin or Colour to change colour while the level moves.")}</p>
    </div>
  );
}

function ColorPick({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      <input type="color" value={value || "#ffffff"} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-input bg-transparent" />
      {value && <button onClick={(e) => { e.preventDefault(); onChange(""); }} className="text-[10px] text-muted-foreground">✕</button>}
    </span>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
        {title}
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && children}
    </div>
  );
}
