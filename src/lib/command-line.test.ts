
import { describe as d2, it as i2, expect as e2 } from "vitest";
import { parseCommand as pc } from "./command-line";
d2("pattern selection", () => {
  i2("1 THRU 10 NTH 3 keeps every 3rd", () => e2(pc("1 THRU 10 NTH 3", 20).select).toEqual([1, 4, 7, 10]));
  i2("1 THRU 6 EVEN picks 2,4,6", () => e2(pc("1 THRU 6 EVEN", 20).select).toEqual([2, 4, 6]));
  i2("ODD alone thins the current selection", () => e2(pc("ODD", 20).pattern).toEqual({ step: 2, offset: 0 }));
  i2("NTH 4 alone thins the selection every 4th", () => e2(pc("NTH 4", 20).pattern).toEqual({ step: 4, offset: 0 }));
  i2("NTH without number is an error", () => e2(pc("1 THRU 4 NTH", 20).error).toBeTruthy());
});

describe("REC on the command line", () => {
  it("records a typed selection as a numbered cue with merge", () => {
    const r = parseCommand("1 THRU 3 REC 5 MERGE", 10);
    expect(r.select).toEqual([1, 2, 3]);
    expect(r.rec).toEqual({ kind: "cue", n: 5, mode: "merge" });
  });
  it("supports REC FX / LOOK / TIMELINE alone", () => {
    expect(parseCommand("REC FX", 4).rec).toEqual({ kind: "fx" });
    expect(parseCommand("REC TIMELINE", 4).rec).toEqual({ kind: "timeline" });
  });
  it("rejects MERGE without a cue number", () => {
    expect(parseCommand("REC MERGE", 4).error).toBeTruthy();
  });
});
