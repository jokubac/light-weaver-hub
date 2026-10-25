import { it, expect } from "vitest";
import { getDef, isVerifiedDef } from "@/lib/dmx";
it("vortex verified", () => { expect(isVerifiedDef(getDef("creamsource-vortex8"))).toBe(true); expect(isVerifiedDef(getDef("arri-skypanel-s60-c"))).toBe(false); });
it("built-in Aputure 600c Pro uses the official chart", () => { expect(isVerifiedDef(getDef("aputure-600c-pro"))).toBe(true); expect(getDef("aputure-600c-pro").modes).toHaveLength(22); });
it("built-in Nova P600c and STORM 1200x use official charts", () => { expect(isVerifiedDef(getDef("aputure-nova-p600c"))).toBe(true); expect(isVerifiedDef(getDef("aputure-storm-1200x"))).toBe(true); });
