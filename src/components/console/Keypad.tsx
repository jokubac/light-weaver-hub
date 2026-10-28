import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ClipboardPaste, Copy, Delete, GripVertical, Undo2, Redo2, X } from "lucide-react";
import { parseCommand, type CommandResult } from "@/lib/command-line";
import { Button } from "@/components/ui/button";

import { t as tr } from "@/lib/i18n";
interface Props {
  count: number;
  selectedNums?: number[];
  onRun: (select: number[] | undefined, level: number | undefined, cct?: number, levelDelta?: number, cctDelta?: number, pattern?: { step: number; offset: number }) => void;
  onStep: (dir: 1 | -1) => void;
  /** REC from the command line; returns a confirmation or an error message */
  onRec?: (rec: NonNullable<CommandResult["rec"]>, select?: number[]) => string;
  onFlash: () => void;
  onPreview?: (select: number[]) => void;
  onCopy?: () => void;
  onPaste?: () => void;
  canPaste?: boolean;
  onClose: () => void;
  onDeselect: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

const KEYS = ["7", "8", "9", "THRU", "4", "5", "6", "+", "1", "2", "3", "-", "OUT", "0", ".", "@", "FULL"];

export function Keypad({ count, selectedNums = [], onRun, onStep, onRec, onFlash, onPreview, onCopy, onPaste, canPaste, onClose, onDeselect, onUndo, onRedo, canUndo, canRedo }: Props) {
  const [cmd, setCmd] = useState("");
  const [ext, setExt] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pos, setPos] = useState({ x: -9999, y: -9999 });
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  // live selection while typing: "6" picks #6, "6 + 9" adds #9 before Please is pressed
  useEffect(() => {
    const head = (cmd.split(/@|CCT/i)[0] ?? "").replace(/[\s+\-]+$|THRU\s*$/gi, "").trim();
    if (!/\d/.test(head)) return;
    const r = parseCommand(head, count);
    if (!r.error && r.select?.length) onPreview?.(r.select);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmd, count]);
  useLayoutEffect(() => { setPos({ x: Math.max(8, window.innerWidth - 344), y: Math.max(16, window.innerHeight - 420) }); }, []);
  const clamp = (x: number, y: number) => ({ x: Math.min(Math.max(0, x), window.innerWidth - 120), y: Math.min(Math.max(0, y), window.innerHeight - 60) });
  const press = (k: string) => {
    setMsg(null);
    if (k === "CLR") return setCmd("");
    const word = /^[A-Z+@-]+$/.test(k);
    setCmd((c) => (word ? `${c.trimEnd()} ${k} ` : c + k).replace(/^\s+/, ""));
  };
  const run = () => {
    const r = parseCommand(cmd, count);
    if (r.error) { setMsg(r.error); return; }
    onRun(r.select, r.level, r.cct, r.levelDelta, r.cctDelta, r.pattern);
    if (r.rec) { const m = onRec?.(r.rec, r.select) ?? "REC is not available here"; if (!m.startsWith("✓")) { setMsg(m); return; } }
    setMsg(`✓ ${cmd.trim()}`);
    setCmd("");
  };
  const k = "rounded-lg bg-surface-elevated py-3 text-sm font-bold active:scale-95";
  return (
    <div aria-label={tr("Keypad")} style={{ left: pos.x, top: pos.y }} className={`fixed z-40 ${ext ? "w-[30rem]" : "w-[22rem]"} max-w-[calc(100vw-1rem)] space-y-2 rounded-xl border border-border bg-surface p-3 shadow-lg`}>
      <div className="flex items-center gap-2">
        <button aria-label={tr("Drag keypad")} title={tr("Drag to move")} style={{ touchAction: "none" }} className="cursor-grab rounded-md p-1 text-muted-foreground active:cursor-grabbing"
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }; }}
          onPointerMove={(e) => { if (drag.current) setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy)); }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}><GripVertical className="h-5 w-5" /></button>
        <input aria-label={tr("Command line")} value={cmd} onChange={(e) => { setCmd(e.target.value); setMsg(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); run(); } }}
          placeholder={tr("1 + 3 @ 80 CCT 3200")} className="min-w-0 flex-1 font-mono rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
        <button onClick={() => { setMsg(null); setCmd((c) => (c.endsWith(" ") ? c.trimEnd().replace(/\S+$/, "") : c.slice(0, -1)).replace(/^\s+/, "")); }} aria-label={tr("Backspace")} title={tr("Delete last")} className="rounded-md bg-surface-elevated p-2 text-foreground active:scale-95"><Delete className="h-4 w-4" /></button>
        <button onClick={() => setExt((e) => !e)} aria-pressed={ext} title={tr("Extended keypad")} className={`rounded-md px-2 py-1.5 text-[11px] font-bold ${ext ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>{tr("EXT")}</button>
        <button onClick={onClose} aria-label={tr("Close keypad")} className="rounded-md p-2 text-muted-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex items-center gap-2">
      <p className={`min-w-0 flex-1 truncate text-[11px] ${msg && !msg.startsWith("✓") ? "text-destructive" : "text-muted-foreground"}`}>{msg && !msg.startsWith("✓") ? msg : selectedNums.length ? `Selected: ${selectedNums.map((n) => `#${n}`).join(" + ")}` : tr("No fixtures selected")}</p>
        <Button size="icon" variant="secondary" aria-label={tr("Undo fixture changes")} title={tr("Undo fixture changes")} disabled={!canUndo} onClick={onUndo}><Undo2 /></Button>
        <Button size="icon" variant="secondary" aria-label={tr("Redo fixture changes")} title={tr("Redo fixture changes")} disabled={!canRedo} onClick={onRedo}><Redo2 /></Button>
      </div>
      <div className="flex gap-1.5">
        {ext && <div className="grid w-24 shrink-0 grid-cols-1 gap-1.5" aria-label={tr("Extended keys")}>
          {["REC", "MERGE", "OVERWRITE"].map((x) => <button key={x} title={x === "REC" ? tr("REC = cue · REC 5 · REC LOOK · REC FX · REC TIMELINE") : tr("Use after REC N")} onClick={() => press(x)} className={`${k} ${x === "REC" ? "text-destructive" : "text-primary"} text-[11px]`}>{x}</button>)}
          {["ODD", "EVEN", "NTH", "."].map((x) => <button key={x} title={x === "ODD" ? tr("Every other light — of the typed range, or of the selection (also expanded pixels)") : x === "EVEN" ? tr("Every other light, starting from the 2nd") : x === "NTH" ? tr("Every Nth light — e.g. 1 THRU 16 NTH 3") : undefined} onClick={() => (x === "." ? setCmd((c) => c + ".") : press(x))} className={`${k} text-primary`}>{x}</button>)}
          {["@ 10", "@ 25", "@ 50", "@ 75"].map((x) => <button key={x} onClick={() => setCmd((c) => `${c.split("@")[0]!.trimEnd()} ${x}`.trimStart())} className={k}>{x}</button>)}
          <button onClick={() => setCmd((c) => `${c.split("@")[0]!.trimEnd()} @ +10`.trimStart())} className={k}>+10%</button>
          <button onClick={() => setCmd((c) => `${c.split("@")[0]!.trimEnd()} @ -10`.trimStart())} className={k}>−10%</button>
          <button onClick={() => press("CLR")} className={`${k} text-destructive`}>{tr("CLR")}</button>
        </div>}
        <div className="grid flex-1 grid-cols-4 gap-1.5">
        {KEYS.map((x) => (
          <button key={x} onClick={() => press(x)} className={`${k} ${/^\d$/.test(x) ? "" : "text-primary"}`}>{x}</button>
        ))}
        <button onClick={() => onStep(-1)} className={k}>{tr("LAST")}</button>
        <button onClick={() => onStep(1)} className={k}>{tr("NEXT")}</button>
        <button onClick={() => press("CLR")} className={`${k} text-destructive`}>{tr("CLR")}</button>
        <button onClick={() => press("CCT")} className={`${k} col-span-2 text-primary`}>{tr("CCT")}</button>
        <button onClick={onCopy} disabled={!selectedNums.length} title={tr("Copy settings from the first selected light")} className={`${k} col-span-2 flex items-center justify-center gap-1 disabled:opacity-40`}><Copy className="h-4 w-4" />{tr("COPY")}</button>
        <button onClick={onPaste} disabled={!canPaste || !selectedNums.length} title={tr("Paste copied settings to the selected lights")} className={`${k} col-span-2 flex items-center justify-center gap-1 disabled:opacity-40`}><ClipboardPaste className="h-4 w-4" />{tr("PASTE")}</button>
        <button onClick={() => setCmd((c) => `${c.split("@")[0]!.trimEnd()} @ 50`.trimStart())} className={k}>@ 50</button>
        <button onClick={() => setCmd((c) => `${c.split("@")[0]!.trimEnd()} @ 25`.trimStart())} className={k}>@ 25</button>
        </div>
        <div className="flex w-20 flex-col gap-1.5">
          <button onClick={onFlash} disabled={!selectedNums.length} title={tr("Flash selected lights to check them")} className="rounded-lg bg-amber-glow py-3 text-xs font-black text-primary-foreground active:scale-95 disabled:opacity-40">{tr("FLASH")}</button>
          <Button variant="secondary" onClick={() => { setMsg(null); setCmd(""); }} onDoubleClick={onDeselect} title={tr("Clear command; double-click to deselect fixtures")} className="h-auto flex-1 rounded-lg text-sm font-black text-destructive active:scale-95">{tr("CLEAR")}</Button>
          <button onClick={run} className="flex-[1.5] rounded-lg bg-primary text-base font-black text-primary-foreground active:scale-95">{tr("Please")}</button>
        </div>
      </div>
    </div>
  );
}
