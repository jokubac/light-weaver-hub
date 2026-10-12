// Manual custom-fixture creation: manufacturer, model, watts, and one or more
// DMX modes built from an ordered list of channel attributes.
import { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, X } from "lucide-react";
import type { ChannelAttr } from "@/lib/dmx";
import { buildMode } from "@/lib/gdtf";
import { addCustomFixture } from "@/lib/custom-fixtures";
import type { FixtureDef, FixtureMode } from "@/lib/dmx";

interface ChannelEntry { attr: ChannelAttr; fine?: boolean }
interface DraftMode { name: string; entries: ChannelEntry[] }

const ATTR_OPTIONS: { label: string; attr: ChannelAttr; fine?: boolean }[] = [
  { label: "Dimmer", attr: "Dimmer" },
  { label: "Dimmer fine", attr: "Dimmer", fine: true },
  { label: "CCT", attr: "CCT" },
  { label: "Green/Magenta", attr: "GM" },
  { label: "Hue", attr: "Hue" },
  { label: "Saturation", attr: "Saturation" },
  { label: "Red", attr: "Red" },
  { label: "Green", attr: "Green" },
  { label: "Blue", attr: "Blue" },
  { label: "White", attr: "White" },
  { label: "Amber", attr: "Amber" },
  { label: "Crossfade", attr: "Crossfade" },
  { label: "Strobe", attr: "Strobe" },
  { label: "Spare", attr: "Spare" },
];
const attrLabel = (e: ChannelEntry) => ATTR_OPTIONS.find((o) => o.attr === e.attr && !!o.fine === !!e.fine)?.label ?? e.attr;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const inputCls = "w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

export function FixtureBuilder({ onClose, onCreated }: { onClose: () => void; onCreated: (def: FixtureDef) => void }) {
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [watts, setWatts] = useState<number | "">("");
  const [modes, setModes] = useState<DraftMode[]>([{ name: "Mode 1", entries: [{ attr: "Dimmer" }] }]);

  const updateMode = (i: number, patch: Partial<DraftMode>) => setModes((ms) => ms.map((m, j) => (i === j ? { ...m, ...patch } : m)));
  const addChannel = (i: number, opt: { attr: ChannelAttr; fine?: boolean }) => updateMode(i, { entries: [...modes[i]!.entries, { attr: opt.attr, ...(opt.fine ? { fine: true } : {}) }] });
  const removeChannel = (i: number, c: number) => updateMode(i, { entries: modes[i]!.entries.filter((_, k) => k !== c) });
  const moveChannel = (i: number, c: number, dir: -1 | 1) => {
    const entries = [...modes[i]!.entries];
    const j = c + dir;
    if (j < 0 || j >= entries.length) return;
    [entries[c], entries[j]] = [entries[j]!, entries[c]!];
    updateMode(i, { entries });
  };
  const addMode = () => setModes((ms) => [...ms, { name: `Mode ${ms.length + 1}`, entries: [{ attr: "Dimmer" }] }]);
  const removeMode = (i: number) => setModes((ms) => ms.filter((_, j) => j !== i));

  const canSave = manufacturer.trim() && model.trim() && modes.length > 0 && modes.every((m) => m.name.trim() && m.entries.length > 0);

  const save = () => {
    if (!canSave) return;
    const fixtureModes: FixtureMode[] = modes.map((m) => ({ ...buildMode(m.name.trim(), m.entries), ...(watts ? {} : {}) }));
    const def: FixtureDef = {
      id: `custom-${slug(`${manufacturer} ${model}`)}-${Date.now().toString(36)}`,
      brand: manufacturer.trim(),
      model: watts ? `${model.trim()} (${watts}W)` : model.trim(),
      modes: fixtureModes,
    };
    addCustomFixture(def);
    onCreated(def);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-lg bg-surface p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider">Fixture builder</h3>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Manufacturer</span>
            <input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className={inputCls} placeholder="Acme" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Model</span>
            <input value={model} onChange={(e) => setModel(e.target.value)} className={inputCls} placeholder="Par 100" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Watts (optional)</span>
            <input type="number" min={0} value={watts} onChange={(e) => setWatts(e.target.value === "" ? "" : +e.target.value)} className={inputCls} placeholder="100" />
          </label>
        </div>

        <div className="space-y-3">
          {modes.map((mode, i) => (
            <div key={i} className="space-y-2 rounded-lg bg-surface-elevated p-2.5">
              <div className="flex items-center gap-2">
                <input value={mode.name} onChange={(e) => updateMode(i, { name: e.target.value })} className={`${inputCls} flex-1`} placeholder="Mode name" />
                {modes.length > 1 && <button onClick={() => removeMode(i)} aria-label="Remove mode" className="rounded p-1.5 text-destructive"><Trash2 className="h-4 w-4" /></button>}
              </div>
              <div className="space-y-1">
                {mode.entries.map((e, c) => (
                  <div key={c} className="flex items-center gap-1.5 rounded bg-surface px-2 py-1 text-xs">
                    <span className="w-6 shrink-0 font-mono text-muted-foreground">{c + 1}</span>
                    <span className="flex-1 font-semibold">{attrLabel(e)}</span>
                    <button onClick={() => moveChannel(i, c, -1)} disabled={c === 0} aria-label="Move up" className="rounded p-1 text-muted-foreground disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button onClick={() => moveChannel(i, c, 1)} disabled={c === mode.entries.length - 1} aria-label="Move down" className="rounded p-1 text-muted-foreground disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button onClick={() => removeChannel(i, c)} aria-label="Remove channel" className="rounded p-1 text-destructive"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {ATTR_OPTIONS.map((opt) => (
                  <button key={opt.label} onClick={() => addChannel(i, opt)} className="rounded-md bg-surface px-2 py-1 text-[11px] font-semibold hover:bg-surface/70">
                    + {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">{mode.entries.length} ch</p>
            </div>
          ))}
          <button onClick={addMode} className="flex w-full items-center justify-center gap-1 rounded-md bg-surface-elevated py-2 text-xs font-semibold"><Plus className="h-3.5 w-3.5" />Add mode</button>
        </div>

        <button disabled={!canSave} onClick={save} className="rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">
          Save fixture
        </button>
      </div>
    </div>
  );
}
