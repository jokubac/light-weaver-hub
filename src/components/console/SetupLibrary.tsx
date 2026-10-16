import { useState } from "react";
import { Save, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Scene } from "@/lib/store";

export function SetupLibrary({ open, onOpenChange, setups, onSave, onRestore, onDelete }: {
  open: boolean; onOpenChange: (open: boolean) => void; setups: Scene[];
  onSave: (name: string) => void; onRestore: (setup: Scene) => void; onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[85vh] overflow-auto">
      <DialogTitle>Project setups</DialogTitle>
      <DialogDescription className="sr-only">Save or restore a complete lighting setup in this project.</DialogDescription>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; onSave(name.trim()); setName(""); }}>
        <input aria-label="Setup name" placeholder="Setup name" value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
        <Button type="submit" disabled={!name.trim()}><Save />Save</Button>
      </form>
      {setups.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No saved setups.</p>}
      <div className="space-y-2">
        {setups.map((setup) => <div key={setup.id} className="flex items-center gap-2 border-b border-border py-3">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{setup.name}</p><p className="text-xs text-muted-foreground">{setup.fixtures.length} lights · {setup.plot?.strokes.length ?? 0} walls · {setup.pixelLayers?.length ?? 0} pixel layers</p></div>
          <Button variant="secondary" size="icon" title={`Restore ${setup.name}`} aria-label={`Restore ${setup.name}`} onClick={() => { if (!window.confirm(`Restore “${setup.name}”? This replaces the current scene's lights, walls, angles and effects.`)) return; onRestore(setup); onOpenChange(false); }}><RotateCcw /></Button>
          <Button variant="ghost" size="icon" className="text-destructive" title={`Delete ${setup.name}`} aria-label={`Delete ${setup.name}`} onClick={() => { if (window.confirm(`Delete saved setup “${setup.name}”?`)) onDelete(setup.id); }}><Trash2 /></Button>
        </div>)}
      </div>
    </DialogContent>
  </Dialog>;
}