export interface Opening { id: string; kind: "door" | "window"; stroke: number; segment: number; center: number; width: number; bottom: number; height: number }
export interface WallStroke { pts: [number, number][]; floor?: number }
export interface WallSegment { x: number; y: number; dx: number; dy: number; stroke: number; segment: number }
export const WALL_HEIGHT = 2.6;
export function wallSegments(strokes: WallStroke[], floor: number): WallSegment[] {
  return strokes.flatMap((s, stroke) => (s.floor ?? 0) !== floor ? [] : s.pts.slice(1).flatMap((b, k) => {
    const a = s.pts[k];
    return a ? [{ x: a[0], y: a[1], dx: b[0] - a[0], dy: b[1] - a[1], stroke, segment: k }] : [];
  }));
}
export function openingBounds(o: Opening, wall: WallSegment): [number, number] {
  const half = o.width / (2 * Math.max(0.001, Math.hypot(wall.dx, wall.dy)));
  return [Math.max(0, o.center - half), Math.min(1, o.center + half)];
}
export function rayBlocked(origin: [number, number, number], target: [number, number, number], walls: WallSegment[], openings: Opening[]): boolean {
  const dx = target[0] - origin[0], dy = target[1] - origin[1];
  return walls.some((w) => {
    const den = dx * w.dy - dy * w.dx;
    if (Math.abs(den) < 1e-9) return false;
    const wx = w.x - origin[0], wy = w.y - origin[1];
    const t = (wx * w.dy - wy * w.dx) / den, u = (wx * dy - wy * dx) / den;
    if (t <= 0.0001 || t >= 1 || u < 0 || u > 1) return false;
    const z = origin[2] + (target[2] - origin[2]) * t;
    if (z < 0 || z > WALL_HEIGHT) return false;
    return !openings.some((o) => {
      if (o.stroke !== w.stroke || o.segment !== w.segment) return false;
      const [a, b] = openingBounds(o, w);
      return u >= a && u <= b && z >= o.bottom && z <= o.bottom + o.height;
    });
  });
}

/** Solid wall panels, cut around the actual rectangular openings. */
export function wallPanels(w: WallSegment, openings: Opening[]): [number, number, number, number][] {
  const os = openings.filter((o) => o.stroke === w.stroke && o.segment === w.segment);
  const edges = [...new Set([0, 1, ...os.flatMap((o) => openingBounds(o, w))])].sort((a, b) => a - b);
  return edges.slice(1).flatMap((end, i) => {
    const start = edges[i] ?? 0, mid = (start + end) / 2;
    const cuts = os.filter((o) => { const [a, b] = openingBounds(o, w); return mid > a && mid < b; }).map((o) => [Math.max(0, o.bottom), Math.min(WALL_HEIGHT, o.bottom + o.height)]).sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
    const panels: [number, number, number, number][] = [];
    let z = 0;
    for (const cut of cuts) { const lo = cut[0] ?? 0, hi = cut[1] ?? WALL_HEIGHT; if (lo > z) panels.push([start, end, z, lo]); z = Math.max(z, hi); }
    if (z < WALL_HEIGHT) panels.push([start, end, z, WALL_HEIGHT]);
    return panels;
  });
}