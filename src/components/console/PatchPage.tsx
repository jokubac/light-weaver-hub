import { useRef } from "react";
import { ArrowLeft, Printer, FileDown, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PatchPanel } from "./PatchPanel";
import { FixtureGlyph } from "./FixtureGlyph";
import { getDef, normalizeFixture, overlaps, type PatchedFixture } from "@/lib/dmx";

/** Full-screen patch sheet: printable table in the middle, every fixture + patch editing on the right. */
export function PatchPage({ title, fixtures, onClose, onAdd, onRemove, onUpdate, onReplace }: {
  title: string; fixtures: PatchedFixture[]; onClose: () => void;
  onAdd: (fs: PatchedFixture[]) => void; onRemove: (uids: string[]) => void; onUpdate: (uid: string, p: Partial<PatchedFixture>) => void;
  onReplace: (fs: PatchedFixture[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const rows = [...fixtures].sort((a, b) => a.universe - b.universe || a.address - b.address);
  const totalW = fixtures.reduce((a, f) => a + (f.power?.watts ?? 0), 0);

  const exportPatch = async () => {
    const data = JSON.stringify({ kind: "kroma-patch", version: 1, title, exportedAt: new Date().toISOString(), fixtures }, null, 2);
    const name = `${title.replace(/[^\w-]+/g, "_") || "patch"}.kroma-patch.json`;
    const picker = (window as Window & { showSaveFilePicker?: (o: object) => Promise<any> }).showSaveFilePicker;
    if (picker) {
      try {
        const h = await picker({ suggestedName: name, types: [{ description: "KROMA patch", accept: { "application/json": [".json"] } }] });
        const w = await h.createWritable(); await w.write(data); await w.close(); return;
      } catch (e) { if ((e as Error).name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importPatch = async (file: File) => {
    try {
      const json = JSON.parse(await file.text());
      const list: PatchedFixture[] = (Array.isArray(json) ? json : json.fixtures ?? []).map(normalizeFixture);
      if (!list.length) { alert("No fixtures found in this file."); return; }
      const replace = confirm(`Import ${list.length} fixtures.\n\nOK = replace the current patch\nCancel = add them to the current patch`);
      if (replace) onReplace(list);
      else { const ids = new Set(fixtures.map((f) => f.uid)); onAdd(list.map((f) => (ids.has(f.uid) ? { ...f, uid: crypto.randomUUID() } : f))); }
    } catch { alert("This file is not a valid KROMA patch."); }
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-3 print:hidden">
        <button onClick={onClose} className="rounded-lg bg-surface-elevated p-3 text-primary active:scale-95" aria-label="Back to console"><ArrowLeft className="h-5 w-5" /></button>
        <div className="mr-auto min-w-0"><div className="font-display text-lg font-semibold">Patch</div><div className="truncate text-xs text-muted-foreground">{title}</div></div>
        <Button variant="secondary" onClick={() => window.print()}><Printer />Print</Button>
        <Button variant="secondary" onClick={() => window.print()} title="Choose “Save as PDF” in the print dialog"><FileDown />PDF</Button>
        <Button variant="secondary" onClick={exportPatch}><Download />Export</Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload />Import</Button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importPatch(f); e.target.value = ""; }} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="patch-print min-h-0 flex-1 overflow-auto p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h1 className="font-display text-xl font-semibold">{title} — Patch sheet</h1>
            <span className="text-xs text-muted-foreground">{fixtures.length} fixtures{totalW ? ` · ${totalW} W` : ""} · {new Date().toLocaleDateString()}</span>
          </div>
          {rows.length === 0 ? <p className="py-16 text-center text-sm text-muted-foreground">No lights patched yet. Add them from the list on the right.</p> : (
            <table className="w-full border-collapse text-xs">
              <thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-2">#</th><th className="pr-2"></th><th className="pr-2">Name</th><th className="pr-2">Fixture</th><th className="pr-2">Mode</th><th className="pr-2">Univ</th><th className="pr-2">DMX</th><th className="pr-2">Ch</th><th className="pr-2">Group</th><th>W</th>
              </tr></thead>
              <tbody>
                {rows.map((f, i) => {
                  const d = getDef(f.defId); const m = d.modes[f.modeIdx]; const ch = m?.channels ?? 1;
                  const clash = overlaps(fixtures, f.universe, f.address, ch, f.uid).length > 0;
                  return (
                    <tr key={f.uid} className="border-b border-border/60 break-inside-avoid">
                      <td className="py-1.5 pr-2 text-muted-foreground">{i + 1}</td>
                      <td className="pr-2"><FixtureGlyph model={d.model} icon={f.icon} colour="var(--color-primary)" className="h-6 w-8" /></td>
                      <td className="pr-2 font-semibold">{f.label && <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: f.label }} />}{f.name}</td>
                      <td className="pr-2">{d.brand} {d.model}</td>
                      <td className="pr-2 text-muted-foreground">{m?.name}</td>
                      <td className="pr-2 font-mono">{f.universe}</td>
                      <td className={`pr-2 font-mono ${clash ? "text-destructive" : ""}`}>{f.address}–{f.address + ch - 1}</td>
                      <td className="pr-2 font-mono">{ch}</td>
                      <td className="pr-2">{f.group ?? ""}</td>
                      <td className="font-mono">{f.power?.watts ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </main>
        <aside className="max-h-[55vh] w-full shrink-0 overflow-auto border-t border-border bg-surface p-4 print:hidden lg:max-h-none lg:w-[26rem] lg:border-l lg:border-t-0">
          <PatchPanel fixtures={fixtures} onAdd={onAdd} onRemove={onRemove} onUpdate={onUpdate} defaultMap={false} />
        </aside>
      </div>
    </div>
  );
}
