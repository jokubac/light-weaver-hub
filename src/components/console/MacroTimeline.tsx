import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MACRO_ACTIONS } from "@/lib/macros";
import { loadTakes, retime, saveTakes, type MacroLogEntry, type MacroTake } from "@/lib/macro-log";

const label = (e: MacroLogEntry) => {
  const a = MACRO_ACTIONS.find((x) => x.id === e.macro.action);
  return `${a?.label ?? e.macro.action}${a?.unit ? ` ${e.macro.amount}${a.unit}` : ""}`;
};
const time = (at: number) => {
  const d = new Date(at);
  return `${d.toLocaleTimeString([], { hour12: false })}.${String(d.getMilliseconds()).padStart(3, "0")}`;
};
const field = "rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

export function MacroTimeline({ open, onOpenChange, log, setLog, recording, setRecording, onReplay, onStop, playing }: {
  open: boolean; onOpenChange: (o: boolean) => void; log: MacroLogEntry[]; setLog: (l: MacroLogEntry[]) => void;
  recording: boolean; setRecording: (r: boolean) => void;
  onReplay: (entries: MacroLogEntry[], speed: number) => void; onStop: () => void; playing: string | null;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [speed, setSpeed] = useState(1);
  const [takes, setTakes] = useState<MacroTake[]>([]);
  const [view, setView] = useState<string>("live"); // "live" or a take id
  useEffect(() => { setTakes(loadTakes()); }, []);
  const putTakes = (t: MacroTake[]) => { setTakes(t); saveTakes(t); };
  const take = takes.find((t) => t.id === view);
  const entries = take ? take.entries : log;
  const setEntries = (e: MacroLogEntry[]) => (take ? putTakes(takes.map((t) => (t.id === take.id ? { ...t, entries: e } : t))) : setLog(e));
  const chosen = picked.length ? entries.filter((e) => picked.includes(e.id)) : entries;
  const t0 = entries[0]?.at ?? 0;
  const btn = "rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-40";
  const saveTake = () => {
    const src = chosen;
    if (!src.length) return;
    const t: MacroTake = { id: Math.random().toString(36).slice(2, 9), name: `Take ${takes.length + 1}`, saved: Date.now(), entries: src.map((e) => ({ ...e })) };
    putTakes([...takes, t]); setView(t.id); setPicked([]);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Macro timeline</DialogTitle></DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Show" value={view} onChange={(e) => { setView(e.target.value); setPicked([]); }} className={field}>
            <option value="live">Live log ({log.length})</option>
            {takes.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.entries.length})</option>)}
          </select>
          {!take && <button className={`${btn} ${recording ? "bg-destructive text-destructive-foreground" : ""}`} onClick={() => setRecording(!recording)}>{recording ? "● Logging" : "○ Logging off"}</button>}
          {playing ? <button className={btn} onClick={onStop}>■ Stop</button>
            : <button className={`${btn} bg-primary text-primary-foreground`} disabled={!chosen.length} onClick={() => onReplay(chosen, speed)}>▶ Replay {picked.length ? `${picked.length} selected` : "all"}</button>}
          <select aria-label="Replay speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded-md border border-border bg-surface-elevated px-2 py-1.5 text-xs">
            {[0.5, 1, 2, 4].map((s) => <option key={s} value={s}>{s}×</option>)}
          </select>
          <button className={btn} disabled={!chosen.length} onClick={saveTake}>Save {picked.length ? "selected" : ""} as take</button>
          {picked.length > 0 && <button className={btn} onClick={() => setEntries(entries.filter((e) => !picked.includes(e.id)))}>Delete selected</button>}
          {take
            ? <button className={`${btn} ml-auto text-destructive`} onClick={() => { putTakes(takes.filter((t) => t.id !== take.id)); setView("live"); }}>Delete take</button>
            : <button className={`${btn} ml-auto text-destructive`} disabled={!log.length} onClick={() => { setLog([]); setPicked([]); }}>Clear log</button>}
        </div>
        {take && <input aria-label="Take name" value={take.name} onChange={(e) => putTakes(takes.map((t) => (t.id === take.id ? { ...t, name: e.target.value } : t)))} className={`${field} w-full`} />}
        <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border">
          {!entries.length && <p className="p-4 text-sm text-muted-foreground">{take ? "This take is empty." : recording ? "No macros yet — press a macro key, MIDI button or GRID macro." : "Logging is off. Turn it on to record macros."}</p>}
          {entries.map((e) => (
            <div key={e.id} onClick={() => setPicked((p) => (p.includes(e.id) ? p.filter((x) => x !== e.id) : [...p, e.id]))}
              className={`flex w-full cursor-pointer items-center gap-3 border-b border-border px-3 py-1.5 text-left text-sm last:border-0 ${picked.includes(e.id) ? "bg-primary/15" : ""} ${playing === e.id ? "ring-1 ring-inset ring-primary" : ""}`}>
              <span className="w-24 font-mono text-xs text-muted-foreground">{time(e.at)}</span>
              <label className="flex items-center gap-1 font-mono text-xs text-muted-foreground" onClick={(ev) => ev.stopPropagation()}>+
                <input aria-label="Time offset in seconds" type="number" step={0.1} min={0} value={Number(((e.at - t0) / 1000).toFixed(2))}
                  onChange={(ev) => setEntries(retime(entries, e.id, Number(ev.target.value) || 0))}
                  className="w-16 rounded border border-input bg-surface-elevated px-1 py-0.5 text-right text-xs text-foreground outline-none focus:border-primary" />s</label>
              <span className="flex-1">{label(e)}</span>
              <span className="text-xs uppercase text-muted-foreground">{e.source}</span>
              <button aria-label="Delete entry" className="text-muted-foreground hover:text-destructive" onClick={(ev) => { ev.stopPropagation(); setEntries(entries.filter((x) => x.id !== e.id)); setPicked((p) => p.filter((x) => x !== e.id)); }}><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
