import { useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { Printer, Download, FileText, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getDef, type PatchedFixture } from "@/lib/dmx";
import { NIIMBOT_MODELS, printLabels, type NiimbotModel } from "@/lib/niimbot";
import { saveFile, safeFileName } from "@/lib/save-file";
import { t as tr } from "@/lib/i18n";

const DPMM = 8; // 203 dpi

/** Draw one patch label (black on white) at printer resolution. */
export function drawLabel(f: PatchedFixture, num: number, wMm: number, hMm: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.round(wMm * DPMM); c.height = Math.round(hMm * DPMM);
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#000"; g.textBaseline = "top";
  const d = getDef(f.defId); const m = d.modes[f.modeIdx];
  const pad = Math.round(c.height * 0.06);
  const big = Math.round(c.height * (hMm < 20 ? 0.62 : 0.38));
  g.font = `900 ${big}px Manrope, system-ui, sans-serif`;
  const numTxt = `#${num}`; g.fillText(numTxt, pad, pad);
  const left = pad * 2 + g.measureText(numTxt).width;
  const lines = hMm < 20
    ? [f.name, `U${f.universe} · ${f.address}`]
    : [f.name, `${d.brand} ${d.model}`, `U${f.universe} · DMX ${f.address}–${f.address + (m?.channels ?? 1) - 1}`, m?.name ?? ""];
  const lh = (c.height - pad * 2) / lines.length;
  lines.forEach((t, i) => {
    g.font = `${i === 0 ? 800 : 600} ${Math.round(lh * 0.78)}px Manrope, system-ui, sans-serif`;
    let s = t; const max = c.width - left - pad;
    while (s.length > 1 && g.measureText(s).width > max) s = s.slice(0, -1);
    g.fillText(s === t ? s : `${s.slice(0, -1)}…`, left, pad + i * lh);
  });
  return c;
}

export function LabelPrinter({ open, onOpenChange, fixtures, title }: { open: boolean; onOpenChange: (o: boolean) => void; fixtures: { f: PatchedFixture; num: number }[]; title: string }) {
  const [model, setModel] = useState<NiimbotModel>(() => (typeof localStorage !== "undefined" && (localStorage.getItem("nox-niimbot") as NiimbotModel)) || "D110");
  const [size, setSize] = useState<[number, number]>(NIIMBOT_MODELS[model].label);
  const [density, setDensity] = useState(3);
  const [busy, setBusy] = useState("");
  const preview = useRef<HTMLDivElement>(null);
  useEffect(() => { localStorage.setItem("nox-niimbot", model); setSize(NIIMBOT_MODELS[model].label); }, [model]);
  const canvases = useMemo(() => (open ? fixtures.map(({ f, num }) => drawLabel(f, num, size[0], size[1])) : []), [open, fixtures, size]);
  useEffect(() => {
    const el = preview.current; if (!el) return;
    el.replaceChildren(...canvases.slice(0, 12).map((c) => { const i = new Image(); i.src = c.toDataURL(); i.className = "w-full rounded border border-border"; return i; }));
  }, [canvases]);

  const name = safeFileName(title, "patch");
  const savePng = async () => {
    const gap = 8, w = canvases[0]?.width ?? 0;
    const sheet = document.createElement("canvas");
    sheet.width = w; sheet.height = canvases.reduce((h, c) => h + c.height + gap, 0);
    const g = sheet.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, sheet.width, sheet.height);
    let y = 0; for (const c of canvases) { g.drawImage(c, 0, y); y += c.height + gap; }
    const blob = await new Promise<Blob | null>((r) => sheet.toBlob(r, "image/png"));
    if (blob) await saveFile(blob, `${name}-labels.png`);
  };
  const savePdf = async () => {
    const [w, h] = size;
    const doc = new jsPDF({ unit: "mm", format: [w, h], orientation: w > h ? "landscape" : "portrait" });
    canvases.forEach((c, i) => { if (i) doc.addPage([w, h], w > h ? "landscape" : "portrait"); doc.addImage(c.toDataURL("image/png"), "PNG", 0, 0, w, h); });
    await saveFile(doc.output("blob"), `${name}-labels.pdf`);
  };
  const print = async () => {
    setBusy(tr("Connecting…"));
    try { await printLabels(canvases, model, density); setBusy(""); }
    catch (e) { setBusy(""); if ((e as Error).name !== "NotFoundError") alert(`${tr("Printing failed")}: ${(e as Error).message ?? e}`); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Tag className="h-4 w-4 text-primary" />{tr("Patch labels")} · {fixtures.length}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <label className="flex flex-col gap-1">{tr("Niimbot printer")}
            <select className="rounded-md border border-border bg-surface px-2 py-2" value={model} onChange={(e) => setModel(e.target.value as NiimbotModel)}>
              {(Object.keys(NIIMBOT_MODELS) as NiimbotModel[]).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">{tr("Label size (mm)")}
            <select className="rounded-md border border-border bg-surface px-2 py-2" value={size.join("x")} onChange={(e) => setSize(e.target.value.split("x").map(Number) as [number, number])}>
              {(model.startsWith("D") ? ["30x12", "40x12", "22x12", "30x15"] : ["50x30", "40x30", "50x15", "60x40"]).map((s) => <option key={s} value={s}>{s.replace("x", " × ")}</option>)}
            </select>
          </label>
          <label className="col-span-2 flex items-center gap-2">{tr("Density")}
            <input type="range" min={1} max={5} value={density} onChange={(e) => setDensity(Number(e.target.value))} className="flex-1" /><span className="w-4 tabular-nums">{density}</span>
          </label>
        </div>
        <div ref={preview} className="grid max-h-64 grid-cols-2 gap-2 overflow-auto rounded-lg bg-surface p-2" />
        {!fixtures.length && <p className="text-xs text-muted-foreground">{tr("Pick lights in the patch sheet, or all lights are labelled.")}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={savePng} disabled={!canvases.length}><Download />PNG</Button>
          <Button variant="secondary" size="sm" onClick={savePdf} disabled={!canvases.length}><FileText />PDF</Button>
          <Button size="sm" onClick={print} disabled={!canvases.length || !!busy}><Printer />{busy || tr("Print over Bluetooth")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
