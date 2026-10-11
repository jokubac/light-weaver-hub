import { useState } from "react";
import { Plus, Pencil, X, Power, Check } from "lucide-react";
import type { PatchedFixture } from "@/lib/dmx";

export function GroupsPanel({ fixtures, selected, onSelect, onCreate, onRename, onUngroup, onUpdate }: {
  fixtures: PatchedFixture[];
  selected: string[];
  onSelect: (g: string) => void;
  onCreate: (name: string) => void;
  onRename: (from: string, to: string) => void;
  onUngroup: (g: string) => void;
  onUpdate: (g: string, p: Partial<PatchedFixture>) => void;
}) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ g: string; v: string } | null>(null);
  const groups = Array.from(new Set(fixtures.map((f) => f.group).filter((g): g is string => !!g)));

  return (
    <div className="space-y-4">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Groups</h2>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim() && selected.length) { onCreate(name.trim()); setName(""); } }} className="space-y-1.5">
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New group name, e.g. Key lights" className="min-w-0 flex-1 rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm" />
          <button type="submit" disabled={!name.trim() || !selected.length} className="flex items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-40"><Plus className="h-3.5 w-3.5" />Group</button>
        </div>
        <p className="text-[10px] text-muted-foreground">{selected.length ? `${selected.length} selected lights will be grouped.` : "Select lights first, then name the group."}</p>
      </form>

      {groups.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No groups yet.</p>}
      {groups.map((g) => {
        const members = fixtures.filter((f) => f.group === g);
        const lvl = members.reduce((s, f) => s + f.intensity, 0) / members.length;
        const anyOn = members.some((f) => f.on !== false);
        return (
          <div key={g} className="space-y-2 rounded-lg bg-surface-elevated p-3">
            <div className="flex items-center gap-2">
              {editing?.g === g ? (
                <form className="flex min-w-0 flex-1 gap-1" onSubmit={(e) => { e.preventDefault(); if (editing.v.trim()) onRename(g, editing.v.trim()); setEditing(null); }}>
                  <input autoFocus value={editing.v} onChange={(e) => setEditing({ g, v: e.target.value })} className="min-w-0 flex-1 rounded border border-input bg-surface px-2 py-1 text-sm" />
                  <button type="submit" aria-label="Save name"><Check className="h-4 w-4 text-success" /></button>
                </form>
              ) : (
                <button onClick={() => onSelect(g)} className="min-w-0 flex-1 truncate text-left text-sm font-semibold">{g} <span className="text-muted-foreground">({members.length})</span></button>
              )}
              <button onClick={() => onUpdate(g, { on: !anyOn })} className={`rounded p-1.5 ${anyOn ? "text-success" : "text-muted-foreground"}`} aria-label="Group on/off"><Power className="h-4 w-4" /></button>
              <button onClick={() => setEditing({ g, v: g })} className="p-1.5 text-muted-foreground" aria-label="Rename group"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => onUngroup(g)} className="p-1.5 text-muted-foreground hover:text-destructive" aria-label="Ungroup"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={1} step={0.001} value={lvl} onChange={(e) => onUpdate(g, { intensity: +e.target.value })} className="flex-1 accent-[var(--color-primary)]" aria-label={`${g} intensity`} />
              <span className="w-12 text-right font-mono text-xs">{+(lvl * 100).toFixed(1)}%</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {members.map((f) => <span key={f.uid} className="rounded bg-surface px-1.5 py-0.5 text-[10px]">{f.name}</span>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
