import type { BeamAttr } from "@/lib/dmx";

// Blade n: frame edge (clockwise: 1 top, 2 right, 3 bottom, 4 left), its A/B end corners and the inward direction.
const EDGES: { a: [number, number]; b: [number, number]; d: [number, number] }[] = [
  { a: [0, 0], b: [100, 0], d: [0, 1] },
  { a: [100, 0], b: [100, 100], d: [-1, 0] },
  { a: [100, 100], b: [0, 100], d: [0, -1] },
  { a: [0, 100], b: [0, 0], d: [1, 0] },
];
/** Blade insertion 0-1 maps to the full beam width so a single blade end can cut deep across a corner. */
const DEPTH = 100;
/** Handles sit this far along the blade from each corner so A/B handles of neighbouring blades never overlap. */
const T = 0.15;
/** Rotation channel 0-1 covers ±45°, 0.5 = straight blade. */
const MAX_ANGLE = Math.PI / 4;

/** Blades with one insertion channel plus rotation: convert to the two end depths the pad draws. */
export function endsFromRotation(ins: number, rot: number) {
  const diff = Math.tan((rot - 0.5) * 2 * MAX_ANGLE);
  return { a: ins - diff / 2, b: ins + diff / 2 };
}
/** Inverse of endsFromRotation: two end depths → insertion and rotation, both clamped to 0-1. */
export function rotationFromEnds(a: number, b: number) {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const angle = Math.atan(b - a);
  return { ins: clamp((a + b) / 2), rot: clamp(0.5 + angle / (2 * MAX_ANGLE)) };
}
/** Depth wanted at a handle → new value for that blade end, keeping the other end fixed. */
export function endFromHandle(depth: number, other: number) {
  return (depth - other * T) / (1 - T);
}

type Kind = "ab" | "rot" | "single";

