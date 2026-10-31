/** FIXTURES board view filter: everything, only lights giving output (highlighted lights always stay), or only highlighted lights. */
export type FixtureView = "all" | "live" | "hl";
export function fixtureVisible(view: FixtureView, level: number, highlighted: boolean): boolean {
  if (view === "all") return true;
  if (view === "hl") return highlighted;
  return highlighted || level > 0.001;
}
