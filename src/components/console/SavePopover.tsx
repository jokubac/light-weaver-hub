import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";

export const SAVE_COLOURS = ["#f5a524", "#ef4444", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#e5e7eb"];

export interface SaveItem { id: string; name: string; color?: string | undefined; info?: string }

/** "+ Group" / "+ Look" dropdown: name + colour for a new item, plus list to reorder, rename, recolour and delete. */
export function SavePopover({ label, kind, items, disabled, canCreate, onCreate, onChange, onDelete, onPick }: {
  label: string; kind: string; items: SaveItem[]; disabled?: boolean; canCreate: boolean;
  onCreate: (name: string, color: string) => void;
  onChange: (items: SaveItem[]) => void;
  onDelete: (id: string) => void;
  onPick?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(SAVE_COLOURS[0]!);
  const [editing, setEditing] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const fallback = `${kind} ${items.length + 1}`;
  const move = (i: number, d: number) => { const n = [...items]; const j = i + d; if (j < 0 || j >= n.length) return; const t = n[i]!; n[i] = n[j]!; n[j] = t; onChange(n); };
  const patch = (id: string, p: Partial<SaveItem>) => onChange(items.map((x) => (x.id === id ? { ...x, ...p } : x)));
  return (
    <div ref={root} className="relative">
      <button disabled={disabled} onClick={() => { setOpen((o) => !o); setName(""); setEditing(null); }} className="rounded-md bg-surface-elevated px-3 py-1.5 font-semibold disabled:opacity-40">{label}</button>
      {open && <div className="absolute left-0 top-full z-50 mt-1 w-80 space-y-3 rounded-md border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
        <div className="space-y-2">
          <div className="font-semibold uppercase tracking-wide text-muted-foreground">New {kind.toLowerCase()}</div>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={fallback}
            onKeyDown={(e) => { if (e.key === "Enter" && canCreate) { onCreate(name.trim() || fallback, color); setName(""); } }}
            className="w-full rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
          <div className="flex gap-1.5">
            {SAVE_COLOURS.map((c) => (
              <button key={c} aria-label={`Colour ${c}`} onClick={() => setColor(c)} style={{ background: c }}
                className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`} />
            ))}
          </div>
          <button disabled={!canCreate} onClick={() => { onCreate(name.trim() || fallback, color); setName(""); }}
            className="w-full rounded-md bg-primary py-1.5 font-semibold text-primary-foreground disabled:opacity-40">
            {canCreate ? `Create ${kind.toLowerCase()}` : "Select lights first"}
          </button>
        </div>
        <div className="space-y-1 border-t border-border pt-2">
          <div className="font-semibold uppercase tracking-wide text-muted-foreground">{kind}s ({items.length})</div>
          {!items.length && <div className="py-2 text-muted-foreground">None yet</div>}
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {items.map((it, i) => (
              <div key={it.id} className="rounded-md bg-surface-elevated p-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: it.color ?? "hsl(var(--muted-foreground))" }} />
                  {editing === it.id
                    ? <input autoFocus defaultValue={it.name} onBlur={(e) => { patch(it.id, { name: e.target.value.trim() || it.name }); setEditing(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        className="min-w-0 flex-1 rounded-md border border-input bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                    : <button className="min-w-0 flex-1 truncate text-left font-semibold" onClick={() => onPick?.(it.id)} title={onPick ? "Select" : undefined}>{it.name}{it.info && <span className="ml-1 font-normal text-muted-foreground">{it.info}</span>}</button>}
                  <button aria-label="Move up" onClick={() => move(i, -1)} className="p-0.5 disabled:opacity-30" disabled={i === 0}><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button aria-label="Move down" onClick={() => move(i, 1)} className="p-0.5 disabled:opacity-30" disabled={i === items.length - 1}><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button aria-label="Rename" onClick={() => setEditing(editing === it.id ? null : it.id)} className="p-0.5"><Pencil className="h-3.5 w-3.5" /></button>
                  <button aria-label="Delete" onClick={() => { if (confirm(`Delete "${it.name}"?`)) onDelete(it.id); }} className="p-0.5 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                {editing === it.id && (
                  <div className="mt-1.5 flex gap-1">
                    {SAVE_COLOURS.map((c) => (
                      <button key={c} aria-label={`Colour ${c}`} onMouseDown={(e) => e.preventDefault()} onClick={() => patch(it.id, { color: c })} style={{ background: c }}
                        className={`h-5 w-5 rounded-full border-2 ${it.color === c ? "border-foreground" : "border-transparent"}`} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>}
    </div>
  );
}
