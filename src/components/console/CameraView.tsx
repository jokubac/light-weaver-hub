// Perspective render of the live plot from a virtual camera, exposed by lens / iris / ISO.
import { useEffect, useRef } from "react";
import { rayBlocked, wallPanels, wallSegments, type Opening, type WallStroke } from "@/lib/plot-geometry";
import { cameraBasis, exposureGain, horizontalFov, projectCameraSpace, type PlotCamera } from "@/lib/plot-camera";
import type { SetObject } from "@/lib/plot-objects";

export interface CamLight { x: number; y: number; z: number; rot: number; tilt: number; beam: number; watts: number; level: number; rgb: [number, number, number] }
type V3 = [number, number, number];
interface Poly { pts: V3[]; n: V3; albedo: V3; emissive?: V3; glass?: boolean }

const LM_PER_W = 100;

export function CameraView({ cam, size, strokes, openings, objects, floorZ, lights }: {
  cam: PlotCamera; size: [number, number]; strokes: WallStroke[]; openings: Opening[]; objects: SetObject[]; floorZ: number; lights: CamLight[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const W = c.width = c.clientWidth * (window.devicePixelRatio || 1);
    const H = c.height = Math.round(W * 9 / 16);
    const ctx = c.getContext("2d"); if (!ctx) return;
    const polys = buildScene(size, strokes, openings, objects, cam);
    const walls = wallSegments(strokes, cam.floor);
    const eye: V3 = [cam.x, cam.y, cam.h];
    const { forward: fwd, right, up } = cameraBasis(cam);
    const f = (W / 2) / Math.tan(horizontalFov(cam) * Math.PI / 360);
    const gain = exposureGain(cam);
    const project = (p: V3): [number, number, number] | null => {
      const d = sub(p, eye); const z = dot(d, fwd);
      if (z < 0.05) return null;
      return projectCameraSpace([dot(d, right), dot(d, up), z], W, H, f);
    };
    const lightAt = (p: V3, n: V3): V3 => {
      const out: V3 = [0.02, 0.02, 0.025]; // faint ambient bounce
      for (const L of lights) {
        if (L.level <= 0.002) continue;
        const lp: V3 = [L.x, L.y, L.z - floorZ];
        const d = sub(p, lp); const dist = Math.hypot(...d); if (dist < 0.05) continue;
        const dir: V3 = [d[0] / dist, d[1] / dist, d[2] / dist];
        const a = L.rot * Math.PI / 180, t = L.tilt * Math.PI / 180;
        const axis: V3 = [Math.cos(a) * Math.cos(t), Math.sin(a) * Math.cos(t), -Math.sin(t)];
        const ang = Math.acos(Math.max(-1, Math.min(1, dot(dir, axis))));
        const half = Math.min(90, L.beam / 2) * Math.PI / 180;
        if (ang > half) continue;
        const cosI = -dot(dir, n); if (cosI <= 0) continue;
        if (rayBlocked(lp, [p[0] - dir[0] * 0.02, p[1] - dir[1] * 0.02, p[2] - dir[2] * 0.02], walls, openings)) continue;
        const omega = Math.max(0.001, 2 * Math.PI * (1 - Math.cos(half)));
        const edge = Math.pow(Math.max(0, 1 - Math.pow(ang / half, 2)), 1.5);
        const lux = (L.watts * LM_PER_W * L.level / omega) * edge * cosI / (dist * dist);
        for (let k = 0; k < 3; k++) out[k] = out[k]! + lux * (L.rgb[k]! / 255);
      }
      return out;
    };
    const tone = (x: number) => Math.round(255 * Math.pow(1 - Math.exp(-x * 2.2), 1 / 2.2));
    const drawn: { pts: [number, number][]; z: number; fill: string }[] = [];
    // camera-space near-plane clipping, so faces crossing behind the lens don't explode into spikes
    const NEAR = 0.1;
    const toCam = (p: V3): V3 => { const d = sub(p, eye); return [dot(d, right), dot(d, up), dot(d, fwd)]; };
    const clipNear = (pts: V3[]): V3[] => {
      const out: V3[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
        const ain = a[2] >= NEAR, bin = b[2] >= NEAR;
        if (ain) out.push(a);
        if (ain !== bin) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
      }
      return out;
    };
    for (const poly of polys) {
      const cp = clipNear(poly.pts.map(toCam));
      if (cp.length < 3) continue;
      const pr = cp.map((q) => projectCameraSpace(q, W, H, f));
      if (pr.every((q) => q[0] < 0) || pr.every((q) => q[0] > W) || pr.every((q) => q[1] < 0) || pr.every((q) => q[1] > H)) continue;
      const centre = poly.pts.reduce<V3>((s, p) => [s[0] + p[0] / poly.pts.length, s[1] + p[1] / poly.pts.length, s[2] + p[2] / poly.pts.length], [0, 0, 0]);
      let n = poly.n; if (dot(n, sub(eye, centre)) < 0) n = [-n[0], -n[1], -n[2]];
      const E = lightAt(centre, n);
      const col = poly.albedo.map((al, k) => tone(E[k]! * al * gain + (poly.emissive?.[k] ?? 0)));
      const z = Math.hypot(...sub(centre, eye));
      drawn.push({ pts: (pr as [number, number, number][]).map((q) => [q[0], q[1]]), z, fill: `rgba(${col[0]},${col[1]},${col[2]},${poly.glass ? 0.35 : 1})` });
    }
    ctx.fillStyle = "#050507"; ctx.fillRect(0, 0, W, H);
    drawn.sort((a, b) => b.z - a.z);
    for (const d of drawn) { ctx.beginPath(); d.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fillStyle = d.fill; ctx.fill(); ctx.strokeStyle = d.fill; ctx.lineWidth = 0.5; ctx.stroke(); }
    // light sources visible in frame
    ctx.globalCompositeOperation = "lighter";
    for (const L of lights) {
      const q = project([L.x, L.y, L.z - floorZ]); if (!q || L.level <= 0.002) continue;
      const r = Math.min(W * 0.08, Math.max(4, 40 / q[2]) * Math.min(3, 0.6 + gain * L.watts * L.level * 4));
      const g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], r);
      g.addColorStop(0, `rgba(${L.rgb.join(",")},0.95)`); g.addColorStop(1, `rgba(${L.rgb.join(",")},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  });
  return <canvas ref={ref} className="aspect-video w-full rounded-md bg-background" aria-label="Camera view" />;
}

function buildScene(size: [number, number], strokes: WallStroke[], openings: Opening[], objects: SetObject[], cam: PlotCamera): Poly[] {
  const polys: Poly[] = [];
  const floor = cam.floor;
  const [SW, SH] = size;
  // Camera-local detail plus a distant floor, independent of the legacy stage dimensions.
  const extent = Math.max(40, Math.min(100, Math.max(SW, SH)));
  const step = extent / 40;
  polys.push({ pts: [[cam.x-10000,cam.y-10000,0], [cam.x+10000,cam.y-10000,0], [cam.x+10000,cam.y+10000,0], [cam.x-10000,cam.y+10000,0]], n: [0,0,1], albedo: [.35,.33,.3] });
  for (let ix = 0; ix < 40; ix++) for (let iy = 0; iy < 40; iy++) {
    const x = cam.x - extent / 2 + ix * step, y = cam.y - extent / 2 + iy * step;
    polys.push({ pts: [[x, y, 0], [x+step, y, 0], [x+step, y+step, 0], [x, y+step, 0]], n: [0, 0, 1], albedo: [0.35, 0.33, 0.3] });
  }
  for (const w of wallSegments(strokes, floor)) {
    const len = Math.hypot(w.dx, w.dy); if (len < 0.01) continue;
    const n: V3 = [-w.dy / len, w.dx / len, 0];
    for (const [a, b, lo, hi] of wallPanels(w, openings)) {
      const segs = Math.max(1, Math.ceil(((b - a) * len) / 0.5)), rows = Math.max(1, Math.ceil((hi - lo) / 0.5));
      for (let i = 0; i < segs; i++) for (let j = 0; j < rows; j++) {
        const u1 = a + (b - a) * i / segs, u2 = a + (b - a) * (i + 1) / segs, z1 = lo + (hi - lo) * j / rows, z2 = lo + (hi - lo) * (j + 1) / rows;
        polys.push({ pts: [[w.x + w.dx * u1, w.y + w.dy * u1, z1], [w.x + w.dx * u2, w.y + w.dy * u2, z1], [w.x + w.dx * u2, w.y + w.dy * u2, z2], [w.x + w.dx * u1, w.y + w.dy * u1, z2]], n, albedo: [0.6, 0.58, 0.55] });
      }
    }
  }
  for (const o of objects.filter((x) => x.floor === floor)) {
    const a = o.rot * Math.PI / 180;
    const P = (x: number, y: number, z: number): V3 => [o.x + x * Math.cos(a) - y * Math.sin(a), o.y + x * Math.sin(a) + y * Math.cos(a), z];
    const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, albedo: V3, glass = false) => {
      const c = [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)];
      const t = [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)];
      polys.push({ pts: t, n: [0, 0, 1], albedo, glass });
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4; const e = sub(c[j]!, c[i]!);
        polys.push({ pts: [c[i]!, c[j]!, t[j]!, t[i]!], n: norm([e[1], -e[0], 0]), albedo, glass });
      }
    };
    if (o.kind === "tree") {
      box(-0.12, 0.12, -0.12, 0.12, 0, o.h * 0.45, [0.3, 0.2, 0.12]);
      box(-o.w / 2, o.w / 2, -o.d / 2, o.d / 2, o.h * 0.35, o.h, [0.12, 0.35, 0.12]);
    } else if (o.kind === "car") {
      box(-o.w / 2, o.w / 2, -o.d / 2, o.d / 2, 0.2, o.h * 0.55, [0.5, 0.08, 0.08]);
      box(-o.w * 0.42, o.w * 0.42, -o.d * 0.25, o.d * 0.2, o.h * 0.55, o.h, [0.5, 0.65, 0.75], true);
    } else if (o.kind === "person") {
      box(-o.w / 2, o.w / 2, -o.d / 3, o.d / 3, 0, o.h * 0.85, [0.45, 0.4, 0.38]);
      box(-0.11, 0.11, -0.11, 0.11, o.h * 0.85, o.h, [0.75, 0.55, 0.45]);
    } else box(-o.w / 2, o.w / 2, -o.d / 2, o.d / 2, 0, o.h, [0.5, 0.45, 0.4]);
  }
  return polys;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
