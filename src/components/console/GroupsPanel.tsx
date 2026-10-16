import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, X, Power, Check, Copy, Play, Square, ChevronDown, ChevronRight } from "lucide-react";
import type { PatchedFixture } from "@/lib/dmx";

export function GroupsPanel({ fixtures, selected, onSelect, onCreate, onRename, onUngroup, onUpdate, onCopy, onRemoveMember }: {
  fixtures: PatchedFixture[];
  selected: string[];
  onSelect: (g: string) => void;
  onCreate: (name: string) => void;
  onRename: (from: string, to: string) => void;
  onUngroup: (g: string) => void;
  onUpdate: (g: string, p: Partial<PatchedFixture>) => void;
  /** Copy settings (level, colour, effect) from group `from` to group `to`, or to the selected lights as a new group when `to` is new. */
  onCopy: (from: string, to: string) => void;
  /** Take one light out of its group; its patch and settings stay. */
  onRemoveMember: (uid: string) => void;
}) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ g: string; v: string } | null>(null);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const groups = Array.from(new Set(fixtures.map((f) => f.group).filter((g): g is string => !!g)));

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim() && selected.length) { onCreate(name.trim()); setName(""); } }} className="space-y-1.5" aria-label="Create group">
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" aria-label="Group name" className="min-w-0 flex-1 rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
          <Button variant="ghost" type="submit" disabled={!name.trim() || !selected.length} className="flex items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-40"><Plus className="h-3.5 w-3.5" />Group</Button>
        </div>
        <p className="text-[10px] text-muted-foreground">{selected.length ? `${selected.length} selected lights will be grouped.` : "Select lights first, then name the group."}</p>
      </form>

      {groups.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No groups yet.</p>}
      {groups.map((g) => {
        const members = fixtures.filter((f) => f.group === g);
        const lvl = members.reduce((s, f) => s + f.intensity, 0) / members.length;
        const anyOn = members.some((f) => f.on !== false);
        const hasFx = members.some((f) => f.fx.kind !== "none");
        const fxOn = members.some((f) => f.fx.kind !== "none" && f.fxPlaying !== false);
        const closed = collapsed.includes(g);
        return (
          <div key={g} className="space-y-2 rounded-lg bg-surface-elevated p-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`${closed ? "Expand" : "Collapse"} group ${g}`} aria-expanded={!closed} title={closed ? "Expand group" : "Collapse group"} onClick={() => setCollapsed((names) => closed ? names.filter((name) => name !== g) : [...names, g])}>
                {closed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              {editing?.g === g ? (
                <form className="flex min-w-0 flex-1 gap-1" onSubmit={(e) => { e.preventDefault(); if (editing.v.trim()) onRename(g, editing.v.trim()); setEditing(null); }}>
                   <input autoFocus aria-label="Rename group" value={editing.v} onChange={(e) => setEditing({ g, v: e.target.value })} className="min-w-0 flex-1 rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                  <Button variant="ghost" type="submit" aria-label="Save name"><Check className="h-4 w-4 text-success" /></Button>
                </form>
              ) : (
                <Button variant="ghost" aria-pressed={members.every((f) => selected.includes(f.uid))} onClick={() => onSelect(g)} className={`min-w-0 flex-1 justify-start truncate px-1 text-left text-sm font-semibold ${members.every((f) => selected.includes(f.uid)) ? "text-primary" : ""}`}>{g} <span className="text-muted-foreground">({members.length})</span></Button>
              )}
              <Button variant="ghost" onClick={() => onUpdate(g, { on: !anyOn })} className={`rounded p-1.5 ${anyOn ? "text-success" : "text-muted-foreground"}`} aria-label="Group on/off"><Power className="h-4 w-4" /></Button>
              {hasFx && <Button variant="ghost" onClick={() => onUpdate(g, { fxPlaying: !fxOn })} className={`rounded p-1.5 ${fxOn ? "text-destructive" : "text-amber-glow"}`} aria-label="Group effect play/stop">{fxOn ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>}
              <Button variant="ghost" onClick={() => setEditing({ g, v: g })} className="h-7 w-7 shrink-0 p-1.5 text-muted-foreground" aria-label={`Rename group ${g}`} title="Rename group"><Pencil className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" onClick={() => onUngroup(g)} className="h-7 w-7 shrink-0 p-1.5 text-muted-foreground hover:text-destructive" aria-label="Ungroup"><X className="h-4 w-4" /></Button>
            </div>
            {!closed && <>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={1} step={0.001} value={lvl} onChange={(e) => onUpdate(g, { intensity: +e.target.value })} className="flex-1 accent-[var(--color-primary)]" aria-label={`${g} intensity`} />
              <span className="w-12 text-right font-mono text-xs">{+(lvl * 100).toFixed(1)}%</span>
            </div>
            <div className="flex gap-1.5">
              <Button variant="secondary" size="sm" disabled={!fixtures.some((f) => selected.includes(f.uid) && f.group !== g)} onClick={() => onCreate(g)} aria-label={`Add selected lights to ${g}`} title="Add selected lights to group" className="shrink-0 gap-1 text-[11px]"><Plus className="h-3 w-3" />Add</Button>
              <Button variant="ghost" disabled={!selected.length} onClick={() => onCopy(g, `${g} copy`)} title="Selected lights become a new group with the same settings" className="flex flex-1 items-center justify-center gap-1 rounded bg-surface py-1.5 text-[11px] font-semibold disabled:opacity-40"><Copy className="h-3 w-3" />Duplicate to selected</Button>
              {groups.length > 1 && (
                <select value="" onChange={(e) => e.target.value && onCopy(g, e.target.value)} className="flex-1 rounded border border-input bg-surface px-1 text-[11px]" aria-label="Copy settings to group">
                  <option value="">Sync to group…</option>
                  {groups.filter((x) => x !== g).map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {members.map((f) => <span key={f.uid} className="flex items-center gap-0.5 rounded bg-surface py-0.5 pl-1.5 pr-0.5 text-[10px]">{f.name}
                <button onClick={() => onRemoveMember(f.uid)} aria-label={`Remove ${f.name} from ${g}`} title="Remove from group" className="rounded p-0.5 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button></span>)}
            </div>
            </>}
          </div>
        );
      })}
    </div>
  );
}
