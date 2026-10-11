import { useState } from "react";
import { Save, Trash2 } from "lucide-react";

/** Save the current effect under a name and recall saved ones. */
export function SavedEffects<T extends { id: string; name: string }>({ items, onSave, onLoad, onDelete, label }: {
  items: T[]; onSave: (name: string) => void; onLoad: (item: T) => void; onDelete: (id: string) => void; label: string;
}) {
  const [name, setName] = useState("");
  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; onSave(name.trim()); setName(""); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this effect…" className="min-w-0 flex-1 rounded-md border border-input bg-surface-elevated px-3 py-2 text-xs outline-none focus:border-primary" />
        <button type="submit" className="flex items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"><Save className="h-3.5 w-3.5" />Save</button>
      </form>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it) => (
            <span key={it.id} className="flex items-center overflow-hidden rounded-md bg-surface-elevated text-xs">
              <button onClick={() => onLoad(it)} className="px-2.5 py-1.5 font-semibold hover:text-primary">{it.name}</button>
              <button onClick={() => { if (confirm(`Delete "${it.name}"?`)) onDelete(it.id); }} className="px-1.5 py-1.5 text-muted-foreground hover:text-destructive" aria-label={`Delete ${it.name}`}><Trash2 className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
