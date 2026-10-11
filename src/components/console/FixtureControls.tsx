import { useState } from "react";
import { Plus, Trash2, Zap, AlertTriangle, Play, Square, Power, TrendingUp } from "lucide-react";
import {
  CURVES,
  DEFAULT_CCT,
  EFFECTS,
  FX_PRESETS,
  TRIGGERS,
  caps,
  getDef,
  getMode,
  kelvin,
  cctFromKelvin,
  overlaps,
  sampleEffect,
  type FxParams,
  type Curve,
  type Step,
  type PatchedFixture,
  type TriggerKind,
} from "@/lib/dmx";
import { ColorSource } from "./ColorSource";
import { ColourControls, HexColourControls } from "./ColourControls";
import { SavedEffects } from "./SavedEffects";
import { useFxLibrary } from "@/lib/fxlib";
import { Button } from "@/components/ui/button";
import { PaletteEditor } from "./PaletteEditor";
import { SettingsTransfer } from "./SettingsTransfer";
import { SpeedControl } from "./SpeedControl";
import { hexToHs } from "@/lib/gels";
import { IntensityMacros, GmMacros, FanControl, GelPicker } from "./AdvancedControls";

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
        {entry ? <EntryField entry={entry} onChange={onChange} /> : <span className="font-mono">{display}</span>}
      </div>
      <input
        type="range" min={min} max={max} step={(max - min) / 400} value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="h-2 w-full cursor-pointer appearance-none rounded-full accent-[var(--color-primary)]"
        style={{ background: gradient ?? "var(--color-surface-elevated)" }}
      />
    </div>
  );
}

function EntryField({ entry, onChange }: { entry: { text: string; suffix: string; parse: (n: number) => number }; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => { if (draft !== null) { const n = parseFloat(draft.replace(",", ".")); if (Number.isFinite(n)) onChange(entry.parse(n)); } setDraft(null); };
  return (
    <span className="flex items-center gap-0.5">
      <input inputMode="decimal" value={draft ?? entry.text} onFocus={(e) => { setDraft(entry.text); e.target.select(); }}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d.,]/g, ""))} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="w-16 rounded border border-input bg-surface-elevated px-1 py-0.5 text-right font-mono text-xs" aria-label="Type value" />
      <span className="font-mono">{entry.suffix}</span>
    </span>
  );
}

// Double-tap support for touch screens (dblclick is unreliable on iPad)
let lastTap = 0;
const tapReset = (fn: () => void) => () => {
  const now = Date.now();
  if (now - lastTap < 300) fn();
  lastTap = now;
};

