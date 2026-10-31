import { useEffect, useRef, useState } from "react";
import { generatorById } from "@/lib/pixel-generators";
import { buildFormula, compileFormula, detectFormulaShape, FORMULA_KNOBS, FORMULA_SHAPES, type FormulaKnobs } from "@/lib/pixel-formula";
import type { PixelLayer } from "@/lib/pixels";
import { t as tr } from "@/lib/i18n";

type RGB = [number, number, number];

const hex = (c: string): RGB => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return [255, 255, 255];
  const v = parseInt(m[1]!, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

/** The layer's own colours blended the same way the lights blend them. */
function paletteOf(colors: string[]): (phase: number) => RGB {
  const cols = colors.length ? colors.map(hex) : [[255, 255, 255] as RGB];
  const col = (i: number) => cols[((i % cols.length) + cols.length) % cols.length]!;
  return (phase) => {
    const p = ((phase % 1 + 1) % 1) * cols.length;
    const i = Math.floor(p);
    const k = p - i;
    const a = col(i), b = col(i + 1);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  };
}

/**
 * Paints a formula with the very maths the lights use, so the picture on screen
 * is the picture on stage. Animated, or a still frame when `at` is given.
 */
export function FormulaCanvas({ formula, cols = 36, rows = 20, cell = 8, at, colors, custom }: {
  formula: string; cols?: number; rows?: number; cell?: number;
  /** seconds — draws one still frame and stops; the picture moves when left out */
  at?: number; colors?: string[]; custom?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const look = useRef({ colors, custom });
  look.current = { colors, custom };
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const gen = generatorById("formula");
    const draw = (t: number) => {
      const pal = paletteOf(look.current.colors ?? []);
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const [r, g, b] = gen.fn({ x: i, y: j, W: cols, H: rows, t, pal, custom: !!look.current.custom, formula });
          ctx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
          ctx.fillRect(i * cell, j * cell, cell, cell);
        }
      }
    };
    let raf = 0;
    const t0 = performance.now();
    const loop = () => { draw((performance.now() - t0) / 1000); raf = requestAnimationFrame(loop); };
    if (at === undefined) loop(); else draw(at);
    return () => cancelAnimationFrame(raf);
  }, [formula, cols, rows, cell, at]);
  return <canvas ref={ref} width={cols * cell} height={rows * cell} className="block h-auto w-full rounded-md bg-black" aria-hidden="true" />;
}

function Dial({ label, value, min, max, step, display, onChange }: {
  label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>{label}</span><span className="font-mono">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full accent-[var(--color-primary)]" />
    </label>
  );
}

const TOKENS = ["x", "y", "u", "v", "d", "a", "t", "pi", "sin(", "cos(", "abs(", "fract(", "tri(", "rnd(", "clamp(", "mod(", "pow(", "min(", "max(", "0.5", "+", "-", "*", "/", "(", ")", "^", ","];

/**
 * The plain-language way to make a pixel pattern: pick a picture, turn two dials,
 * watch it move. The raw maths stays one tap away for anyone who wants it.
 */
export function FormulaEditor({ layer, set }: { layer: PixelLayer; set: (p: Partial<PixelLayer>) => void }) {
  const [adv, setAdv] = useState(false);
  const src = layer.formula ?? buildFormula(FORMULA_SHAPES[0]!.id);
  const shape = layer.formulaShape ?? detectFormulaShape(src);
  const err = compileFormula(src);
  const knobs: FormulaKnobs = shape ? { scale: layer.formulaScale ?? 1, soft: layer.formulaSoft ?? 0, invert: layer.formulaInvert ?? false } : FORMULA_KNOBS;
  const input = useRef<HTMLInputElement | null>(null);

  const apply = (id: string, k: FormulaKnobs) => set({ formula: buildFormula(id, k), formulaShape: id, formulaScale: k.scale, formulaSoft: k.soft, formulaInvert: k.invert });
  const dial = (p: Partial<FormulaKnobs>) => { if (shape) apply(shape, { ...knobs, ...p }); };
  const write = (next: string) => set({ formula: next, formulaShape: detectFormulaShape(next) ?? undefined });
  const tap = (tok: string) => {
    const el = input.current;
    const from = el?.selectionStart ?? src.length;
    const to = el?.selectionEnd ?? from;
    write(src.slice(0, from) + tok + src.slice(to));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(from + tok.length, from + tok.length); });
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{tr("Formula")}</div>
      {/* the pattern as the lights will show it */}
      <div className="overflow-hidden rounded-md border border-border">
        <FormulaCanvas formula={src} colors={layer.colors} custom={!!layer.customPalette} />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {FORMULA_SHAPES.map((s) => {
          const on = shape === s.id;
          return (
            <button key={s.id} aria-pressed={on} onClick={() => apply(s.id, knobs)}
              className={`overflow-hidden rounded-md border p-1 text-[10px] font-semibold transition active:scale-95 ${on ? "border-primary bg-primary/15 text-primary" : "border-transparent bg-surface-elevated"}`}>
              <FormulaCanvas formula={buildFormula(s.id)} cols={14} rows={8} cell={4} at={0.6} />
              <span className="mt-0.5 block truncate">{tr(s.label)}</span>
            </button>
          );
        })}
      </div>
      {shape ? (
        <div className="space-y-2 rounded-md bg-surface-elevated/60 p-2">
          <Dial label={tr("Size")} value={knobs.scale} min={0.5} max={4} step={0.1} display={`${+knobs.scale.toFixed(2)}×`} onChange={(scale) => dial({ scale })} />
          <Dial label={tr("Softness")} value={knobs.soft} min={0} max={1} step={0.05} display={`${Math.round(knobs.soft * 100)}%`} onChange={(soft) => dial({ soft })} />
          <button onClick={() => dial({ invert: !knobs.invert })} aria-pressed={knobs.invert}
            className={`w-full rounded-md py-1.5 text-[11px] font-semibold ${knobs.invert ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>{tr("Invert")}</button>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">{tr("This pattern was written by hand — pick a picture above to use the dials.")}</p>
      )}
      {typeof err === "string" && <p className="text-[10px] text-destructive">{err}</p>}
      <button onClick={() => setAdv((a) => !a)} className="w-full rounded-md bg-surface-elevated py-1.5 text-[11px] font-semibold">{tr("Advanced: type the maths")}</button>
      {adv && (
        <div className="space-y-1.5">
          <input ref={input} aria-label={tr("Formula")} spellCheck={false} value={src} onChange={(e) => write(e.target.value)}
            className={`w-full rounded-md border bg-background px-2 py-1.5 font-mono text-xs ${typeof err === "string" ? "border-destructive" : "border-border"}`} />
          <div className="grid grid-cols-7 gap-1">
            {TOKENS.map((tok) => <button key={tok} onClick={() => tap(tok)} className="rounded bg-surface-elevated px-1 py-1 font-mono text-[11px]">{tok}</button>)}
          </div>
          <div className="flex gap-1">
            <button onClick={() => write(src.slice(0, -1))} className="flex-1 rounded bg-surface-elevated py-1.5 text-[11px] font-semibold">{tr("Delete")}</button>
            <button onClick={() => write("")} className="flex-1 rounded bg-surface-elevated py-1.5 text-[11px] font-semibold">{tr("Clear")}</button>
          </div>
          <p className="text-[10px] text-muted-foreground">{tr("Result 0–1 = brightness and colour. x, y: −1…1 from centre · u, v: 0…1 · d: distance · a: angle · t: time · sin cos abs pow sqrt fract tri step rnd clamp mod · ^ = power")}</p>
        </div>
      )}
    </div>
  );
}
