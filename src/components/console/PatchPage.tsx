import { MAX_UNIVERSE } from "@/lib/dmx";
import type { CallSheetData } from "@/lib/store";
import { groupNamesOf, groupText, groupsPatch } from "@/lib/fixture-groups";
import { Fragment as Frag, useRef, useState } from "react";
import { ArrowLeft, Printer, Download, Upload, Menu, Pencil, Unplug, ClipboardList, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NumberField } from "./NumberField";
import { PatchPanel, LABEL_COLORS } from "./PatchPanel";
import { FixtureIconPicker } from "./FixtureIconPicker";
import { FixtureGlyph } from "./FixtureGlyph";
import { getDef, normalizeFixture, overlaps, type FixtureDef, type PatchedFixture } from "@/lib/dmx";
import { CallSheet } from "./CallSheet";
import { saveFile, safeFileName } from "@/lib/save-file";
import { buildPatchPdf } from "@/lib/patch-pdf";
import { patchRows, movePatchFixture, movePatchBlock, blockLanding, renamePattern } from "@/lib/patch-order";

import { t as tr } from "@/lib/i18n";
/** Light type + CCT shown in the patch sheet: GDTF-imported values first, otherwise derived from the modes. */
export function describeDef(d: FixtureDef): { type: string; cct: string } {
  const kinds = new Set(d.modes.map((m) => m.kind));
  const colour = ["rgb", "rgbw", "hsi", "full"].some((k) => kinds.has(k as never));
  const dimOnly = [...kinds].every((k) => k === "dim");
  const type = d.lightType ?? (dimOnly ? (/hmi|arrisun|m18|m40|m90|arrimax|compact/i.test(d.model) ? "HMI" : /kino|flo|fluor|lithlight/i.test(`${d.brand} ${d.model}`) ? "Fluorescent" : /led|ribbon|ansso/i.test(`${d.brand} ${d.model}`) ? "LED (dimmer)" : "Tungsten / dimmer") : colour ? "LED colour" : "Bi-colour LED");
  const cct = d.cctRange ? `${d.cctRange[0]}–${d.cctRange[1]} K` : type === "Tungsten / dimmer" ? "3200 K" : type === "HMI" ? "5600 K" : colour || type === "Bi-colour LED" ? "2700–6500 K" : "";
  return { type, cct };
}

