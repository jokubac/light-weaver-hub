// Custom maths pixel effect: a user expression maps each pixel to a brightness/colour value.
// Pure and browser-safe; only whitelisted names are allowed so saved formulas cannot run code.

export interface FormulaVars { x: number; y: number; u: number; v: number; d: number; a: number; t: number; i: number; j: number; W: number; H: number }

const VARS = ["x", "y", "u", "v", "d", "a", "t", "i", "j", "W", "H"] as const;
const FNS: Record<string, unknown> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, abs: Math.abs, sqrt: Math.sqrt, pow: Math.pow, exp: Math.exp, log: Math.log,
  min: Math.min, max: Math.max, floor: Math.floor, ceil: Math.ceil, round: Math.round, atan2: Math.atan2, sign: Math.sign,
  hypot: Math.hypot, pi: Math.PI, PI: Math.PI, e: Math.E,
  fract: (n: number) => n - Math.floor(n),
  clamp: (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n)),
  mod: (n: number, m: number) => ((n % m) + m) % m,
  step: (edge: number, n: number) => (n >= edge ? 1 : 0),
  tri: (n: number) => 1 - Math.abs(((n % 2) + 2) % 2 - 1),
  rnd: (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); },
};
const ALLOWED = new Set<string>([...VARS, ...Object.keys(FNS)]);

export type Compiled = (p: FormulaVars) => number;
const cache = new Map<string, Compiled | string>();

/** Compiles an expression; returns an error message string when it is not valid. */
export function compileFormula(src: string): Compiled | string {
  const hit = cache.get(src);
  if (hit) return hit;
  let out: Compiled | string;
  const expr = src.trim().replace(/\^/g, "**");
  if (!expr) out = "Empty formula";
  else if (/[^0-9a-zA-Z_.+\-*/%()<>=!?:,&|\s]/.test(expr) || /=>|[^=!<>]=[^=]/.test(expr)) out = "Only numbers, maths and the listed names are allowed";
  else {
    const bad = (expr.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? []).find((w) => !ALLOWED.has(w));
    if (bad) out = `Unknown name: ${bad}`;
    else {
      try {
        const names = Object.keys(FNS);
        const f = new Function(...names, ...VARS, `"use strict"; return (${expr});`) as (...a: unknown[]) => number;
        const fv = names.map((n) => FNS[n]);
        const run: Compiled = (p) => { const r = Number(f(...fv, ...VARS.map((k) => p[k]))); return Number.isFinite(r) ? r : 0; };
        run({ x: 0, y: 0, u: 0.5, v: 0.5, d: 0, a: 0, t: 0, i: 0, j: 0, W: 1, H: 1 });
        out = run;
      } catch (e) { out = e instanceof Error ? e.message : "Invalid formula"; }
    }
  }
  if (cache.size > 64) cache.clear();
  cache.set(src, out);
  return out;
}

export const FORMULA_PRESETS: { label: string; f: string }[] = [
  { label: "Parabola", f: "1 - abs(y - (2*x*x - 1) * sin(t)) * 4" },
  { label: "Sine wave", f: "1 - abs(y - sin(x*pi*2 + t*3) * 0.7) * 3" },
  { label: "Ripple", f: "0.5 + 0.5*sin(d*12 - t*5)" },
  { label: "Spiral", f: "fract(a/(2*pi) + d*2 - t*0.5)" },
  { label: "Diagonal", f: "fract(u + v - t*0.5)" },
  { label: "Breathing", f: "0.5 + 0.5*sin(t*2)" },
  { label: "Checker", f: "mod(floor(x*4 + t) + floor(y*4), 2)" },
  { label: "Scanner", f: "1 - abs(u - tri(t*0.5)) * 6" },
];

// ── The simple builder: pick a picture, then turn two dials ────────────────
/** Dials of the simple builder. Every shape is one picture with these turned. */
export interface FormulaKnobs { scale: number; soft: number; invert: boolean }
export const FORMULA_KNOBS: FormulaKnobs = { scale: 1, soft: 0, invert: false };

const n3 = (v: number) => +v.toFixed(3);

/** Shapes offered as pictures. With the dials untouched each writes its classic formula. */
export const FORMULA_SHAPES: { id: string; label: string; make: (k: FormulaKnobs) => string }[] = [
  { id: "wave", label: "Wave", make: (k) => `1 - abs(y - sin(x*pi*${n3(2 * k.scale)} + t*3) * 0.7) * 3` },
  { id: "ripple", label: "Ripple", make: (k) => `0.5 + 0.5*sin(d*${n3(12 * k.scale)} - t*5)` },
  { id: "spiral", label: "Spiral", make: (k) => `fract(a/(2*pi) + d*${n3(2 * k.scale)} - t*0.5)` },
  { id: "diagonal", label: "Diagonal", make: (k) => `fract(${k.scale === 1 ? "u + v" : `(u + v)*${n3(k.scale)}`} - t*0.5)` },
  { id: "checker", label: "Checker", make: (k) => `mod(floor(x*${n3(4 * k.scale)} + t) + floor(y*${n3(4 * k.scale)}), 2)` },
  { id: "bars", label: "Bars", make: (k) => `fract(u*${n3(6 * k.scale)} + t*0.5)` },
  { id: "scan", label: "Scanner", make: (k) => `1 - abs(u - tri(t*0.5)) * ${n3(6 / k.scale)}` },
  { id: "breathe", label: "Breathing", make: (k) => `0.5 + 0.5*sin(t*${n3(2 * k.scale)})` },
  { id: "sparkle", label: "Sparkle", make: (k) => `rnd(i*12.9898 + j*78.233 + floor(t*9)) > ${n3(1 - 0.08 * k.scale)} ? 1 : 0` },
];

/** Writes the maths behind a shape and its dials; the plain shape stays exactly as written. */
export function buildFormula(shape: string, k: FormulaKnobs = FORMULA_KNOBS): string {
  const s = FORMULA_SHAPES.find((x) => x.id === shape);
  if (!s) return "";
  const core = s.make(k);
  if (k.soft === 0 && !k.invert) return core;
  const v = `clamp(pow(clamp(${core}), ${n3(1 / (1 + k.soft * 2))}))`;
  return k.invert ? `1 - ${v}` : v;
}

/** Which builder shape a stored formula came from — only when the dials were left alone. */
export function detectFormulaShape(src?: string): string | null {
  if (!src) return null;
  const s = src.trim();
  return FORMULA_SHAPES.find((x) => buildFormula(x.id) === s)?.id ?? null;
}
