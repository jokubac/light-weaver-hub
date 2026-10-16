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

/** Visual framing shutter: drag either end of each blade to cut that corner of the beam. */
export function FramingPad({ has, value, set }: { has: (a: BeamAttr) => boolean; value: (a: BeamAttr) => number; set: (a: BeamAttr, v: number | undefined) => void }) {
  const blades = [1, 2, 3, 4].filter((n) => has(`Blade${n}A` as BeamAttr) || has(`Blade${n}B` as BeamAttr));
  if (!blades.length) return null;
  const ends = (n: number) => {
    const A = `Blade${n}A` as BeamAttr, B = `Blade${n}B` as BeamAttr;
    const a = has(A) ? value(A) : value(B), b = has(B) ? value(B) : value(A);
    return { A, B, a, b };
  };
  const drag = (n: number, end: "a" | "b") => (e: React.PointerEvent<SVGElement>) => {
    if (e.type === "pointermove" && e.buttons === 0) return;
    const svg = (e.currentTarget as SVGElement).ownerSVGElement;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    // viewBox is -10..110 (120 units)
    const px = ((e.clientX - r.left) / r.width) * 120 - 10, py = ((e.clientY - r.top) / r.height) * 120 - 10;
    const ed = EDGES[n - 1]!;
    const depth = (px - ed.a[0]) * ed.d[0] + (py - ed.a[1]) * ed.d[1];
    const v = Math.min(1, Math.max(0, depth / DEPTH));
    const { A, B } = ends(n);
    if (has(A) && has(B)) set(end === "a" ? A : B, v);
    else set(has(A) ? A : B, v);
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
            const ed = EDGES[n - 1]!; const { a, b } = ends(n);
            const pa = [ed.a[0] + ed.d[0] * a * DEPTH, ed.a[1] + ed.d[1] * a * DEPTH];
            const pb = [ed.b[0] + ed.d[0] * b * DEPTH, ed.b[1] + ed.d[1] * b * DEPTH];
            return <polygon key={n} points={`${ed.a.join(",")} ${ed.b.join(",")} ${pb.join(",")} ${pa.join(",")}`} className="fill-surface-elevated stroke-foreground" strokeWidth="0.8" />;
          })}
        </g>
        <circle cx="50" cy="50" r="50" className="fill-none stroke-primary" strokeWidth="1.5" />
        {blades.map((n) => {
          const ed = EDGES[n - 1]!; const { a, b } = ends(n);
          // Handles sit slightly inside the corners so A and B never overlap.
          const t = 0.15;
          const along = (s: number): [number, number] => [ed.a[0] + (ed.b[0] - ed.a[0]) * s, ed.a[1] + (ed.b[1] - ed.a[1]) * s];
          const ha = along(t), hb = along(1 - t);
          const pa: [number, number] = [ha[0] + ed.d[0] * (a * (1 - t) + b * t) * DEPTH, ha[1] + ed.d[1] * (a * (1 - t) + b * t) * DEPTH];
          const pb: [number, number] = [hb[0] + ed.d[0] * (b * (1 - t) + a * t) * DEPTH, hb[1] + ed.d[1] * (b * (1 - t) + a * t) * DEPTH];
          return (["a", "b"] as const).map((end) => {
            const p = end === "a" ? pa : pb;
            return (
              <g key={`${n}${end}`} className="cursor-grab" aria-label={`Blade ${n} ${end.toUpperCase()}`}
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag(n, end)(e); }} onPointerMove={drag(n, end)}>
                <circle cx={p[0]} cy={p[1]} r="8" fill="transparent" />
                <circle cx={p[0]} cy={p[1]} r="3.5" className="fill-foreground stroke-primary" strokeWidth="1.2" />
              </g>
            );
          });
        })}
      </svg>
      <p className="text-[10px] text-muted-foreground">Drag the dots to cut each corner of the beam.</p>
    </div>
  );
}