export function FixtureControls({
  fixtures, sel, update, updateEach, remove, fire, locked, copiedSource, onCopy, onPaste,
}: {
  fixtures: PatchedFixture[];
  sel: PatchedFixture[];
  update: (patch: Partial<PatchedFixture>) => void;
  updateEach: (fn: (f: PatchedFixture) => Partial<PatchedFixture>) => void;
  locked: boolean;
  remove: () => void;
  fire: (k: TriggerKind) => void;
  copiedSource?: string | undefined;
  onCopy: () => void;
  onPaste: () => void;
}) {
  const first = sel[0];
  const fxLib = useFxLibrary();
  const [tab, setTab] = useState<"colour" | "effect" | "advanced">("colour");
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
        <button onClick={remove} disabled={locked} title={locked ? "Unlock patch to remove" : "Remove"} className="disabled:opacity-30 text-muted-foreground hover:text-destructive" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
      </div>

      <SettingsTransfer source={copiedSource} canCopy={sel.length > 0} onCopy={onCopy} onPaste={onPaste} />

      {sel.length === 1 && (
        <div className="space-y-2">
          <input value={first.name} onChange={(e) => update({ name: e.target.value })} className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2 text-[10px] uppercase text-muted-foreground">
            <label>Universe<input type="number" min={1} max={64} disabled={locked} value={first.universe} onChange={(e) => update({ universe: Math.max(1, +e.target.value || 1) })} className="mt-1 w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground" /></label>
            <label>Address<input type="number" min={1} max={512} disabled={locked} value={first.address} onChange={(e) => update({ address: Math.min(512, Math.max(1, +e.target.value || 1)) })} className="mt-1 w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground" /></label>
          </div>
          {locked && <p className="text-[10px] text-muted-foreground">🔒 Patch locked — unlock in the top bar to change address.</p>}
          <p className="text-[11px] text-muted-foreground">{getDef(first.defId).brand} {getDef(first.defId).model} · {mode.name} · {mode.channels} ch</p>
          {conflicts.length > 0 && <p className="flex gap-1.5 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" />Overlaps {conflicts.map((c) => c.name).join(", ")}</p>}
        </div>
      )}

      <button onClick={() => update({ on: first.on === false })}
        className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold active:scale-95 ${first.on === false ? "bg-surface-elevated text-muted-foreground" : "bg-success text-primary-foreground"}`}>
        <Power className="h-4 w-4" /> {first.on === false ? "OFF — tap to turn on" : "ON — tap to turn off"}
      </button>

      <Control label="Intensity" value={first.intensity} display="" onChange={(v) => update({ intensity: v })}
        entry={{ text: String(+(first.intensity * 100).toFixed(2)), suffix: "%", parse: (n) => Math.min(1, Math.max(0, n / 100)) }} />
      <div className="flex gap-2">
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <button key={v} onClick={() => update({ intensity: v })} className="flex-1 rounded-md bg-surface-elevated py-2 text-xs font-semibold active:scale-95">{v * 100}</button>
        ))}
      </div>
      <IntensityMacros updateEach={updateEach} />

      <div className="grid grid-cols-3 gap-1 border-b border-border pb-3" role="tablist" aria-label="Light controls">
        {([['colour','Colour'],['effect','Effects'],['advanced','Advanced']] as const).map(([id,label]) => <Button key={id} size="sm" variant={tab === id ? "default" : "secondary"} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</Button>)}
      </div>

      {tab === "colour" && <Section title="Colour">
        {!anyCaps.color && <p className="rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">This fixture is patched in a CCT-only mode — colours and colour gels can't be shown. Change the mode in Patch (fixture ⋯ menu) to an HSI/RGB mode.</p>}
        <ColourControls value={first} update={update} />
        {anyCaps.gm && <><Control label="Green / Magenta" min={-1} max={1} value={first.gm} display={first.gm.toFixed(2)} onChange={(gm) => update({ gm })} onReset={() => update({ gm: 0 })} /><GmMacros value={first.gm} update={update} /></>}
        <GelPicker {...(first.gel ? { value: first.gel } : {})} update={update} />
      </Section>}

      {tab === "advanced" && <><Section title="Advanced">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Fan</div>
        <FanControl value={first.fan} update={update} />
      </Section>

      <Section title="Trigger">
        <div className="grid grid-cols-2 gap-2">
          {TRIGGERS.map((tr) => (
            <button key={tr.id} onClick={() => fire(tr.id)} className="flex items-center justify-center gap-1.5 rounded-md bg-surface-elevated py-3 text-xs font-bold active:scale-95 active:bg-amber-glow active:text-primary-foreground">
              <Zap className="h-3.5 w-3.5 text-amber-glow" />{tr.label}
            </button>
          ))}
        </div>
      </Section></>}

      {tab === "effect" && <Section title="Effect">
        {fx.kind !== "none" && (
          <button onClick={() => update({ fxPlaying: first.fxPlaying === false })}
            className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold active:scale-95 ${first.fxPlaying === false ? "bg-amber-glow text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}>
            {first.fxPlaying === false ? <><Play className="h-4 w-4" /> PLAY {fx.kind.toUpperCase()}</> : <><Square className="h-4 w-4" /> STOP {fx.kind.toUpperCase()}</>}
          </button>
        )}
        <div className="grid grid-cols-4 gap-2">
          {EFFECTS.map((e) => (
            <button key={e.id} onClick={() => update({ fx: { ...fx, ...FX_PRESETS[e.id], kind: e.id }, fxPlaying: true })} className={`rounded-md py-2.5 text-xs font-semibold active:scale-95 ${fx.kind === e.id ? "bg-amber-glow text-primary-foreground" : "bg-surface-elevated"}`}>
              {e.label}
            </button>
          ))}
        </div>
        {fx.kind !== "none" && <>
          <EffectEditor fx={fx} setFx={setFx} />
          <details open className="border-t border-border pt-3"><summary className="mb-3 cursor-pointer text-xs font-semibold text-muted-foreground">Effect colours</summary>
            <PaletteEditor colours={fx.colors ?? []} onChange={(colors) => setFx({ colors })} onReset={() => setFx({ colors: [] })} />
          </details>
          {!fx.colors?.length && <ColourControls value={first} update={update} />}
        </>}
        <SavedEffects label="My effects" items={fxLib.lib.fx} onSave={(n) => fxLib.saveFx(n, fx)} onDelete={(id) => fxLib.remove("fx", id)}
          onLoad={(it) => update({ fx: structuredClone(it.fx), fxPlaying: true })} />
      </Section>}
    </div>
  );
}

function EffectEditor({ fx, setFx }: { fx: FxParams; setFx: (p: Partial<FxParams>) => void }) {
  const periodic = fx.kind === "pulse" || fx.kind === "strobe";
  const W = 300, H = 60;
  const secs = fx.kind === "steps" ? fx.steps.reduce((sum, step) => sum + step.hold + step.fade, 0) / fx.rate : 3 / fx.rate;
  const pts = Array.from({ length: 200 }, (_, i) => {
    const t = (i / 199) * secs;
    return `${(i / 199) * W},${H - sampleEffect(fx, t) * H}`;
  }).join(" ");

  return (
    <div className="space-y-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full rounded-md bg-surface-elevated" preserveAspectRatio="none">
        <polyline points={pts} fill="none" stroke="var(--color-amber-glow)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>

      <SpeedControl
        label={fx.kind === "steps" ? "Speed" : fx.kind === "lightning" ? "Strike rate" : "Rate"}
        value={fx.rate}
        unit={fx.kind === "steps" ? "×" : "Hz"}
        onChange={(rate) => setFx({ rate })}
      />
      <div className="grid grid-cols-2 gap-3">
        <Control label="Low" value={fx.min} display="" entry={{ text: String(+(fx.min * 100).toFixed(2)), suffix: "%", parse: (n) => Math.min(fx.max, Math.max(0, n / 100)) }} onChange={(v) => setFx({ min: Math.min(fx.max, v) })} />
        <Control label="High" value={fx.max} display="" entry={{ text: String(+(fx.max * 100).toFixed(2)), suffix: "%", parse: (n) => Math.max(fx.min, Math.min(1, n / 100)) }} onChange={(v) => setFx({ max: Math.max(fx.min, v) })} />
      </div>
      {periodic && (
        <>
          <Control label="On time (gap)" value={fx.duty} display="" entry={{ text: String(+(fx.duty * 100).toFixed(2)), suffix: "%", parse: (n) => Math.max(0.001, Math.min(1, n / 100)) }} onChange={(v) => setFx({ duty: Math.max(0.001, v) })} />
          <div className="flex justify-between font-mono text-[10px] text-muted-foreground"><span>On: {+(fx.duty / fx.rate * 1000).toFixed(2)} ms</span><span>Gap: {+((1 - fx.duty) / fx.rate * 1000).toFixed(2)} ms</span></div>
          <div className="grid grid-cols-2 gap-3">
            <Control label="Attack" value={fx.attack} display="" entry={{ text: String(+(fx.attack * 100).toFixed(2)), suffix: "%", parse: (n) => Math.max(0, Math.min(1, n / 100)) }} onChange={(v) => setFx({ attack: v })} />
            <Control label="Release" value={fx.release} display="" entry={{ text: String(+(fx.release * 100).toFixed(2)), suffix: "%", parse: (n) => Math.max(0, Math.min(1, n / 100)) }} onChange={(v) => setFx({ release: v })} />
          </div>
        </>
      )}
      {fx.kind !== "steps" && <Control label="Irregularity" value={fx.random} display={`${Math.round(fx.random * 100)}%`} onChange={(v) => setFx({ random: v })} />}

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Curve</div>
        <div className="grid grid-cols-5 gap-1.5">
          {CURVES.map((c) => (
            <button key={c.id} onClick={() => setFx({ curve: c.id })} className={`rounded-md px-1 py-2 text-[10px] font-semibold ${fx.curve === c.id ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>{c.label}</button>
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
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground"><TrendingUp className="h-3.5 w-3.5 text-amber-glow" />Quick ramp</div>
        <div className="grid grid-cols-3 gap-1.5 text-[10px] uppercase text-muted-foreground">
          <label>From %<input type="number" value={ramp.from} onChange={(e) => setRamp({ ...ramp, from: +e.target.value })} className={num} /></label>
          <label>To %<input type="number" value={ramp.to} onChange={(e) => setRamp({ ...ramp, to: +e.target.value })} className={num} /></label>
          <label>Over s<input type="number" step={0.1} value={ramp.secs} onChange={(e) => setRamp({ ...ramp, secs: Math.max(0, +e.target.value) })} className={num} /></label>
          <label>Start K<input type="number" step={100} value={ramp.k1} onChange={(e) => setRamp({ ...ramp, k1: +e.target.value })} className={num} /></label>
          <label>End K<input type="number" step={100} value={ramp.k2} onChange={(e) => setRamp({ ...ramp, k2: +e.target.value })} className={num} /></label>
          <label>Hold s<input type="number" step={0.1} value={ramp.hold} onChange={(e) => setRamp({ ...ramp, hold: Math.max(0, +e.target.value) })} className={num} /></label>
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase text-muted-foreground">
          <span>or colours</span>
          <ColorPick value={ramp.c1} onChange={(c) => setRamp({ ...ramp, c1: c })} />→
          <ColorPick value={ramp.c2} onChange={(c) => setRamp({ ...ramp, c2: c })} />
          <button onClick={buildRamp} className="ml-auto rounded-md bg-amber-glow px-3 py-1.5 text-[11px] font-bold text-primary-foreground">Build</button>
        </div>
      </div>

      {fx.steps.map((s, i) => (
        <div key={i} className="space-y-1.5 rounded-lg bg-surface-elevated p-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-amber-glow">Step {i + 1}</span>
            <button onClick={() => setFx({ steps: fx.steps.filter((_, j) => j !== i) })} disabled={fx.steps.length <= 1} className="text-muted-foreground hover:text-destructive disabled:opacity-30" aria-label="Remove step"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[10px] uppercase text-muted-foreground">
            <label>Level %<input type="number" min={0} max={100} value={Math.round(s.level * 100)} onChange={(e) => set(i, { level: Math.min(1, Math.max(0, +e.target.value / 100)) })} className={num} /></label>
            <label>Fade in s<input type="number" min={0} step={0.05} value={s.fade} onChange={(e) => set(i, { fade: Math.max(0, +e.target.value) })} className={num} /></label>
            <label>Hold s<input type="number" min={0} step={0.05} value={s.hold} onChange={(e) => set(i, { hold: Math.max(0, +e.target.value) })} className={num} /></label>
            <label>Kelvin<input type="number" step={100} placeholder="—" value={s.kelvin ?? ""} onChange={(e) => set(i, { kelvin: e.target.value ? Math.min(10000, Math.max(2000, +e.target.value)) : undefined })} className={num} /></label>
            <div>Colour<div className="mt-0.5"><ColorPick value={s.color ?? ""} onChange={(c) => set(i, { color: c || undefined })} /></div></div>
            <label>Curve
              <select value={s.curve ?? ""} onChange={(e) => set(i, { curve: (e.target.value || undefined) as Curve | undefined })} className={num}>
                <option value="">Default</option>
                {CURVES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
          </div>
          <HexColourControls value={s.color ?? "#ffffff"} onChange={(color) => set(i, { color, kelvin: undefined })} />
          <ColorSource compact onPick={(hex, lbl) => (lbl.endsWith("K") ? set(i, { kelvin: parseInt(lbl, 10), color: undefined }) : set(i, { color: hex, kelvin: undefined }))} />
        </div>
      ))}
      <button onClick={() => setFx({ steps: [...fx.steps, { level: 1, fade: 0.5, hold: 0.5 }] })} className="flex w-full items-center justify-center gap-1.5 rounded-md bg-surface-elevated py-2 text-xs font-semibold"><Plus className="h-3.5 w-3.5" />Add step</button>
      <p className="text-[10px] text-muted-foreground">Each step fades from the previous one. Set Kelvin or Colour to change colour while the level moves.</p>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
