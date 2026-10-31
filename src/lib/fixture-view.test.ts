import { describe, expect, it } from "vitest";
import { fixtureVisible } from "./fixture-view";

describe("fixture view filter", () => {
  it("live hides lights at 0% unless highlighted", () => {
    expect(fixtureVisible("live", 0, false)).toBe(false);
    expect(fixtureVisible("live", 0, true)).toBe(true);
    expect(fixtureVisible("live", 0.5, false)).toBe(true);
  });
  it("highlighted view shows only highlighted lights", () => {
    expect(fixtureVisible("hl", 1, false)).toBe(false);
    expect(fixtureVisible("hl", 0, true)).toBe(true);
  });
});
