
import { describe as d2, it as i2, expect as e2 } from "vitest";
import { parseCommand as pc } from "./command-line";
d2("pattern selection", () => {
  i2("1 THRU 10 NTH 3 keeps every 3rd", () => e2(pc("1 THRU 10 NTH 3", 20).select).toEqual([1, 4, 7, 10]));
  i2("1 THRU 6 EVEN picks 2,4,6", () => e2(pc("1 THRU 6 EVEN", 20).select).toEqual([2, 4, 6]));
  i2("ODD alone thins the current selection", () => e2(pc("ODD", 20).pattern).toEqual({ step: 2, offset: 0 }));
  i2("NTH 4 alone thins the selection every 4th", () => e2(pc("NTH 4", 20).pattern).toEqual({ step: 4, offset: 0 }));
  i2("NTH without number is an error", () => e2(pc("1 THRU 4 NTH", 20).error).toBeTruthy());
});

d2("REC on the command line", () => {
  i2("records a typed selection as a numbered cue with merge", () => {
    const r = pc("1 THRU 3 REC 5 MERGE", 10);
    e2(r.select).toEqual([1, 2, 3]);
    e2(r.rec).toEqual({ kind: "cue", n: 5, mode: "merge" });
  });
  i2("supports REC FX / LOOK / TIMELINE alone", () => {
    e2(pc("REC FX", 4).rec).toEqual({ kind: "fx" });
    e2(pc("REC TIMELINE", 4).rec).toEqual({ kind: "timeline" });
  });
  i2("accepts SEQUENCE as an alias for TIMELINE", () => {
    e2(pc("REC SEQUENCE", 4).rec).toEqual({ kind: "timeline" });
  });
  i2("rejects MERGE without a cue number", () => {
    e2(pc("REC MERGE", 4).error).toBeTruthy();
  });
});
