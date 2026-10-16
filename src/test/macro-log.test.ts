import { describe, expect, it } from "vitest";
import { appendLog, MAX_LOG, replaySchedule, type MacroLogEntry } from "@/lib/macro-log";

const e = (id: string, at: number): MacroLogEntry => ({ id, at, source: "key", macro: { id: "m", key: null, action: "cct_up", amount: 100 } });

describe("macro timeline", () => {
  it("replay keeps original spacing from the first entry", () => {
    expect(replaySchedule([e("b", 3500), e("a", 1000)]).map((s) => s.delay)).toEqual([0, 2500]);
  });
  it("replay at 2x halves the gaps", () => {
    expect(replaySchedule([e("a", 1000), e("b", 3000)], 2).map((s) => s.delay)).toEqual([0, 1000]);
  });
  it("keeps only the newest 500 entries", () => {
    let log: MacroLogEntry[] = [];
    for (let i = 0; i < MAX_LOG + 3; i++) log = appendLog(log, e(String(i), i));
    expect(log.length).toBe(500);
    expect(log[0]!.id).toBe("3");
  });
});
