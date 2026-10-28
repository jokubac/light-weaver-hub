import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MACRO_ACTIONS } from "@/lib/macros";
import type { DeckSlot } from "@/lib/stream-deck";
import type { Look } from "@/lib/store";
import { t as tr } from "@/lib/i18n";

const COLS: Record<number, number> = { 6: 3, 8: 4, 15: 5, 32: 8 };
const SWATCHES = ["#ffb000", "#ff3b30", "#34c759", "#0a84ff", "#bf5af2", "#ffffff", "#5a5a5a"];

export function slotLabel(s: DeckSlot | null, looks: Look[]): string {
  if (!s) return "";
  if (s.kind === "look") return looks.find((l) => l.id === s.lookId)?.name ?? "?";
  return s.label || (MACRO_ACTIONS.find((a) => a.id === s.action)?.label ?? s.action);
}
export function slotColor(s: DeckSlot | null, looks: Look[]): string {
  if (!s) return "#000000";
  if (s.color) return s.color;
  if (s.kind === "look") return looks.find((l) => l.id === s.lookId)?.color ?? "#ffb000";
  return s.action === "blackout" ? "#ff3b30" : "#3a3a3a";
}

/** Place looks or macro actions on Stream Deck keys, like the macro pad. */
export function DeckEditor({ open, onOpenChange, keys, layout, looks, onChange, onReset }: {
  open: boolean; onOpenChange: (o: boolean) => void; keys: number; layout: (DeckSlot | null)[]; looks: Look[];
  onChange: (l: (DeckSlot | null)[]) => void; onReset: () => void;
}) {
  const [pick, setPick] = useState(0);
  const slot = layout[pick] ?? null;
  const set = (s: DeckSlot | null) => { const next = Array.from({ length: keys }, (_, i) => layout[i] ?? null); next[pick] = s; onChange(next); };
  const actions = MACRO_ACTIONS.filter((a) => !a.fader && !a.pick);
  const act = slot?.kind === "action" ? MACRO_ACTIONS.find((a) => a.id === slot.action) : undefined;
  const value = !slot ? "" : slot.kind === "look" ? `look:${slot.lookId}` : `action:${slot.action}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{tr("Stream Deck keys")}</DialogTitle></DialogHeader>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${COLS[keys] ?? 5}, minmax(0, 1fr))` }}>
          {Array.from({ length: keys }, (_, i) => {
            const s = layout[i] ?? null;
            return (
              <button key={i} onClick={() => setPick(i)} aria-pressed={pick === i} aria-label={`Key ${i + 1}`}
                style={{ background: slotColor(s, looks) }}
                className={`aspect-square rounded-lg p-1 text-[10px] font-bold leading-tight break-words ${pick === i ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}>
                <span className="rounded bg-background/70 px-1 text-foreground">{slotLabel(s, looks) || i + 1}</span>
              </button>
            );
          })}
        </div>
        <div className="space-y-2 rounded-lg bg-surface p-3 text-xs">
          <div className="font-semibold">{tr("Key")} {pick + 1}</div>
          <select className="w-full rounded-md border border-border bg-surface-elevated px-2 py-2" value={value}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return set(null);
              const [k, id] = [v.slice(0, v.indexOf(":")), v.slice(v.indexOf(":") + 1)];
              if (k === "look") return set({ kind: "look", lookId: id });
              const a = MACRO_ACTIONS.find((x) => x.id === id)!;
              set({ kind: "action", action: a.id, amount: a.def ?? 0 });
            }}>
            <option value="">{tr("Empty")}</option>
            {looks.length > 0 && <optgroup label={tr("Looks")}>{looks.map((l) => <option key={l.id} value={`look:${l.id}`}>{l.name}</option>)}</optgroup>}
            <optgroup label={tr("Actions")}>{actions.map((a) => <option key={a.id} value={`action:${a.id}`}>{tr(a.label)}</option>)}</optgroup>
          </select>
          {slot?.kind === "action" && act?.unit && (
            <label className="flex items-center gap-2">{tr("Amount")}
              <input type="number" className="w-24 rounded-md border border-border bg-surface-elevated px-2 py-1" value={slot.amount} onChange={(e) => set({ ...slot, amount: Number(e.target.value) || 0 })} />{act.unit}
            </label>
          )}
          {slot?.kind === "action" && (
            <input placeholder={tr("Key label (optional)")} className="w-full rounded-md border border-border bg-surface-elevated px-2 py-1.5" value={slot.label ?? ""} onChange={(e) => set({ ...slot, label: e.target.value || undefined } as DeckSlot)} />
          )}
          {slot && (
            <div className="flex items-center gap-1.5">{tr("Colour")}
              {SWATCHES.map((c) => <button key={c} aria-label={c} onClick={() => set({ ...slot, color: c })} style={{ background: c }} className={`h-6 w-6 rounded-full border border-border ${slot.color === c ? "ring-2 ring-primary" : ""}`} />)}
              <button onClick={() => { const { color: _c, ...rest } = slot; set(rest as DeckSlot); }} className="ml-1 text-muted-foreground underline">{tr("Auto")}</button>
            </div>
          )}
        </div>
        <div className="flex justify-between">
          <Button variant="ghost" size="sm" onClick={onReset}>{tr("Reset to looks + Blackout")}</Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>{tr("Done")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
