import { Copy, ClipboardPaste, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

import { t as tr } from "@/lib/i18n";
export function SettingsTransfer({ source, canCopy, onCopy, onPaste }: {
  source?: string | undefined; canCopy: boolean; onCopy: () => void; onPaste: () => void;
}) {
  return <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
    <Button size="sm" variant="secondary" disabled={!canCopy} onClick={onCopy} title={tr("Copy intensity, colour and effect")} aria-label={tr("Copy light settings")}><Copy />{tr("Copy settings")}</Button>
    <Button size="sm" variant="secondary" disabled={!source || !canCopy} onClick={onPaste} title={source ? `Paste settings from ${source}` : "Copy a light first"} aria-label={tr("Paste light settings")}><ClipboardPaste />{tr("Paste")}</Button>
    {source && <span role="status" className="flex min-w-0 items-center gap-1 text-[10px] text-primary"><Check className="h-3 w-3 shrink-0" /><span className="truncate">{source}</span></span>}
  </div>;
}