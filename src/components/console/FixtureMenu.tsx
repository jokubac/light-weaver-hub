import { useState } from "react";
import { MoreVertical, Pencil, Lock, Split, Merge, FolderPlus, FolderMinus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getDef, overlaps, type PatchedFixture } from "@/lib/dmx";
import { pixelCount } from "@/lib/pixels";
import { LABEL_COLORS } from "./PatchPanel";

const inputCls = "mt-1 w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground";

export function FixtureMenu({ f, fixtures, locked, groups, onChange, onSplit, onJoin, onGroup }: {
  f: PatchedFixture; fixtures: PatchedFixture[]; locked: boolean; groups: string[];
  onChange: (p: Partial<PatchedFixture>) => void; onSplit: () => void; onJoin: () => void; onGroup: (g: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [grouping, setGrouping] = useState(false);
  const [draft, setDraft] = useState(f);
  const [groupName, setGroupName] = useState("");
  const def = getDef(f.defId);
  const ch = f.split ? f.split.cpp : def.modes[draft.modeIdx]?.channels ?? 1;
  const clash = overlaps(fixtures, draft.universe, draft.address, ch, f.uid).filter((x) => !(f.split && x.split?.from === f.split.from && x.uid === f.uid));

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="-mr-1 rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label="Light options"><MoreVertical className="h-4 w-4" /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {locked && <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3 w-3" />Patch locked — unlock to edit</DropdownMenuLabel>}
          <DropdownMenuItem disabled={locked} onSelect={() => { setDraft(f); setEditing(true); }}><Pencil className="mr-2 h-4 w-4" />Edit name, address, mode</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { setGroupName(f.group ?? ""); setGrouping(true); }}><FolderPlus className="mr-2 h-4 w-4" />{f.group ? "Change group" : "Add to group"}</DropdownMenuItem>
          {f.group && <DropdownMenuItem onSelect={() => onGroup(null)}><FolderMinus className="mr-2 h-4 w-4" />Remove from "{f.group}"</DropdownMenuItem>}
          {(pixelCount(f) > 0 || f.split) && <DropdownMenuSeparator />}
          {pixelCount(f) > 0 && <DropdownMenuItem disabled={locked} onSelect={onSplit}><Split className="mr-2 h-4 w-4" />Split into {pixelCount(f)} pixel lights</DropdownMenuItem>}
          {f.split && <DropdownMenuItem disabled={locked} onSelect={onJoin}><Merge className="mr-2 h-4 w-4" />Join pixels back into "{f.split.name}"</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit {f.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <label className="block">Name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} /></label>
            <div>
              Colour tag
              <div className="mt-1 flex flex-wrap gap-1.5">
                {LABEL_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setDraft({ ...draft, label: c })} aria-label={`Tag ${c}`}
                    className={`h-7 w-7 rounded-full border-2 ${draft.label === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">Universe<input type="number" min={1} max={64} value={draft.universe} onChange={(e) => setDraft({ ...draft, universe: Math.max(1, Math.min(64, +e.target.value || 1)) })} className={inputCls} /></label>
              <label className="block">Address<input type="number" min={1} max={512} value={draft.address} onChange={(e) => setDraft({ ...draft, address: Math.max(1, Math.min(512, +e.target.value || 1)) })} className={inputCls} /></label>
            </div>
            {!f.split && (
              <label className="block">Mode
                <select value={draft.modeIdx} onChange={(e) => setDraft({ ...draft, modeIdx: +e.target.value })} className={inputCls}>
                  {def.modes.map((mo, i) => <option key={i} value={i}>{mo.name} · {mo.channels} ch</option>)}
                </select>
              </label>
            )}
            <p className="normal-case tracking-normal">{def.brand} {def.model} · {ch} ch · {draft.address}–{draft.address + ch - 1}</p>
            {clash.length > 0 && <p className="normal-case tracking-normal text-destructive">Overlaps {clash.map((c) => c.name).join(", ")}</p>}
            {draft.address + ch - 1 > 512 && <p className="normal-case tracking-normal text-destructive">Runs past channel 512</p>}
          </div>
          <DialogFooter>
            <button onClick={() => {
              onChange({ name: draft.name, universe: draft.universe, address: draft.address, modeIdx: draft.modeIdx, ...(draft.label ? { label: draft.label } : {}) });
              setEditing(false);
            }} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={grouping} onOpenChange={setGrouping}>
        <DialogContent>
          <DialogHeader><DialogTitle>Group</DialogTitle></DialogHeader>
          {groups.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {groups.map((g) => <button key={g} onClick={() => { onGroup(g); setGrouping(false); }} className="rounded-md bg-surface-elevated px-3 py-2 text-xs font-semibold">{g}</button>)}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); if (groupName.trim()) onGroup(groupName.trim()); setGrouping(false); }} className="flex gap-2">
            <input autoFocus value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="New group name (e.g. Key lights)" className="min-w-0 flex-1 rounded-lg border border-input bg-surface-elevated px-3 py-2 text-sm" />
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save</button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