/** Visual framing shutter: drag either end of each blade to cut that corner of the beam. */
export function FramingPad({ has, value, set }: { has: (a: BeamAttr) => boolean; value: (a: BeamAttr) => number; set: (a: BeamAttr, v: number | undefined) => void }) {
  const blades = [1, 2, 3, 4].filter((n) => has(`Blade${n}A` as BeamAttr) || has(`Blade${n}B` as BeamAttr));
  if (!blades.length) return null;
  const info = (n: number) => {
    const A = `Blade${n}A` as BeamAttr, B = `Blade${n}B` as BeamAttr, R = `Blade${n}Rot` as BeamAttr;
    const I = has(A) ? A : B;
    const kind: Kind = has(A) && has(B) ? "ab" : has(R) ? "rot" : "single";
    if (kind === "ab") return { kind, A, B, R, I, a: value(A), b: value(B) };
    if (kind === "rot") return { kind, A, B, R, I, ...endsFromRotation(value(I), value(R)) };
    return { kind, A, B, R, I, a: value(I), b: value(I) };
  };
  /** Drag the blade's cutting line: the whole blade slides in or out, keeping its angle. */
  const slide = (n: number) => (e: React.PointerEvent<SVGElement>) => {
    if (e.type === "pointermove" && e.buttons === 0) return;
    const svg = (e.currentTarget as SVGElement).ownerSVGElement;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * 120 - 10, py = ((e.clientY - r.top) / r.height) * 120 - 10;
    const ed = EDGES[n - 1]!;
    const depth = ((px - ed.a[0]) * ed.d[0] + (py - ed.a[1]) * ed.d[1]) / DEPTH;
    const b = info(n);
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    if (b.kind !== "ab") { set(b.I, clamp(depth)); return; }
    const shift = depth - (b.a + b.b) / 2;
    set(b.A, clamp(b.a + shift)); set(b.B, clamp(b.b + shift));
  };
  const drag = (n: number, end: "a" | "b") => (e: React.PointerEvent<SVGElement>) => {
    if (e.type === "pointermove" && e.buttons === 0) return;
    const svg = (e.currentTarget as SVGElement).ownerSVGElement;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    // viewBox is -10..110 (120 units)
    const px = ((e.clientX - r.left) / r.width) * 120 - 10, py = ((e.clientY - r.top) / r.height) * 120 - 10;
    const ed = EDGES[n - 1]!;
    const depth = ((px - ed.a[0]) * ed.d[0] + (py - ed.a[1]) * ed.d[1]) / DEPTH;
    const b = info(n);
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    if (b.kind === "single") { set(b.I, clamp(depth)); return; }
    let na = b.a, nb = b.b;
    if (end === "a") na = clamp(endFromHandle(depth, b.b)); else nb = clamp(endFromHandle(depth, b.a));
    if (b.kind === "ab") { set(end === "a" ? b.A : b.B, end === "a" ? na : nb); return; }
    const { ins, rot } = rotationFromEnds(na, nb);
    set(b.I, ins); set(b.R, rot);
  };
  return (
    <div className="space-y-1">
      <svg viewBox="-10 -10 120 120" aria-label="Framing shutters" className="aspect-square w-full touch-none select-none rounded-md border border-input bg-background">
        <defs>
          <clipPath id="framing-beam"><circle cx="50" cy="50" r="50" /></clipPath>
        </defs>
        <circle cx="50" cy="50" r="50" className="fill-primary/60" />
        <g clipPath="url(#framing-beam)">
          {blades.map((n) => {
            const ed = EDGES[n - 1]!; const { a, b } = info(n);
            const pa = [ed.a[0] + ed.d[0] * a * DEPTH, ed.a[1] + ed.d[1] * a * DEPTH];
            const pb = [ed.b[0] + ed.d[0] * b * DEPTH, ed.b[1] + ed.d[1] * b * DEPTH];
            return <polygon key={n} points={`${ed.a.join(",")} ${ed.b.join(",")} ${pb.join(",")} ${pa.join(",")}`} className="fill-surface-elevated stroke-foreground" strokeWidth="0.8" />;
          })}
        </g>
        <circle cx="50" cy="50" r="50" className="fill-none stroke-primary" strokeWidth="1.5" />
        {(() => { const parts = blades.map((n) => {
          const ed = EDGES[n - 1]!; const { a, b } = info(n);
          const at = (s: number, depth: number): [number, number] => [ed.a[0] + (ed.b[0] - ed.a[0]) * s + ed.d[0] * depth * DEPTH, ed.a[1] + (ed.b[1] - ed.a[1]) * s + ed.d[1] * depth * DEPTH];
          const pa = at(T, a * (1 - T) + b * T), pb = at(1 - T, b * (1 - T) + a * T);
          const la = at(0, a), lb = at(1, b);
          const line = (
            <g key={`${n}line`} aria-label={`Blade ${n} edge`} className={n % 2 ? "cursor-ns-resize" : "cursor-ew-resize"}
              onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); slide(n)(e); }} onPointerMove={slide(n)}>
              <line x1={la[0]} y1={la[1]} x2={lb[0]} y2={lb[1]} stroke="transparent" strokeWidth="9" />
              <line x1={la[0]} y1={la[1]} x2={lb[0]} y2={lb[1]} className="stroke-foreground" strokeWidth="1.4" />
            </g>
          );
          return { line, dots: (["a", "b"] as const).map((end) => {
            const p = end === "a" ? pa : pb;
            return (
              <g key={`${n}${end}`} className="cursor-grab" aria-label={`Blade ${n} ${end.toUpperCase()}`}
                onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); drag(n, end)(e); }} onPointerMove={drag(n, end)}>
                <circle cx={p[0]} cy={p[1]} r="8" fill="transparent" />
                <circle cx={p[0]} cy={p[1]} r="3.5" className="fill-foreground stroke-primary" strokeWidth="1.2" />
              </g>
            );
          }) };
        });
          // every blade edge first, every corner dot on top, so a moved blade never hides another blade's dots
          return <>{parts.map((x) => x.line)}{parts.flatMap((x) => x.dots)}</>; })()}
      </svg>
      <p className="text-[10px] text-muted-foreground">Drag a blade edge to slide it, or a dot to cut a corner.</p>
    </div>
  );
}
