import { describe, expect, it, vi } from "vitest";
import { createPlotEditSession } from "@/lib/plot-edit-session";

describe("Plot editing session", () => {
  it("starts locked and rejected requests remain locked", () => {
    const session = createPlotEditSession();
    expect(session.isUnlocked()).toBe(false);
    expect(session.request(() => false)).toBe(false);
    expect(session.isUnlocked()).toBe(false);
  });
  it("asks once after approval and remains unlocked for later plot visits", () => {
    const session = createPlotEditSession();
    const approve = vi.fn(() => true);
    expect(session.request(approve)).toBe(true);
    expect(session.isUnlocked()).toBe(true);
    expect(session.request(approve)).toBe(true);
    expect(approve).toHaveBeenCalledTimes(1);
  });
});