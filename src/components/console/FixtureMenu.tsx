import { NumberField } from "./NumberField";
import { useState } from "react";
import { MoreVertical, Pencil, Lock, Split, Merge, FolderPlus, FolderMinus, BatteryCharging } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getDef, overlaps, type PatchedFixture } from "@/lib/dmx";
import { pixelCount } from "@/lib/pixels";
import { LABEL_COLORS } from "./PatchPanel";
import { groupsOf, inGroup } from "@/lib/fixture-groups";
import { PowerDialog } from "./PowerDialog";
import type { PowerSource } from "@/lib/power";

import { t as tr } from "@/lib/i18n";
const inputCls = "mt-1 w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

export function FixtureMenu({ f, fixtures, locked, groups, onChange, onSplit, onJoin, onGroup, onPower, level }: {
  onPower: (p: PowerSource | null) => void; level: number;
  f: PatchedFixture; fixtures: PatchedFixture[]; locked: boolean; groups: string[];
  onChange: (p: Partial<PatchedFixture>) => void; onSplit: () => void; onJoin: () => void;
  /** Add the light to group `g` (on) or take it out of that one group (off). A light can be in several groups. */
  onGroup: (g: string, on: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [grouping, setGrouping] = useState(false);
  const [powering, setPowering] = useState(false);
  const [draft, setDraft] = useState(f);
  const [groupName, setGroupName] = useState("");
  const def = getDef(f.defId);
  const ch = f.split ? f.split.cpp : def.modes[draft.modeIdx]?.channels ?? 1;
  const clash = overlaps(fixtures, draft.universe, draft.address, ch, f.uid).filter((x) => !(f.split && x.split?.from === f.split.from && x.uid === f.uid));

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="-mr-1 rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label={tr("Light options")}><MoreVertical className="h-4 w-4" /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {locked && <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3 w-3" />{tr("Patch locked — unlock to edit")}</DropdownMenuLabel>}
          <DropdownMenuItem disabled={locked} onSelect={() => { setDraft(f); setEditing(true); }}><Pencil className="mr-2 h-4 w-4" />{tr("Edit name, address, mode")}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { setGroupName(""); setGrouping(true); }}><FolderPlus className="mr-2 h-4 w-4" />{groupsOf(f).length ? tr("Groups…") : tr("Add to group")}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPowering(true)}><BatteryCharging className="mr-2 h-4 w-4" />{f.power ? tr("Battery settings") : tr("Run on V-mount / Instagrid")}</DropdownMenuItem>
          {groupsOf(f).map((g) => <DropdownMenuItem key={g} onSelect={() => onGroup(g, false)}><FolderMinus className="mr-2 h-4 w-4" />Remove from "{g}"</DropdownMenuItem>)}
          {(pixelCount(f) > 0 || f.split) && <DropdownMenuSeparator />}
          {pixelCount(f) > 0 && <DropdownMenuItem disabled={locked} onSelect={onSplit}><Split className="mr-2 h-4 w-4" />{tr("Split into")}{pixelCount(f)}{tr("pixel lights")}</DropdownMenuItem>}
          {f.split && <DropdownMenuItem disabled={locked} onSelect={onJoin}><Merge className="mr-2 h-4 w-4" />Join pixels back into "{f.split.name}"</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tr("Edit")}{f.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <label className="block">{tr("Name")}<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} /></label>
            <div>{tr("Colour tag")}<div className="mt-1 flex flex-wrap gap-1.5">
                {LABEL_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setDraft({ ...draft, label: c })} aria-label={`Tag ${c}`}
                    className={`h-7 w-7 rounded-full border-2 ${draft.label === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">{tr("Universe")}<NumberField integer min={1} max={64} value={draft.universe} onChange={(v) => v && setDraft({ ...draft, universe: v })} className={inputCls} /></label>
              <label className="block">{tr("Address")}<NumberField integer min={1} max={512} value={draft.address} onChange={(v) => v && setDraft({ ...draft, address: v })} className={inputCls} /></label>
            </div>
            {!f.split && (
              <label className="block">{tr("Mode")}<select value={draft.modeIdx} onChange={(e) => setDraft({ ...draft, modeIdx: +e.target.value })} className={inputCls}>
                  {def.modes.map((mo, i) => <option key={i} value={i}>{mo.name} · {mo.channels}{tr("ch")}</option>)}
                </select>
              </label>
            )}
            <p className="normal-case tracking-normal">{def.brand} {def.model} · {ch}{tr("ch ·")}{draft.address}–{draft.address + ch - 1}</p>
            {clash.length > 0 && <p className="normal-case tracking-normal text-destructive">{tr("Overlaps")}{clash.map((c) => c.name).join(", ")}</p>}
            {draft.address + ch - 1 > 512 && <p className="normal-case tracking-normal text-destructive">{tr("Runs past channel 512")}</p>}
          </div>
          <DialogFooter>
            <button onClick={() => {
              onChange({ name: draft.name, universe: draft.universe, address: draft.address, modeIdx: draft.modeIdx, ...(draft.label ? { label: draft.label } : {}) });
              setEditing(false);
            }} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">{tr("Save")}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {powering && <PowerDialog f={f} open={powering} onOpenChange={setPowering} onChange={onPower} level={level} />}

      <Dialog open={grouping} onOpenChange={setGrouping}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tr("Groups")}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">{tr("A light can sit in several groups at once. Tap a group to add the light or take it out.")}</p>
          {groups.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {groups.map((g) => <button key={g} aria-pressed={inGroup(f, g)} onClick={() => onGroup(g, !inGroup(f, g))} className={`rounded-md px-3 py-2 text-xs font-semibold ${inGroup(f, g) ? "bg-primary text-primary-foreground" : "bg-surface-elevated"}`}>{g}</button>)}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); if (groupName.trim()) onGroup(groupName.trim(), true); setGrouping(false); }} className="flex gap-2">
            <input autoFocus value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder={tr("New group name (e.g. Key lights)")} className="min-w-0 flex-1 rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{tr("Add")}</button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
