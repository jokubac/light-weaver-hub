import { useEffect, useRef, useState, type ReactNode } from "react";
import { RotateCw, ZoomIn, ZoomOut, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDef, type PatchedFixture } from "@/lib/dmx";
import { canvasPositions, canvasSize, renderCanvasImage, stageSize, textMask, isPixelFixture, pixelCount, pixelGrid, type PixelLayer } from "@/lib/pixels";
import { pixelPreview } from "./pixel-preview";
import { useClock } from "./PixelPanel";

type RGB = [number, number, number];

/** PIXEL window: free canvas where pixel lights are placed like on the GRID, a strip with every light, and the effect controls. */
export function PixelStage({ fixtures, layers, activeId, frame, controls, onMove, onToggle }: {
  fixtures: PatchedFixture[]; layers: PixelLayer[]; activeId: string; frame: Map<string, RGB[]>; controls: ReactNode;
  onMove: (uid: string, pos: { x: number; y: number; r?: number }) => void; onToggle: (uid: string) => void;
}) {
  const [cell, setCell] = useState(20);
  const now = useClock();
  const px = fixtures.filter(isPixelFixture);
  const layer = layers.find((l) => l.id === activeId) ?? layers[0];
  const pos = canvasPositions(fixtures);
  const preview = layer ? pixelPreview({ ...layer, order: layer.order.filter((u) => px.some((f) => f.uid === u)) }, fixtures, frame, now).frame : frame;
  const drag = useRef<{ uid: string; x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);
  const stage = stageSize(fixtures);
  const W = stage.W + 4, H = stage.H + 4;
  // effect painted over the whole canvas, like a video; lights pick up the spot they sit on
  const bg = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = bg.current; if (!c || !layer) return;
    const { W: w, H: h, img } = renderCanvasImage(layer, fixtures, now, layer.kind === "text" ? textMask(layer.text.toUpperCase(), stage.H) : null);
    c.width = w; c.height = h;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const data = ctx.createImageData(w, h);
    img.forEach((p, i) => { data.data[i * 4] = p[0]; data.data[i * 4 + 1] = p[1]; data.data[i * 4 + 2] = p[2]; data.data[i * 4 + 3] = 255; });
    ctx.putImageData(data, 0, 0);
  });

  const autoArrange = () => { let y = 0; for (const f of px) { onMove(f.uid, { x: 0, y, r: 0 }); y += canvasSize({ ...f, pixelPos: { x: 0, y: 0 } })[1] + 1; } };

  const pixels = (f: PatchedFixture, size: number, rot: number) => {
    const [lc, lr] = pixelGrid(f);
    const cols = preview.get(f.uid) ?? frame.get(f.uid);
    const [gw, gh] = rot === 90 ? [lr, lc] : [lc, lr];
    return (
      <div className="grid h-full w-full gap-px" style={{ gridTemplateColumns: `repeat(${gw}, 1fr)`, gridTemplateRows: `repeat(${gh}, 1fr)` }}>
        {Array.from({ length: pixelCount(f) }, (_, i) => {
          const x = i % lc, y = Math.floor(i / lc); const [cx, cy] = rot === 90 ? [y, x] : [x, y]; const c = cols?.[i];
          return <div key={i} className="rounded-[2px]" style={{ gridColumn: cx + 1, gridRow: cy + 1, minWidth: size > 6 ? 0 : undefined, background: c ? `rgb(${c[0]},${c[1]},${c[2]})` : "var(--muted)" }} />;
        })}
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5 border-b border-border bg-surface px-3 py-1.5 text-xs">
          <span className="font-semibold">Pixel canvas</span>
          <span className="text-muted-foreground">Effect plays over the whole canvas · drag lights anywhere · tap to add/remove from “{layer?.name}”</span>
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="secondary" onClick={autoArrange}><LayoutGrid />Arrange</Button>
            <Button size="icon" variant="secondary" aria-label="Zoom out" onClick={() => setCell((c) => Math.max(4, c - 4))}><ZoomOut /></Button>
            <Button size="icon" variant="secondary" aria-label="Zoom in" onClick={() => setCell((c) => Math.min(48, c + 4))}><ZoomIn /></Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {px.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Patch a light in a pixel mode first (search “pixel” in PATCH).</p> : (
            <div className="relative rounded-md border border-border" style={{ width: W * cell, height: H * cell, backgroundImage: "linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)", backgroundSize: `${cell}px ${cell}px` }}>
              <canvas ref={bg} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 opacity-40" style={{ width: stage.W * cell, height: stage.H * cell, imageRendering: "pixelated" }} />
              {px.map((f) => {
                const p = pos.get(f.uid)!; const [w, h] = canvasSize({ ...f, pixelPos: p }); const inLayer = layer?.order.includes(f.uid);
                return (
                  <div key={f.uid} title={`${f.name} · ${getDef(f.defId).model}`}
                    className={`absolute cursor-grab touch-none rounded-sm p-px ${inLayer ? "ring-2 ring-primary" : "ring-1 ring-border opacity-70"}`}
                    style={{ left: p.x * cell, top: p.y * cell, width: w * cell, height: h * cell }}
                    onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = { uid: f.uid, x: e.clientX, y: e.clientY, ox: p.x, oy: p.y, moved: false }; }}
                    onPointerMove={(e) => { const d = drag.current; if (!d || d.uid !== f.uid) return; const dx = Math.round((e.clientX - d.x) / cell), dy = Math.round((e.clientY - d.y) / cell); if (!dx && !dy && !d.moved) return; d.moved = true; onMove(f.uid, { x: Math.max(0, d.ox + dx), y: Math.max(0, d.oy + dy), r: p.r }); }}
                    onPointerUp={() => { const d = drag.current; drag.current = null; if (d && !d.moved) onToggle(f.uid); }}>
                    {pixels(f, cell, p.r)}
                    <span className="pointer-events-none absolute -top-4 left-0 whitespace-nowrap text-[10px] font-semibold">{f.name}</span>
                    <button aria-label={`Rotate ${f.name}`} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onMove(f.uid, { x: p.x, y: p.y, r: p.r === 90 ? 0 : 90 }); }}
                      className="absolute -right-2 -top-2 rounded-full bg-surface-elevated p-0.5 text-muted-foreground hover:text-foreground"><RotateCw className="h-3 w-3" /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <section aria-label="All pixel lights" className="shrink-0 border-t border-border bg-surface p-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">All lights ({px.length})</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {px.map((f) => { const [c, r] = pixelGrid(f); const tall = r > c; return (
              <button key={f.uid} onClick={() => onToggle(f.uid)} className={`flex shrink-0 flex-col items-center gap-1 rounded-md p-1.5 ${layer?.order.includes(f.uid) ? "bg-primary/20 ring-1 ring-primary" : "bg-surface-elevated"}`}>
                <div style={{ width: tall ? 24 : Math.min(140, c * 8), height: tall ? Math.min(60, r * 8) : Math.max(8, r * 8) }}>{pixels(f, 8, 0)}</div>
                <span className="max-w-24 truncate text-[10px]">{f.name}</span>
              </button>); })}
          </div>
        </section>
      </div>
      <aside aria-label="Pixel effect controls" className="max-h-[55vh] w-full shrink-0 overflow-auto border-t border-border bg-surface p-4 lg:max-h-none lg:w-96 lg:border-l lg:border-t-0">{controls}</aside>
    </div>
  );
}