/** Full-screen patch sheet with the fixture library and map stacked below it. */
export function PatchPage({ title, callSheet, onCallSheet, fixtures, onClose, onAdd, onRemove, onUpdate, onReplace, onReorder }: {
  title: string; callSheet?: CallSheetData | undefined; onCallSheet?: (c: CallSheetData) => void; fixtures: PatchedFixture[]; onClose: () => void;
  onAdd: (fs: PatchedFixture[]) => void; onRemove: (uids: string[]) => void; onUpdate: (uid: string, p: Partial<PatchedFixture>) => void;
  onReplace: (fs: PatchedFixture[]) => void; onReorder: (fs: PatchedFixture[]) => void;

}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [showCallSheet, setShowCallSheet] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [drag, setDrag] = useState<{ uid: string; target: string } | null>(null);
  const dragRef = useRef<{ uid: string; target: string; y: number; moved: boolean } | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const finishDrag = (cancel = false) => {
    const current = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (cancel || !current?.moved || current.uid === current.target) return;
    const target = fixtures.findIndex((f) => f.uid === current.target);
    if (target < 0) return;
    const block = dragBlock(current.uid);
    onReorder(movePatchBlock(fixtures, block, blockLanding(fixtures, block, target).insertAt));
  };
  /** dragging a picked row carries every picked row with it */
  const dragBlock = (uid: string) => (picked.includes(uid) && picked.length > 1 ? picked : [uid]);
  const landing = (() => {
    if (!drag || drag.uid === drag.target) return null;
    const t = fixtures.findIndex((f) => f.uid === drag.target);
    if (t < 0) return null;
    const block = dragBlock(drag.uid);
    // highlight the slots (current rows) the block will occupy after the drop
    const slots = blockLanding(fixtures, block, t).rows;
    return new Set(slots.map((i) => fixtures[i]?.uid).filter((u): u is string => !!u));
  })();
  const lastPick = useRef<string | null>(null);
  const rowClick = (e: React.MouseEvent, uid: string) => {
    if ((e.target as HTMLElement).closest("input,button,select,a,[role=checkbox]")) return;
    const order = fixtures.map((f) => f.uid);
    if (e.shiftKey && lastPick.current) {
      const a = order.indexOf(lastPick.current), b = order.indexOf(uid);
      const range = order.slice(Math.min(a, b), Math.max(a, b) + 1);
      setPicked((p) => [...new Set([...p, ...range])]);
    } else if (e.ctrlKey || e.metaKey) setPicked((p) => (p.includes(uid) ? p.filter((x) => x !== uid) : [...p, uid]));
    else setPicked((p) => (p.length === 1 && p[0] === uid ? [] : [uid]));
    lastPick.current = uid;
  };
  const bulkRename = () => {
    const pattern = prompt(`Rename ${picked.length} lights.\nUse {n} for the number (e.g. "Key {n}"), or a comma list (e.g. "Key, Fill, Back").`, "Light {n}");
    if (!pattern) return;
    let start = 1, step = 1;
    if (!pattern.includes(",")) {
      const st = prompt("Start number", "1"); if (st === null) return; start = Number(st) || 1;
      const sp = prompt("Step", "1"); if (sp === null) return; step = Number(sp) || 1;
    }
    const order = fixtures.filter((f) => picked.includes(f.uid));
    renamePattern(pattern, order.length, start, step).forEach((name, i) => onUpdate(order[i]!.uid, { name }));
  };
  const each = (p: Partial<PatchedFixture>) => picked.forEach((id) => onUpdate(id, p));
  const unpatch = () => {
    if (!picked.length) return;
    const names = fixtures.filter((f) => picked.includes(f.uid)).map((f) => f.name);
    if (confirm(`Unpatch ${names.length === 1 ? `"${names[0]}"` : `${names.length} fixtures`}? This cannot be undone.`)) { onRemove(picked); setPicked([]); }
  };
  const groupNames = groupNamesOf(fixtures);
  const fileRef = useRef<HTMLInputElement>(null);
  const rows = patchRows(fixtures, null);
  const exportPatch = async () => {
    const data = JSON.stringify({ kind: "nox-patch", version: 1, title, exportedAt: new Date().toISOString(), fixtures }, null, 2);
    try { await saveFile(new Blob([data], { type: "application/json" }), `${safeFileName(title, "patch")}.nox-patch.json`); }
    catch (e) { alert(`Export failed: ${(e as Error).message ?? e}`); }
  };
  const savePdf = async () => {
    try { await saveFile(await buildPatchPdf(title, fixtures), `${safeFileName(title, "patch")}-patch.pdf`); }
    catch (e) { alert(`PDF failed: ${(e as Error).message ?? e}`); }
  };

  const importPatch = async (file: File) => {
    try {
      const json = JSON.parse(await file.text());
      const list: PatchedFixture[] = (Array.isArray(json) ? json : json.fixtures ?? []).map(normalizeFixture);
      if (!list.length) { alert("No fixtures found in this file."); return; }
      const replace = confirm(`Import ${list.length} fixtures.\n\nOK = replace the current patch\nCancel = add them to the current patch`);
      if (replace) onReplace(list);
      else { const ids = new Set(fixtures.map((f) => f.uid)); onAdd(list.map((f) => (ids.has(f.uid) ? { ...f, uid: crypto.randomUUID() } : f))); }
    } catch { alert("This file is not a valid NOX patch."); }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-3 print:hidden">
        <button onClick={onClose} className="mr-auto rounded-lg bg-surface-elevated p-3 text-primary active:scale-95" aria-label={tr("Back to console")}><ArrowLeft className="h-5 w-5" /></button>
        <Button size="sm" variant={panelOpen ? "secondary" : "default"} onClick={() => setPanelOpen((o) => !o)} aria-pressed={panelOpen} title={panelOpen ? "Close the fixture list" : "Open the fixture list and DMX map"}>{panelOpen ? <PanelRightClose /> : <PanelRightOpen />}{panelOpen ? tr("Close fixtures") : tr("Add fixtures")}</Button>
        <Button size="sm" variant="secondary" onClick={savePdf} title={tr("Save the patch sheet as a PDF")}><Printer />{tr("Save PDF")}</Button>
        <Button size="sm" variant="secondary" onClick={exportPatch}><Download />{tr("Export")}</Button>
        <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}><Upload />{tr("Import")}</Button>
        {rows.length === 0 && <span className="ml-auto whitespace-nowrap text-xs tabular-nums text-muted-foreground">{fixtures.length}{tr("fixtures ·")}{new Date().toLocaleDateString("sv-SE")}</span>}
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importPatch(f); e.target.value = ""; }} />
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <main ref={mainRef} className="patch-print min-h-0 flex-1 overflow-auto p-4">
          <div className="mb-3 flex items-center gap-2 border-b border-border pb-2 print:mb-2">
            <h1 className="truncate font-display text-base font-semibold uppercase tracking-wider">{title}{tr("— Patch sheet")}</h1>
          </div>
          {rows.length > 0 && (
            <div className="sticky -top-4 z-10 -mx-4 mb-2 flex flex-wrap items-center gap-1.5 border-b border-border bg-background/95 px-4 py-2 text-xs print:hidden">
              <button onClick={() => setPicked(fixtures.map((f) => f.uid))} className="rounded-md bg-surface-elevated px-2.5 py-1.5 font-semibold">{tr("Select all")}</button>
              <button onClick={() => setPicked([])} disabled={!picked.length} className="rounded-md bg-surface-elevated px-2.5 py-1.5 font-semibold disabled:opacity-40">{tr("Clear")}</button>
              <span className="text-muted-foreground">{picked.length}{tr("selected")}</span>
              {picked.length > 0 && <>
                <span className="ml-2 flex gap-1">{LABEL_COLORS.map((c) => <button key={c} onClick={() => each({ label: c })} aria-label={`Colour ${c}`} className="h-5 w-5 rounded-full border border-border" style={{ background: c }} />)}
                  <button onClick={() => each({ label: undefined } as never)} className="px-1 text-muted-foreground" aria-label={tr("Remove colour")}>×</button></span>
                <button onClick={bulkRename} className="rounded-md bg-surface-elevated px-2.5 py-1.5 font-semibold">{tr("Rename…")}</button>
                <button onClick={() => { const g = prompt(`Groups, comma separated${groupNames.length ? ` (existing: ${groupNames.join(", ")})` : ""} — leave empty to remove all`); if (g !== null) each(groupsPatch(g.split(","))); }} className="rounded-md bg-surface-elevated px-2.5 py-1.5 font-semibold">{tr("Groups…")}</button>
              </>}
              <button onClick={unpatch} disabled={!picked.length} className="ml-auto flex items-center gap-1 rounded-md bg-destructive px-2.5 py-1.5 font-semibold text-destructive-foreground disabled:opacity-40"><Unplug className="h-3.5 w-3.5" />{tr("Unpatch")}{picked.length ? ` (${picked.length})` : tr("")}</button>
              <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{fixtures.length}{tr("fixtures ·")}{new Date().toLocaleDateString("sv-SE")}</span>
            </div>
          )}
          {rows.length === 0 ? <p className="py-16 text-center text-sm text-muted-foreground">{tr("No lights patched yet.")}</p> : (
            <table className="w-full border-collapse text-xs print:text-[9px]">
              <thead><tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="pr-1 print:hidden"></th><th className="py-2 pr-2">#</th><th className="pr-2 print:hidden"></th>
                {([["name", "Name"], ["fixture", "Fixture"], ["mode", "Mode"], ["univ", "Univ"], ["dmx", "DMX"], ["ch", "Ch"], ["group", "Group"]] as const).map(([k, l]) => (
                  <th key={k} className={`pr-2 ${k === "group" ? "print:hidden" : ""}`}>
                    {l}
                  </th>
                ))}
                <th className="print:hidden"></th>
              </tr></thead>
              <tbody>
                {rows.map(({ fixture: f, number }) => {
                  const i = number - 1;
                  const d = getDef(f.defId); const m = d.modes[f.modeIdx]; const ch = m?.channels ?? 1;
                  const clash = overlaps(fixtures, f.universe, f.address, ch, f.uid).length > 0;
                  return (
                    <Frag key={f.uid}><tr data-patch-uid={f.uid} className={`border-b border-border/60 break-inside-avoid ${picked.includes(f.uid) ? "bg-muted/60" : ""} ${drag && dragBlock(drag.uid).includes(f.uid) ? "opacity-50" : ""} ${landing?.has(f.uid) ? "outline outline-2 outline-primary bg-primary/10" : ""} cursor-pointer`} onClick={(e) => rowClick(e, f.uid)}>
                      <td className="pr-2 print:hidden"><Checkbox checked={picked.includes(f.uid)} onCheckedChange={(checked) => setPicked((p) => checked === true ? [...new Set([...p, f.uid])] : p.filter((x) => x !== f.uid))} aria-label={`Select ${f.name}`} className="h-6 w-6" /></td>
                      <td className="py-1.5 pr-2 font-mono text-muted-foreground print:py-0.5">{number}</td>
                      <td className="pr-2 print:hidden"><FixtureGlyph model={d.model} icon={f.icon} colour="var(--color-primary)" className="h-6 w-8" /></td>
                      <td className="pr-2 font-semibold">{f.label && <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: f.label }} />}
                        <input value={f.name} onChange={(e) => onUpdate(f.uid, { name: e.target.value })} aria-label={tr("Fixture name")} className="w-32 bg-transparent font-semibold outline-none focus:border-b focus:border-primary print:w-auto" /></td>
                      <td className="pr-2">{d.brand} {d.model}</td>
                      <td className="pr-2 text-muted-foreground">{m?.name}</td>
                      <td className="pr-2 font-mono">{f.universe}</td>
                      <td className={`pr-2 font-mono ${clash ? "text-destructive" : ""}`}>{f.address}–{f.address + ch - 1}</td>
                      <td className="pr-2 font-mono">{ch}</td>
                      <td className="pr-2 print:hidden">{groupText(f)}</td>
                      <td className="whitespace-nowrap print:hidden">
                        <Button variant="ghost" size="icon" aria-label={`Move ${f.name}`} title={tr("Drag to reorder (selected lights move together)")} className="h-9 w-9 touch-none cursor-grab select-none active:cursor-grabbing"
                          onPointerDown={(e) => {
                            if (e.button !== 0) return;
                            e.preventDefault();
                            e.currentTarget.setPointerCapture(e.pointerId);
                            dragRef.current = { uid: f.uid, target: f.uid, y: e.clientY, moved: false };
                            setDrag({ uid: f.uid, target: f.uid });
                          }}
                          onPointerMove={(e) => {
                            const current = dragRef.current;
                            if (!current) return;
                            if (Math.abs(e.clientY - current.y) > 4) current.moved = true;
                            if (!current.moved) return;
                            const main = mainRef.current;
                            if (main) {
                              const bounds = main.getBoundingClientRect();
                              if (e.clientY < bounds.top + 60) main.scrollTop -= 18;
                              if (e.clientY > bounds.bottom - 60) main.scrollTop += 18;
                            }
                            const row = document.elementsFromPoint(e.clientX, e.clientY).map((el) => el.closest<HTMLElement>("tr[data-patch-uid]")).find(Boolean);
                            const target = row?.dataset["patchUid"];
                            if (target) { current.target = target; setDrag({ uid: current.uid, target }); }
                          }}
                          onPointerUp={() => finishDrag()} onPointerCancel={() => finishDrag(true)} onLostPointerCapture={() => finishDrag(true)}
                          onKeyDown={(e) => {
                            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                            e.preventDefault();
                            onReorder(movePatchFixture(fixtures, f.uid, i + (e.key === "ArrowUp" ? -1 : 1)));
                          }}><Menu className="h-4 w-4" /></Button>
                        <button onClick={() => setEditing(editing === f.uid ? null : f.uid)} className={`p-1 ${editing === f.uid ? "text-primary" : "text-muted-foreground"}`} aria-label={`Edit ${f.name}`}><Pencil className="h-3.5 w-3.5" /></button>
                      </td>
                    </tr>
                    {editing === f.uid && <tr className="print:hidden"><td colSpan={11} className="bg-surface p-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <FixtureIconPicker model={d.model} value={f.icon} onChange={(icon) => onUpdate(f.uid, { icon })} />
                        <div className="space-y-2">
                          <label className="block text-[10px] font-semibold uppercase text-muted-foreground">{tr("Mode")}<select value={f.modeIdx} aria-label={`Mode for ${f.name}`} onChange={(e) => {
                              const modeIdx = Number(e.target.value);
                              const mode = d.modes[modeIdx];
                              if (!mode) return;
                              onUpdate(f.uid, { modeIdx, address: Math.min(f.address, Math.max(1, 513 - mode.channels)) });
                            }} className="mt-1 w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm normal-case text-foreground">
                              {d.modes.map((mode, idx) => <option key={idx} value={idx}>{mode.name} · {mode.channels}{tr("ch")}</option>)}
                            </select>
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-[10px] font-semibold uppercase text-muted-foreground">{tr("Universe")}<NumberField integer min={1} max={MAX_UNIVERSE} value={f.universe} aria-label={`Universe for ${f.name}`} onChange={(v) => { if (v !== undefined) onUpdate(f.uid, { universe: v }); }} className="mt-1 w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground" />
                            </label>
                            <label className="block text-[10px] font-semibold uppercase text-muted-foreground">{tr("DMX address")}<NumberField integer min={1} max={Math.max(1, 513 - ch)} value={f.address} aria-label={`DMX address for ${f.name}`} onChange={(v) => { if (v !== undefined) onUpdate(f.uid, { address: v }); }} className="mt-1 w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground" />
                            </label>
                          </div>
                          {clash && <p role="alert" className="text-[11px] text-destructive">{tr("Overlaps")}{overlaps(fixtures, f.universe, f.address, ch, f.uid).map((fixture) => fixture.name).join(", ")}</p>}
                          <div className="text-[10px] font-semibold uppercase text-muted-foreground">{tr("Colour")}</div>
                          <div className="flex flex-wrap gap-1.5">{LABEL_COLORS.map((c) => <button key={c} onClick={() => onUpdate(f.uid, { label: c })} aria-label={`Colour ${c}`} className={`h-7 w-7 rounded-full border-2 ${f.label === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />)}</div>
                          <label className="block text-[10px] font-semibold uppercase text-muted-foreground">{tr("Groups")}<input list="patch-groups" value={groupText(f)} onChange={(e) => onUpdate(f.uid, groupsPatch(e.target.value.split(",")))} className="w-full normal-case rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" /></label>
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
        {panelOpen && <aside className="absolute inset-0 z-20 w-full overflow-auto bg-background p-3 print:hidden">
          <PatchPanel fixtures={fixtures} onAdd={onAdd} onRemove={onRemove} onUpdate={onUpdate} defaultMap showPatched={false} />
        </aside>}
      </div>
      {showCallSheet && <CallSheet title={title} data={callSheet} onData={onCallSheet} fixtures={fixtures} onClose={() => setShowCallSheet(false)} />}
    </div>
  );
}
