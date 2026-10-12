import { Fragment as Frag, useRef, useState } from "react";
import { ArrowLeft, Printer, Download, Upload, ArrowUp, ArrowDown, Pencil, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PatchPanel, LABEL_COLORS } from "./PatchPanel";
import { FixtureIconPicker } from "./FixtureIconPicker";
import { FixtureGlyph } from "./FixtureGlyph";
import { getDef, normalizeFixture, overlaps, type PatchedFixture } from "@/lib/dmx";

/** Full-screen patch sheet: printable table in the middle, every fixture + patch editing on the right. */
export function PatchPage({ title, fixtures, onClose, onAdd, onRemove, onUpdate, onReplace, onReorder }: {
  title: string; fixtures: PatchedFixture[]; onClose: () => void;
  onAdd: (fs: PatchedFixture[]) => void; onRemove: (uids: string[]) => void; onUpdate: (uid: string, p: Partial<PatchedFixture>) => void;
  onReplace: (fs: PatchedFixture[]) => void; onReorder: (fs: PatchedFixture[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const move = (i: number, d: number) => { const fs = [...fixtures]; const j = i + d; if (j < 0 || j >= fs.length) return; [fs[i], fs[j]] = [fs[j]!, fs[i]!]; onReorder(fs); };
  const each = (p: Partial<PatchedFixture>) => picked.forEach((id) => onUpdate(id, p));
  const unpatch = () => {
    if (!picked.length) return;
    const names = fixtures.filter((f) => picked.includes(f.uid)).map((f) => f.name);
    if (confirm(`Unpatch ${names.length === 1 ? `"${names[0]}"` : `${names.length} fixtures`}? This cannot be undone.`)) { onRemove(picked); setPicked([]); }
  };
  const groupNames = Array.from(new Set(fixtures.map((f) => f.group).filter(Boolean))) as string[];
  const fileRef = useRef<HTMLInputElement>(null);
  const rows = fixtures;
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
        <Button variant="secondary" onClick={() => window.print()} title="Print, or choose “Save as PDF” in the print dialog"><Printer />Print / PDF</Button>
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
          {rows.length > 0 && (
            <div className="sticky -top-4 z-10 -mx-4 mb-2 flex flex-wrap items-center gap-1.5 border-b border-border bg-background/95 px-4 py-2 text-xs print:hidden">
              <button onClick={() => setPicked(fixtures.map((f) => f.uid))} className="rounded-md bg-surface-elevated px-2.5 py-1.5 font-semibold">Select all</button>
              <button onClick={() => setPicked([])} disabled={!picked.length} className="rounded-md bg-surface-elevated px-2.5 py-1.5 font-semibold disabled:opacity-40">Clear</button>
              <span className="text-muted-foreground">{picked.length} selected</span>
              {picked.length > 0 && <>
                <span className="ml-2 flex gap-1">{LABEL_COLORS.map((c) => <button key={c} onClick={() => each({ label: c })} aria-label={`Colour ${c}`} className="h-5 w-5 rounded-full border border-border" style={{ background: c }} />)}
                  <button onClick={() => each({ label: undefined })} className="px-1 text-muted-foreground" aria-label="Remove colour">×</button></span>
                <button onClick={() => { const g = prompt(`Group name${groupNames.length ? ` (existing: ${groupNames.join(", ")})` : ""} — leave empty to remove`); if (g !== null) each({ group: g.trim() || undefined }); }} className="rounded-md bg-surface-elevated px-2.5 py-1.5 font-semibold">Group…</button>
              </>}
              <button onClick={unpatch} disabled={!picked.length} className="ml-auto flex items-center gap-1 rounded-md bg-destructive px-2.5 py-1.5 font-semibold text-destructive-foreground disabled:opacity-40"><Unplug className="h-3.5 w-3.5" />Unpatch{picked.length ? ` (${picked.length})` : ""}</button>
            </div>
          )}
          {rows.length === 0 ? <p className="py-16 text-center text-sm text-muted-foreground">No lights patched yet. Add them from the list on the right.</p> : (
            <table className="w-full border-collapse text-xs">
              <thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="pr-1 print:hidden"></th><th className="py-2 pr-2">#</th><th className="pr-2"></th><th className="pr-2">Name</th><th className="pr-2">Fixture</th><th className="pr-2">Mode</th><th className="pr-2">Univ</th><th className="pr-2">DMX</th><th className="pr-2">Ch</th><th className="pr-2">Group</th><th className="pr-2">W</th><th className="print:hidden"></th>
              </tr></thead>
              <tbody>
                {rows.map((f, i) => {
                  const d = getDef(f.defId); const m = d.modes[f.modeIdx]; const ch = m?.channels ?? 1;
                  const clash = overlaps(fixtures, f.universe, f.address, ch, f.uid).length > 0;
                  return (
                    <Frag key={f.uid}><tr className={`border-b border-border/60 break-inside-avoid ${picked.includes(f.uid) ? "bg-primary/10" : ""}`}>
                      <td className="pr-1 print:hidden"><input type="checkbox" checked={picked.includes(f.uid)} onChange={() => setPicked((p) => (p.includes(f.uid) ? p.filter((x) => x !== f.uid) : [...p, f.uid]))} aria-label={`Select ${f.name}`} className="h-4 w-4 accent-primary" /></td>
                      <td className="py-1.5 pr-2 text-muted-foreground">{i + 1}</td>
                      <td className="pr-2"><FixtureGlyph model={d.model} icon={f.icon} colour="var(--color-primary)" className="h-6 w-8" /></td>
                      <td className="pr-2 font-semibold">{f.label && <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: f.label }} />}
                        <input value={f.name} onChange={(e) => onUpdate(f.uid, { name: e.target.value })} aria-label="Fixture name" className="w-32 bg-transparent font-semibold outline-none focus:border-b focus:border-primary print:w-auto" /></td>
                      <td className="pr-2">{d.brand} {d.model}</td>
                      <td className="pr-2 text-muted-foreground">{m?.name}</td>
                      <td className="pr-2 font-mono">{f.universe}</td>
                      <td className={`pr-2 font-mono ${clash ? "text-destructive" : ""}`}>{f.address}–{f.address + ch - 1}</td>
                      <td className="pr-2 font-mono">{ch}</td>
                      <td className="pr-2">{f.group ?? ""}</td>
                      <td className="pr-2 font-mono">{f.power?.watts ?? ""}</td>
                      <td className="whitespace-nowrap print:hidden">
                        <button disabled={i === 0} onClick={() => move(i, -1)} className="p-1 disabled:opacity-30" aria-label={`Move ${f.name} up`}><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="p-1 disabled:opacity-30" aria-label={`Move ${f.name} down`}><ArrowDown className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setEditing(editing === f.uid ? null : f.uid)} className={`p-1 ${editing === f.uid ? "text-primary" : "text-muted-foreground"}`} aria-label={`Edit ${f.name}`}><Pencil className="h-3.5 w-3.5" /></button>
                      </td>
                    </tr>
                    {editing === f.uid && <tr className="print:hidden"><td colSpan={12} className="bg-surface p-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <FixtureIconPicker model={d.model} value={f.icon} onChange={(icon) => onUpdate(f.uid, { icon })} />
                        <div className="space-y-2">
                          <div className="text-[10px] font-semibold uppercase text-muted-foreground">Colour</div>
                          <div className="flex flex-wrap gap-1.5">{LABEL_COLORS.map((c) => <button key={c} onClick={() => onUpdate(f.uid, { label: c })} aria-label={`Colour ${c}`} className={`h-7 w-7 rounded-full border-2 ${f.label === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />)}</div>
                          <label className="block text-[10px] font-semibold uppercase text-muted-foreground">Group
                            <input list="patch-groups" value={f.group ?? ""} onChange={(e) => onUpdate(f.uid, { group: e.target.value || undefined })} className="mt-1 w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm normal-case text-foreground" /></label>
                        </div>
                      </div>
                    </td></tr>}</Frag>
                  );
                })}
              </tbody>
            </table>
          )}
          {rows.length > 0 && (
            <datalist id="patch-groups">{groupNames.map((g) => <option key={g} value={g} />)}</datalist>
          )}
        </main>
        <aside className="max-h-[55vh] w-full shrink-0 overflow-auto border-t border-border bg-surface p-4 print:hidden lg:max-h-none lg:w-[26rem] lg:border-l lg:border-t-0">
          <PatchPanel fixtures={fixtures} onAdd={onAdd} onRemove={onRemove} onUpdate={onUpdate} defaultMap={false} showPatched={false} />
        </aside>
      </div>
    </div>
  );
}
