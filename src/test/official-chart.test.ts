import { it, expect } from "vitest";
import { getDef, isVerifiedDef } from "@/lib/dmx";
it("vortex verified", () => { expect(isVerifiedDef(getDef("creamsource-vortex8"))).toBe(true); expect(isVerifiedDef(getDef("arri-skypanel-s60-c"))).toBe(false); });
