import { Button } from "@/components/ui/button";
import { FIXTURE_ICONS, type FixtureIcon } from "@/lib/fixture-icons";
import { FixtureGlyph } from "./FixtureGlyph";

import { t as tr } from "@/lib/i18n";
export function FixtureIconPicker({ model, value = "auto", onChange }: { model: string; value?: FixtureIcon | undefined; onChange: (icon: FixtureIcon) => void }) {
  return <fieldset className="space-y-2">
    <legend className="text-[10px] font-semibold uppercase text-muted-foreground">{tr("Fixture icon")}</legend>
    <div className="grid grid-cols-3 gap-1.5">
      {FIXTURE_ICONS.map((icon) => <Button key={icon.id} type="button" variant="outline" aria-label={`Icon: ${icon.label}`} aria-pressed={value === icon.id} title={icon.label} onClick={() => onChange(icon.id)} className={`h-20 min-w-0 flex-col gap-0 px-1 py-1 ${value === icon.id ? "border-primary bg-primary/10 text-primary" : "bg-surface"}`}>
        <FixtureGlyph model={model} icon={icon.id} colour="var(--color-primary)" className="h-12! w-full! shrink-0" />
        <span className="w-full whitespace-normal text-center text-[10px] leading-tight">{icon.label}</span>
      </Button>)}
    </div>
  </fieldset>;
}