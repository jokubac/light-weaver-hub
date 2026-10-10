import { useState } from "react";
import { MoreVertical, Copy, Pencil, Trash2, Palette } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PROJECT_COLORS } from "@/lib/store";

export function ColorSwatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PROJECT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
          className={`h-8 w-8 rounded-full border-2 transition active:scale-90 ${value === c ? "border-foreground" : "border-transparent"}`}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

export function ItemMenu({
  name,
  color,
  onRename,
  onDuplicate,
  onDelete,
  onColor,
}: {
  name: string;
  color?: string;
  onRename: (n: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onColor?: (c: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [coloring, setColoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draft, setDraft] = useState(name);

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-md p-2 text-muted-foreground hover:text-foreground" aria-label="More">
            <MoreVertical className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onDuplicate}><Copy className="mr-2 h-4 w-4" />Duplicate</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { setDraft(name); setRenaming(true); }}><Pencil className="mr-2 h-4 w-4" />Rename</DropdownMenuItem>
          {onColor && <DropdownMenuItem onSelect={() => setColoring(true)}><Palette className="mr-2 h-4 w-4" />Color</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDeleting(true)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename</DialogTitle></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) onRename(draft.trim());
              setRenaming(false);
            }}
            className="space-y-4"
          >
            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} className="w-full rounded-lg border border-input bg-surface-elevated px-4 py-3 text-sm outline-none focus:border-primary" />
            <DialogFooter>
              <button type="submit" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Save</button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {onColor && (
        <Dialog open={coloring} onOpenChange={setColoring}>
          <DialogContent>
            <DialogHeader><DialogTitle>Project color</DialogTitle></DialogHeader>
            <ColorSwatches value={color ?? ""} onChange={(c) => { onColor(c); setColoring(false); }} />
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
