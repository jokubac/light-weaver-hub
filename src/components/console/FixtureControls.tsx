import { Plus, Trash2, Zap, AlertTriangle } from "lucide-react";
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
  overlaps,
  sampleEffect,
  type FxParams,
  type PatchedFixture,
  type TriggerKind,
} from "@/lib/dmx";

export function Control({
  label, value, display, onChange, onReset, gradient, min = 0, max = 1,
}: {
  label: string; value: number; display: string; onChange: (v: number) => void; onReset?: () => void; gradient?: string; min?: number; max?: number;
}) {
  return (
    <div onDoubleClick={onReset} title={onReset ? "Double-tap to reset" : undefined}>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="font-mono">{display}</span>
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

// Double-tap support for touch screens (dblclick is unreliable on iPad)
let lastTap = 0;
const tapReset = (fn: () => void) => () => {
  const now = Date.now();
  if (now - lastTap < 300) fn();
  lastTap = now;
};

const rateToSlider = (r: number) => Math.log(r / 0.05) / Math.log(400);
const sliderToRate = (v: number) => 0.05 * Math.pow(400, v);

export function FixtureControls({
  fixtures, sel, update, remove, fire,
}: {
  fixtures: PatchedFixture[];
  sel: PatchedFixture[];
  update: (patch: Partial<PatchedFixture>) => void;
  remove: () => void;
  fire: (k: TriggerKind) => void;
}) {
  const first = sel[0]!;
  const mode = getMode(first);
  const anyCaps = sel.reduce(
    (a, f) => { const c = caps(getMode(f).kind); return { cct: a.cct || c.cct, gm: a.gm || c.gm, color: a.color || c.color }; },
    { cct: false, gm: false, color: false },
  );
  const fx = first.fx;
  const setFx = (p: Partial<FxParams>) => update({ fx: { ...fx, ...p } });
  const conflicts = sel.length === 1 ? overlaps(fixtures, first.universe, first.address, mode.channels, first.uid) : [];
  const showHsi = anyCaps.color && !first.cctOnly;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {sel.length === 1 ? first.name : `${sel.length} fixtures`}
        </h2>
        <button onClick={remove} className="text-muted-foreground hover:text-destructive" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
      </div>

      {sel.length === 1 && (
        <div className="space-y-2">
          <input value={first.name} onChange={(e) => update({ name: e.target.value })} className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2 text-[10px] uppercase text-muted-foreground">
            <label>Universe<input type="number" min={1} max={64} value={first.universe} onChange={(e) => update({ universe: Math.max(1, +e.target.value || 1) })} className="mt-1 w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground" /></label>
            <label>Address<input type="number" min={1} max={512} value={first.address} onChange={(e) => update({ address: Math.min(512, Math.max(1, +e.target.value || 1)) })} className="mt-1 w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground" /></label>
          </div>
          <p className="text-[11px] text-muted-foreground">{getDef(first.defId).brand} {getDef(first.defId).model} · {mode.name} · {mode.channels} ch</p>
          {conflicts.length > 0 && <p className="flex gap-1.5 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" />Overlaps {conflicts.map((c) => c.name).join(", ")}</p>}
        </div>
      )}

      <Control label="Intensity" value={first.intensity} display={`${Math.round(first.intensity * 100)}%`} onChange={(v) => update({ intensity: v })} />
      <div className="flex gap-2">
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <button key={v} onClick={() => update({ intensity: v })} className="flex-1 rounded-md bg-surface-elevated py-2 text-xs font-semibold active:scale-95">{v * 100}</button>
        ))}
      </div>

      {(anyCaps.cct || anyCaps.gm || anyCaps.color) && (
        <Section title="Colour corrections">
          {anyCaps.color && (
            <label className="flex items-center justify-between rounded-md bg-surface-elevated px-3 py-2 text-xs font-semibold">
              CCT only
              <input type="checkbox" checked={first.cctOnly} onChange={(e) => update({ cctOnly: e.target.checked })} className="h-4 w-4 accent-[var(--color-primary)]" />
            </label>
          )}
          {anyCaps.cct && (
            <div onTouchEnd={tapReset(() => update({ cct: DEFAULT_CCT }))}>
              <Control label="CCT" value={first.cct} display={`${kelvin(first.cct)}K`} onChange={(v) => update({ cct: v })} onReset={() => update({ cct: DEFAULT_CCT })}
                gradient="linear-gradient(to right, rgb(255,137,18), rgb(255,228,206), rgb(255,250,244), rgb(204,219,255))" />
            </div>
          )}
          {anyCaps.gm && (
            <div onTouchEnd={tapReset(() => update({ gm: 0 }))}>
              <Control label="Green / Magenta" min={-1} max={1} value={first.gm} display={first.gm === 0 ? "0" : `${first.gm > 0 ? "+G" : "−M"} ${Math.abs(first.gm).toFixed(2)}`}
                onChange={(v) => update({ gm: Math.abs(v) < 0.02 ? 0 : v })} onReset={() => update({ gm: 0 })}
                gradient="linear-gradient(to right, rgb(255,0,200), rgb(240,240,240), rgb(0,220,80))" />
            </div>
          )}
          {showHsi && (
            <>
              <div onTouchEnd={tapReset(() => update({ crossfade: 0 }))}>
                <Control label="Crossfade CCT ↔ HSI" value={first.crossfade} display={`${Math.round(first.crossfade * 100)}%`} onChange={(v) => update({ crossfade: v })} onReset={() => update({ crossfade: 0 })} />
              </div>
              <div onTouchEnd={tapReset(() => update({ hue: 0, saturation: 0 }))}>
                <Control label="Hue" value={first.hue / 360} display={`${Math.round(first.hue)}°`} onChange={(v) => update({ hue: v * 360 })} onReset={() => update({ hue: 0, saturation: 0 })}
                  gradient="linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)" />
              </div>
              <div onTouchEnd={tapReset(() => update({ saturation: 0 }))}>
                <Control label="Saturation" value={first.saturation} display={`${Math.round(first.saturation * 100)}%`} onChange={(v) => update({ saturation: v })} onReset={() => update({ saturation: 0 })} />
              </div>
            </>
          )}
          <p className="text-[10px] text-muted-foreground">Double-tap a slider to reset it (G/M → 0, HSI → neutral, CCT → 5600K).</p>
        </Section>
      )}

      <Section title="Trigger">
        <div className="grid grid-cols-2 gap-2">
          {TRIGGERS.map((tr) => (
            <button key={tr.id} onClick={() => fire(tr.id)} className="flex items-center justify-center gap-1.5 rounded-md bg-surface-elevated py-3 text-xs font-bold active:scale-95 active:bg-amber-glow active:text-primary-foreground">
              <Zap className="h-3.5 w-3.5 text-amber-glow" />{tr.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Effect">
        <div className="grid grid-cols-4 gap-2">
          {EFFECTS.map((e) => (
            <button key={e.id} onClick={() => setFx({ ...FX_PRESETS[e.id], kind: e.id })} className={`rounded-md py-2.5 text-xs font-semibold active:scale-95 ${fx.kind === e.id ? "bg-amber-glow text-primary-foreground" : "bg-surface-elevated"}`}>
              {e.label}
            </button>
          ))}
        </div>
        {fx.kind !== "none" && <EffectEditor fx={fx} setFx={setFx} />}
      </Section>
    </div>
  );
}

function EffectEditor({ fx, setFx }: { fx: FxParams; setFx: (p: Partial<FxParams>) => void }) {
  const periodic = fx.kind === "pulse" || fx.kind === "strobe";
  const W = 300, H = 60, secs = fx.kind === "lightning" ? 20 : 4;
  const pts = Array.from({ length: 200 }, (_, i) => {
    const t = (i / 199) * secs;
    return `${(i / 199) * W},${H - sampleEffect(fx, t) * H}`;
  }).join(" ");

  return (
    <div className="space-y-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full rounded-md bg-surface-elevated" preserveAspectRatio="none">
        <polyline points={pts} fill="none" stroke="var(--color-amber-glow)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>

      <Control
        label={fx.kind === "steps" ? "Speed" : fx.kind === "lightning" ? "Strike rate" : "Rate"}
        value={rateToSlider(fx.rate)}
        display={fx.kind === "steps" ? `×${fx.rate.toFixed(2)}` : fx.rate < 1 ? `${(1 / fx.rate).toFixed(1)} s` : `${fx.rate.toFixed(2)} Hz`}
        onChange={(v) => setFx({ rate: sliderToRate(v) })}
      />
      <div className="grid grid-cols-2 gap-3">
        <Control label="Low" value={fx.min} display={`${Math.round(fx.min * 100)}%`} onChange={(v) => setFx({ min: v })} />
        <Control label="High" value={fx.max} display={`${Math.round(fx.max * 100)}%`} onChange={(v) => setFx({ max: v })} />
      </div>
      {periodic && (
        <>
          <Control label="On time (gap)" value={fx.duty} display={`${Math.round(fx.duty * 100)}% on`} onChange={(v) => setFx({ duty: Math.max(0.02, v) })} />
          <div className="grid grid-cols-2 gap-3">
            <Control label="Attack" value={fx.attack} display={`${Math.round(fx.attack * 100)}%`} onChange={(v) => setFx({ attack: v })} />
            <Control label="Release" value={fx.release} display={`${Math.round(fx.release * 100)}%`} onChange={(v) => setFx({ release: v })} />
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
  const set = (i: number, p: Partial<FxParams["steps"][number]>) => setFx({ steps: fx.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const num = "w-full rounded-md border border-input bg-surface px-2 py-1.5 text-xs";
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1.5rem_1fr_1fr_1fr_1.5rem] gap-1.5 text-[10px] uppercase text-muted-foreground">
        <span>#</span><span>Level %</span><span>Fade s</span><span>Hold s</span><span />
      </div>
      {fx.steps.map((s, i) => (
        <div key={i} className="grid grid-cols-[1.5rem_1fr_1fr_1fr_1.5rem] items-center gap-1.5">
          <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
          <input type="number" min={0} max={100} value={Math.round(s.level * 100)} onChange={(e) => set(i, { level: Math.min(1, Math.max(0, +e.target.value / 100)) })} className={num} />
          <input type="number" min={0} step={0.05} value={s.fade} onChange={(e) => set(i, { fade: Math.max(0, +e.target.value) })} className={num} />
          <input type="number" min={0} step={0.05} value={s.hold} onChange={(e) => set(i, { hold: Math.max(0, +e.target.value) })} className={num} />
          <button onClick={() => setFx({ steps: fx.steps.filter((_, j) => j !== i) })} disabled={fx.steps.length <= 1} className="text-muted-foreground hover:text-destructive disabled:opacity-30" aria-label="Remove step"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <button onClick={() => setFx({ steps: [...fx.steps, { level: 1, fade: 0.2, hold: 0.3 }] })} className="flex w-full items-center justify-center gap-1.5 rounded-md bg-surface-elevated py-2 text-xs font-semibold"><Plus className="h-3.5 w-3.5" />Add step</button>
    </div>
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
