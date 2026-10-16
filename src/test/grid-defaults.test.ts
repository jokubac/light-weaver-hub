import { describe, expect, it } from "vitest";
import { emptyGrid } from "@/components/console/GridBoard";

/** A brand-new scene's GRID must start with the two tables the user set up by hand, in the exact order they asked for. */
describe("default GRID tables", () => {
  const grid = emptyGrid();
  const label = (i: (typeof grid.items)[number]) => (i.kind === "macro" ? i.macro!.label : i.text);
  const tools = grid.items.filter((i) => i.kind === "macro" && i.tbl === "def-tools");

  it("opens with MACROS and TOOLS tables", () => {
    expect(grid.items.filter((i) => i.kind === "table").map(label)).toEqual(["MACROS", "TOOLS"]);
  });

  it("puts Redo above Check out! in the TOOLS table", () => {
    expect(tools.map(label)).toEqual(["Copy", "Paste", "Redo", "Undo", "Check out!", "Locate!"]);
    const y = (l: string) => tools.find((i) => label(i) === l)!.y;
    expect(y("Redo")).toBeLessThan(y("Check out!"));
    expect(tools.find((i) => label(i) === "Redo")!.color).toBe("#22C55E");
    expect(tools.find((i) => label(i) === "Check out!")!.color).toBe("#A855F7");
  });

  it("keeps the MACROS buttons and faders", () => {
    const macros = grid.items.filter((i) => i.kind === "macro" && i.tbl === "def-macros");
    expect(macros.map(label)).toEqual([
      "Intensity + 5%",
      "Intensity − 5%",
      "CCT + 100K",
      "CCT − 100K",
      "Intensity fader",
      "CCT fader",
    ]);
  });
});
