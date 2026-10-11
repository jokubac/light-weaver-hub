export const FIXTURE_ICONS = [
  { id: "auto", label: "Model default" },
  { id: "tube-small", label: "Tube · small" },
  { id: "tube-big", label: "Tube · big" },
  { id: "tube-huge", label: "Tube · huge" },
  { id: "panel", label: "Panel light" },
  { id: "hard", label: "Hard light" },
  { id: "practical", label: "Practical" },
  { id: "bulb", label: "Bulb" },
  { id: "brick", label: "Brick light" },
  { id: "carpet", label: "Carpet light" },
  { id: "balloon", label: "Balloon light" },
  { id: "pocket", label: "Small · MC / DASH" },
] as const;

export type FixtureIcon = typeof FIXTURE_ICONS[number]["id"];
export function isFixtureIcon(value: unknown): value is FixtureIcon {
  return FIXTURE_ICONS.some((icon) => icon.id === value);
}