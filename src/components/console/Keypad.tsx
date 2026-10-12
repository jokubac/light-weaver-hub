import { useState } from "react";
import { X } from "lucide-react";
import { parseCommand } from "@/lib/command-line";

interface Props {
  count: number;
  onRun: (select: number[] | undefined, level: number | undefined, cct?: number) => void;
  onStep: (dir: 1 | -1) => void;
  onClose: () => void;
}

const KEYS = ["7", "8", "9", "THRU", "4", "5", "6", "+", "1", "2", "3", "-", "CLR", "0", "@", "FULL"];

export function Keypad({ count, onRun, onStep, onClose }: Props) {
  const [cmd, setCmd] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
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
    <div aria-label="Keypad" className="w-full max-w-xs space-y-2 rounded-xl border border-border bg-surface p-3 shadow-lg">
      <div className="flex items-center gap-2">
        <input aria-label="Command line" value={cmd} onChange={(e) => { setCmd(e.target.value); setMsg(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); run(); } }}
          placeholder="1 + 3 @ 80 CCT 3200" className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-2 font-mono text-sm" />
        <button onClick={onClose} aria-label="Close keypad" className="rounded-md p-2 text-muted-foreground"><X className="h-4 w-4" /></button>
      </div>
      <p className={`h-4 text-[11px] ${msg?.startsWith("✓") ? "text-success" : "text-destructive"}`}>{msg}</p>
      <div className="grid grid-cols-4 gap-1.5">
        {KEYS.map((x) => (
          <button key={x} onClick={() => press(x)} className={`${k} ${/^\d$/.test(x) ? "" : "text-primary"}`}>{x}</button>
        ))}
        <button onClick={() => onStep(-1)} className={k}>LAST</button>
        <button onClick={() => onStep(1)} className={k}>NEXT</button>
        <button onClick={() => press("OUT")} className={`${k} text-primary`}>OUT</button>
        <button onClick={() => press("CCT")} className={`${k} col-span-4 text-primary`}>CCT (kelvin)</button>
        <button onClick={run} className="rounded-lg bg-primary py-3 text-sm font-black text-primary-foreground active:scale-95">ENTER</button>
      </div>
    </div>
  );
}
