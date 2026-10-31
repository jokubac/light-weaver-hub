/** FIXTURES board view filter: everything, only lights giving output, only highlighted, or what is live on stage. */
export type FixtureView = "all" | "live" | "hl" | "stage";
/**
 * `level` is the programmer output; `live` is what is really going out to the stage
 * (the frozen frame while Blind is on) and drives the "Show: live" view.
 */
export function fixtureVisible(view: FixtureView, level: number, highlighted: boolean, live = level): boolean {
  if (view === "all") return true;
  if (view === "hl") return highlighted;
  if (view === "stage") return highlighted || live > 0.001;
  return highlighted || level > 0.001;
}
