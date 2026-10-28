import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MACRO_ACTIONS } from "@/lib/macros";
import type { DeckSlot } from "@/lib/stream-deck";
import type { Look } from "@/lib/store";
import {
  ArrowDown, ArrowUp, Ban, Boxes, CheckCheck, ChevronLeft, ChevronRight, ClipboardPaste, Copy,
  Contrast, Crosshair, Droplet, Equal, EyeOff, Filter, Flag, Flame, FolderPlus, Gauge, Layers,
  Lightbulb, LightbulbOff, Megaphone, Moon, Palette, Pause, Pin, PinOff, Play, Power, Redo2,
  RotateCcw, Search, SkipBack, SlidersHorizontal, Sparkles, Square, SunMedium, Thermometer, Timer,
  Undo2, WrapText, Zap, type LucideIcon,
} from "lucide-react";
import { t as tr } from "@/lib/i18n";

const COLS: Record<number, number> = { 6: 3, 8: 4, 15: 5, 32: 8 };
const SWATCHES = ["#ffb000", "#ff3b30", "#34c759", "#0a84ff", "#bf5af2", "#ffffff", "#5a5a5a"];

/** One mark per action, so a key can be read at a glance instead of being squinted at. */
const ACTION_ICONS: Record<string, LucideIcon> = {
  int_up: ArrowUp, int_down: ArrowDown, int_set: Equal, int_fader: SlidersHorizontal,
  cct_up: SunMedium, cct_down: Moon, cct_set: Thermometer, cct_fader: SlidersHorizontal,
  filter: Filter, gm_fader: SlidersHorizontal,
  hue_up: Palette, hue_down: Palette, sat_up: Droplet, sat_down: Droplet,
  play: Play, pause: Pause, cue_reset: RotateCcw, fx_toggle: Sparkles, pixel_toggle: Boxes,
  prev: ChevronLeft, next: ChevronRight, all: CheckCheck, select: Square, invert: Contrast,
  copy: Copy, paste: ClipboardPaste, undo: Undo2, redo: Redo2,
  light_off: LightbulbOff, light_on: Lightbulb, light_toggle: Power,
  group: Layers, group_new: FolderPlus, trigger: Zap,
  strike: Flame, checkout: Megaphone, locate: Crosshair, wrap: WrapText,
  hue_fader: SlidersHorizontal, sat_fader: SlidersHorizontal,
  park: Pin, unpark: PinOff, blind: EyeOff, blackout: Ban,
  go: Flag, back: SkipBack, flash: Zap, int_half: Gauge, hold: Timer,
};
const actionIcon = (id: string) => ACTION_ICONS[id] ?? Square;

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
/** The mark a key carries: its action's icon, or a lamp for a look. */
export function slotIcon(s: DeckSlot | null): LucideIcon {
  if (!s) return Square;
  if (s.kind === "look") return Lightbulb;
  return actionIcon(s.action);
}

/** Place looks or macro actions on Stream Deck keys, like the macro pad. */
export function DeckEditor({ open, onOpenChange, keys, layout, looks, onChange, onReset }: {
  open: boolean; onOpenChange: (o: boolean) => void; keys: number; layout: (DeckSlot | null)[]; looks: Look[];
  onChange: (l: (DeckSlot | null)[]) => void; onReset: () => void;
}) {
  const [pick, setPick] = useState(0);
  const [find, setFind] = useState("");
  const slot = layout[pick] ?? null;
  const set = (s: DeckSlot | null) => { const next = Array.from({ length: keys }, (_, i) => layout[i] ?? null); next[pick] = s; onChange(next); };
  const actions = useMemo(() => {
    const q = find.trim().toLowerCase();
    return MACRO_ACTIONS.filter((a) => !a.fader && !a.pick && (!q || tr(a.label).toLowerCase().includes(q) || a.label.toLowerCase().includes(q)));
  }, [find]);
  const act = slot?.kind === "action" ? MACRO_ACTIONS.find((a) => a.id === slot.action) : undefined;
  const KeyIcon = slotIcon(slot);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{tr("Stream Deck keys")}</DialogTitle></DialogHeader>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${COLS[keys] ?? 5}, minmax(0, 1fr))` }}>
          {Array.from({ length: keys }, (_, i) => {
            const s = layout[i] ?? null;
            const Icon = slotIcon(s);
            return (
              <button key={i} onClick={() => setPick(i)} aria-pressed={pick === i} aria-label={`Key ${i + 1}`}
                style={{ background: slotColor(s, looks) }}
                className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-lg p-1 text-[9px] font-bold leading-tight break-words ${pick === i ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}>
                <Icon className="h-5 w-5 text-background/90" aria-hidden="true" />
                <span className="line-clamp-2 px-0.5 text-center text-background/90">{slotLabel(s, looks) || i + 1}</span>
              </button>
            );
          })}
        </div>
        <div className="space-y-2 rounded-lg bg-surface p-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{tr("Key")} {pick + 1}</span>
            <KeyIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {slot && <button onClick={() => set(null)} className="ml-auto text-muted-foreground underline">{tr("Empty")}</button>}
          </div>
          <label className="flex items-center gap-2 rounded-md border border-border bg-surface-elevated px-2 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input autoFocus value={find} onChange={(e) => setFind(e.target.value)} placeholder={tr("Search actions…")}
              className="w-full bg-transparent outline-none" aria-label={tr("Search actions…")} />
          </label>
          {looks.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {looks.map((l) => (
                <button key={l.id} onClick={() => set({ kind: "look", lookId: l.id })}
                  aria-pressed={slot?.kind === "look" && slot.lookId === l.id}
                  className={`flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-2 py-1 font-semibold ${slot?.kind === "look" && slot.lookId === l.id ? "ring-2 ring-primary" : ""}`}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color ?? "#ffb000" }} />
                  <Lightbulb className="h-3 w-3 text-muted-foreground" aria-hidden="true" />{l.name}
                </button>
              ))}
            </div>
          )}
          <div className="grid max-h-44 grid-cols-3 gap-1 overflow-auto sm:grid-cols-4">
            {actions.map((a) => {
              const Icon = actionIcon(a.id);
              const on = slot?.kind === "action" && slot.action === a.id;
              return (
                <button key={a.id} onClick={() => set({ kind: "action", action: a.id, amount: a.def ?? 0 })} aria-pressed={on}
                  className={`flex flex-col items-center gap-1 rounded-lg border border-border bg-surface-elevated p-2 text-[10px] font-semibold leading-tight ${on ? "ring-2 ring-primary" : ""}`}>
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="line-clamp-2 text-center">{tr(a.label)}</span>
                </button>
              );
            })}
            {actions.length === 0 && <p className="col-span-full py-4 text-center text-muted-foreground">{tr("Nothing matches that.")}</p>}
          </div>
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
