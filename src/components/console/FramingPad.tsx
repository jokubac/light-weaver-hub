import type { BeamAttr } from "@/lib/dmx";

// Blade n: frame edge (clockwise: 1 top, 2 right, 3 bottom, 4 left), its A/B end corners and the inward direction.
const EDGES: { a: [number, number]; b: [number, number]; d: [number, number] }[] = [
  { a: [0, 0], b: [100, 0], d: [0, 1] },
  { a: [100, 0], b: [100, 100], d: [-1, 0] },
  { a: [100, 100], b: [0, 100], d: [0, -1] },
  { a: [0, 100], b: [0, 0], d: [1, 0] },
];
/** Blade insertion 0-1 maps to 0-50% of the beam, so fully-in blades from opposite sides meet in the centre. */
const DEPTH = 50;

/** Visual framing shutter: drag either end of each blade to cut that corner of the beam. */
export function FramingPad({ has, value, set }: { has: (a: BeamAttr) => boolean; value: (a: BeamAttr) => number; set: (a: BeamAttr, v: number | undefined) => void }) {
  const blades = [1, 2, 3, 4].filter((n) => has(`Blade${n}A` as BeamAttr) || has(`Blade${n}B` as BeamAttr));
  if (!blades.length) return null;
  const ends = (n: number) => {
    const A = `Blade${n}A` as BeamAttr, B = `Blade${n}B` as BeamAttr;
    const a = has(A) ? value(A) : value(B), b = has(B) ? value(B) : value(A);
    return { A, B, a, b };
  };
  const drag = (n: number, end: "a" | "b") => (e: React.PointerEvent<SVGCircleElement>) => {
    if (e.type === "pointermove" && e.buttons === 0) return;
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    // viewBox is -8..108 (116 units)
    const px = ((e.clientX - r.left) / r.width) * 116 - 8, py = ((e.clientY - r.top) / r.height) * 116 - 8;
    const ed = EDGES[n - 1]!;
    const depth = (px - ed.a[0]) * ed.d[0] + (py - ed.a[1]) * ed.d[1];
    const v = Math.min(1, Math.max(0, depth / DEPTH));
    const { A, B } = ends(n);
    if (has(A) && has(B)) set(end === "a" ? A : B, v);
    else set(has(A) ? A : B, v);
  };
  return (
    <div className="space-y-1">
      <svg viewBox="-8 -8 116 116" aria-label="Framing shutters" className="aspect-square w-full touch-none select-none rounded-md border border-input bg-surface-elevated">
        <rect x="0" y="0" width="100" height="100" className="fill-primary/25 stroke-border" strokeWidth="0.6" />
        <circle cx="50" cy="50" r="50" className="fill-none stroke-border" strokeDasharray="2 2" strokeWidth="0.5" />
        {blades.map((n) => {
          const ed = EDGES[n - 1]!; const { a, b } = ends(n);
          const pa: [number, number] = [ed.a[0] + ed.d[0] * a * DEPTH, ed.a[1] + ed.d[1] * a * DEPTH];
          const pb: [number, number] = [ed.b[0] + ed.d[0] * b * DEPTH, ed.b[1] + ed.d[1] * b * DEPTH];
          return (
            <g key={n}>
              <polygon points={`${ed.a.join(",")} ${ed.b.join(",")} ${pb.join(",")} ${pa.join(",")}`} className="fill-background/90 stroke-foreground/60" strokeWidth="0.6" />
              {(["a", "b"] as const).map((end) => {
                const p = end === "a" ? pa : pb;
                return <circle key={end} cx={p[0]} cy={p[1]} r="4" aria-label={`Blade ${n} ${end.toUpperCase()}`}
                  className="cursor-grab fill-primary stroke-background" strokeWidth="1"
                  onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag(n, end)(e); }} onPointerMove={drag(n, end)} />;
              })}
            </g>
          );
        })}
      </svg>
      <p className="text-[10px] text-muted-foreground">Drag the dots to cut each corner of the beam.</p>
    </div>
  );
}
