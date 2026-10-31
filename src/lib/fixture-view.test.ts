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
  it("stage view follows the live output, not the programmer", () => {
    // edited bright while Blind is on, but the audience still sees it dark
    expect(fixtureVisible("stage", 0.8, false, 0)).toBe(false);
    // dark in the programmer, still lit on stage
    expect(fixtureVisible("stage", 0, false, 0.6)).toBe(true);
    // marked lights never vanish
    expect(fixtureVisible("stage", 0, true, 0)).toBe(true);
    // without Blind the live level is the programmer level
    expect(fixtureVisible("stage", 0.4, false)).toBe(true);
  });
});
