import { describe, expect, it } from "vitest";
import { wallSegments, wallPanels, rayBlocked, segmentDistance, type Opening } from "@/lib/plot-geometry";
import { objectContains } from "@/lib/plot-objects";
import { editHistory } from "@/lib/edit-history";

const walls = wallSegments([{ pts: [[5, 0], [5, 10]] }], 0);
const door: Opening = { id: "door", kind: "door", stroke: 0, segment: 0, center: 0.5, width: 1, bottom: 0, height: 2.1 };
describe("Light through wall openings", () => {
  it("hits the middle of a long wall and respects edited wall heights", () => {
    expect(segmentDistance([5, 0.2], [0, 0], [10, 0]).distance).toBeCloseTo(0.2);
    const low = wallSegments([{pts:[[5,0],[5,10]],height:0.8}],0);
    expect(rayBlocked([2,5,2],[8,5,0],low,[])).toBe(false);
    const high = wallSegments([{pts:[[5,0],[5,10]],height:4}],0);
    expect(rayBlocked([2,5,6],[8,5,0],high,[])).toBe(true);
    const wall = low[0]; if (!wall) throw new Error("No wall");
    expect(wallPanels(wall,[])).toEqual([[0,1,0,0.8]]);
  });
  it("selects rotated furniture by its actual footprint", () => {
    const sofa = {id:"s",kind:"sofa" as const,name:"Sofa",x:5,y:5,w:2,d:1,h:.8,rot:90,floor:0};
    expect(objectContains(sofa,5,5.9)).toBe(true);
    expect(objectContains(sofa,5.9,5)).toBe(false);
  });
  it("blocks an opaque wall but passes through a doorway", () => {
    expect(rayBlocked([2, 5, 2], [8, 5, 0], walls, [])).toBe(true);
    expect(rayBlocked([2, 5, 2], [8, 5, 0], walls, [door])).toBe(false);
    expect(rayBlocked([2, 3, 2], [8, 3, 0], walls, [door])).toBe(true);
  });
  it("passes windows only between their sill and top", () => {
    const window = { ...door, kind: "window" as const, bottom: 0.9, height: 1.2 };
    expect(rayBlocked([2, 5, 2], [8, 5, 0], walls, [window])).toBe(false);
    expect(rayBlocked([2, 5, 1], [8, 5, 0], walls, [window])).toBe(true);
    expect(rayBlocked([2, 5, 5], [8, 5, 0], walls, [window])).toBe(true);
    expect(rayBlocked([2, 5, 6], [8, 5, 0], walls, [window])).toBe(false);
  });
  it("a second opaque wall still blocks light beyond an opening", () => {
    const both = wallSegments([{ pts: [[5, 0], [5, 10]] }, { pts: [[7, 0], [7, 10]] }], 0);
    expect(rayBlocked([2, 5, 2], [8, 5, 0], both, [door])).toBe(true);
  });
  it("cuts actual 3D wall panels around openings and keeps floors separate", () => {
    const wall = walls[0];
    if (!wall) throw new Error("Missing wall");
    expect(wallPanels(wall, [door])).toEqual([[0, 0.45, 0, 2.6], [0.45, 0.55, 2.1, 2.6], [0.55, 1, 0, 2.6]]);
    expect(wallSegments([{ pts: [[0, 0], [1, 1]], floor: 1 }], 0)).toEqual([]);
  });
});
describe("Undo / redo", () => {
  it("restores edits, isolates snapshots, and clears redo after a new edit", () => {
    const history = editHistory<{ x: number }>();
    const original = { x: 1 };
    history.push(original); original.x = 10;
    expect(history.undo({ x: 2 })).toEqual({ x: 1 });
    expect(history.redo({ x: 1 })).toEqual({ x: 2 });
    history.undo({ x: 2 }); history.push({ x: 3 });
    expect(history.canRedo).toBe(false);
    expect(history.undo({ x: 4 })).toEqual({ x: 3 });
  });
});