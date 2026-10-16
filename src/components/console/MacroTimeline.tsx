import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MACRO_ACTIONS } from "@/lib/macros";
import type { MacroLogEntry } from "@/lib/macro-log";

const label = (e: MacroLogEntry) => {
  const a = MACRO_ACTIONS.find((x) => x.id === e.macro.action);
  return `${a?.label ?? e.macro.action}${a?.unit ? ` ${e.macro.amount}${a.unit}` : ""}`;
};
const time = (at: number) => {
  const d = new Date(at);
  return `${d.toLocaleTimeString([], { hour12: false })}.${String(d.getMilliseconds()).padStart(3, "0")}`;
};

export function MacroTimeline({ open, onOpenChange, log, recording, setRecording, onClear, onReplay, onStop, playing }: {
  open: boolean; onOpenChange: (o: boolean) => void; log: MacroLogEntry[];
  recording: boolean; setRecording: (r: boolean) => void; onClear: () => void;
  onReplay: (entries: MacroLogEntry[], speed: number) => void; onStop: () => void; playing: string | null;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [speed, setSpeed] = useState(1);
  const chosen = picked.length ? log.filter((e) => picked.includes(e.id)) : log;
  const t0 = log[0]?.at ?? 0;
  const btn = "rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-40";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Macro timeline</DialogTitle></DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <button className={`${btn} ${recording ? "bg-destructive text-destructive-foreground" : ""}`} onClick={() => setRecording(!recording)}>{recording ? "● Logging" : "○ Logging off"}</button>
          {playing ? <button className={btn} onClick={onStop}>■ Stop</button>
            : <button className={`${btn} bg-primary text-primary-foreground`} disabled={!chosen.length} onClick={() => onReplay(chosen, speed)}>▶ Replay {picked.length ? `${picked.length} selected` : "all"}</button>}
          <select aria-label="Replay speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded-md border border-border bg-surface-elevated px-2 py-1.5 text-xs">
            {[0.5, 1, 2, 4].map((s) => <option key={s} value={s}>{s}×</option>)}
          </select>
          {picked.length > 0 && <button className={btn} onClick={() => setPicked([])}>Clear selection</button>}
          <button className={`${btn} ml-auto text-destructive`} disabled={!log.length} onClick={() => { onClear(); setPicked([]); }}>Clear log</button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border">
          {!log.length && <p className="p-4 text-sm text-muted-foreground">No macros yet — press a macro key, MIDI button or GRID macro.</p>}
          {log.map((e) => (
            <button key={e.id} onClick={() => setPicked((p) => (p.includes(e.id) ? p.filter((x) => x !== e.id) : [...p, e.id]))}
              className={`flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-0 ${picked.includes(e.id) ? "bg-primary/15" : ""} ${playing === e.id ? "ring-1 ring-inset ring-primary" : ""}`}>
              <span className="w-28 font-mono text-xs text-muted-foreground">{time(e.at)}</span>
              <span className="w-16 font-mono text-xs text-muted-foreground">+{((e.at - t0) / 1000).toFixed(2)}s</span>
              <span className="flex-1">{label(e)}</span>
              <span className="text-xs uppercase text-muted-foreground">{e.source}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
