import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** One collapsible part of the side panel: Groups / Looks / Effects / REC all look the same. */
export function CollapsibleSection({ title, defaultOpen = true, children }: {
  title: string; defaultOpen?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-border pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-1">
        <h2 className="min-w-0 flex-1 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${title}`} title={open ? `Collapse ${title}` : `Expand ${title}`}
          onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
      {open && <div className="mt-2 space-y-2">{children}</div>}
    </section>
  );
}
