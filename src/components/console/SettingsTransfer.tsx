import { Copy, ClipboardPaste, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SettingsTransfer({ source, canCopy, onCopy, onPaste }: {
  source?: string | undefined; canCopy: boolean; onCopy: () => void; onPaste: () => void;
}) {
  return <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
    <Button size="sm" variant="secondary" disabled={!canCopy} onClick={onCopy} title="Copy intensity, colour and effect" aria-label="Copy light settings"><Copy />Copy settings</Button>
    <Button size="sm" variant="secondary" disabled={!source || !canCopy} onClick={onPaste} title={source ? `Paste settings from ${source}` : "Copy a light first"} aria-label="Paste light settings"><ClipboardPaste />Paste</Button>
    {source && <span role="status" className="flex min-w-0 items-center gap-1 text-[10px] text-primary"><Check className="h-3 w-3 shrink-0" /><span className="truncate">{source}</span></span>}
  </div>;
}