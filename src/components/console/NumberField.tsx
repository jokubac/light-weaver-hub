import { useState } from "react";

/**
 * Number input that can be cleared completely while typing.
 * The value is applied on blur / Enter; an empty or invalid entry restores the previous value.
 */
export function NumberField({ value, onChange, min, max, step, integer, className, disabled, placeholder, allowEmpty, ...rest }: {
  value: number | undefined | null;
  onChange: (v: number | undefined) => void;
  min?: number; max?: number; step?: number; integer?: boolean; className?: string; disabled?: boolean; placeholder?: string;
  /** when true, clearing the field commits `undefined` instead of restoring */
  allowEmpty?: boolean;
  "aria-label"?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = value === undefined || value === null ? "" : String(value);
  /** All typed fields share one look; callers only pass width / alignment / font. */
  const narrow = /\bw-(6|8|10|12|14|16|20|24)\b/.test(className ?? "");
  const fieldCls = `rounded-md border border-input bg-surface-elevated ${narrow ? "px-2" : "px-3"} py-2 text-sm text-foreground outline-none focus:border-primary`;
  const drop = /^(sm:|md:|lg:|print:)?(rounded(-|$)|border(?!-input)|bg-|(px|py|p)-|text-(xs|sm|base|lg|xl|\[[^\]]+\])$|outline-none$|focus:)/;
  const cls = [...new Set([fieldCls, ...(className ?? "").split(" ").filter((t) => t && !drop.test(t))])].join(" ");
  const commit = () => {
    if (draft === null) return;
    const t = draft.trim().replace(",", ".");
    setDraft(null);
    if (t === "") { if (allowEmpty) onChange(undefined); return; }
    let n = parseFloat(t);
    if (!Number.isFinite(n)) return;
    if (integer) n = Math.round(n);
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    onChange(n);
  };
  return (
    <input
      {...rest}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      disabled={disabled}
      placeholder={placeholder}
      data-step={step}
      value={draft ?? shown}
      onFocus={(e) => { setDraft(shown); requestAnimationFrame(() => e.target.select()); }}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d.,-]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setDraft(null); (e.target as HTMLInputElement).blur(); } }}
      className={cls}
    />
  );
}
