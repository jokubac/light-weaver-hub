import { useEffect, useRef, useState } from "react";
import { GripVertical, X } from "lucide-react";
import { parseCommand } from "@/lib/command-line";

interface Props {
  count: number;
  selectedNums: number[];
  onRun: (select: number[] | undefined, level: number | undefined, cct?: number) => void;
  onStep: (dir: 1 | -1) => void;
  onClose: () => void;
}

const KEYS = ["7", "8", "9", "THRU", "4", "5", "6", "+", "1", "2", "3", "-", "CLR", "0", "@", "FULL"];

export function Keypad({ count, selectedNums, onRun, onStep, onClose }: Props) {
  const [cmd, setCmd] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  useEffect(() => { setPos({ x: Math.max(8, window.innerWidth - 344), y: Math.max(16, window.innerHeight - 420) }); }, []);
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
    onRun(r.select, r.level, r.cct);
    setMsg(`✓ ${cmd.trim()}`);
    setCmd("");
  };
  const k = "rounded-lg bg-surface-elevated py-3 text-sm font-bold active:scale-95";
  return (
    <div aria-label="Keypad" style={{ left: pos.x, top: pos.y }} className="fixed z-40 w-[22rem] max-w-[calc(100vw-1rem)] space-y-2 rounded-xl border border-border bg-surface p-3 shadow-lg">
      <div className="flex items-center gap-2">
        <button aria-label="Drag keypad" title="Drag to move" style={{ touchAction: "none" }} className="cursor-grab rounded-md p-1 text-muted-foreground active:cursor-grabbing"
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }; }}
          onPointerMove={(e) => { if (drag.current) setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy)); }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}><GripVertical className="h-5 w-5" /></button>
        <input aria-label="Command line" value={cmd} onChange={(e) => { setCmd(e.target.value); setMsg(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); run(); } }}
          placeholder="1 + 3 @ 80 CCT 3200" className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-2 font-mono text-sm" />
        <button onClick={onClose} aria-label="Close keypad" className="rounded-md p-2 text-muted-foreground"><X className="h-4 w-4" /></button>
      </div>
      <p className={`truncate text-[11px] ${msg && !msg.startsWith("✓") ? "text-destructive" : "text-muted-foreground"}`}>{msg && !msg.startsWith("✓") ? msg : selectedNums.length ? `Selected: ${selectedNums.map((n) => `#${n}`).join(" + ")}` : "No fixtures selected"}</p>
      <div className="flex gap-1.5"><div className="grid flex-1 grid-cols-4 gap-1.5">
        {KEYS.map((x) => (
          <button key={x} onClick={() => press(x)} className={`${k} ${/^\d$/.test(x) ? "" : "text-primary"}`}>{x}</button>
        ))}
        <button onClick={() => onStep(-1)} className={k}>LAST</button>
        <button onClick={() => onStep(1)} className={k}>NEXT</button>
        <button onClick={() => press("OUT")} className={`${k} text-primary`}>OUT</button>
        <button onClick={() => press("CCT")} className={`${k} text-primary`}>CCT</button>
        </div>
        <button onClick={run} className="w-16 rounded-lg bg-primary text-base font-black text-primary-foreground active:scale-95">Please</button>
        </div>
      </div>
    </div>
  );
}
