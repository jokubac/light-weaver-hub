import { describe, expect, it } from "vitest";
import { sceneColor, PROJECT_COLORS, type Scene } from "./store";

const project = { color: PROJECT_COLORS[0]! }; // cyan

describe("scene accent colour", () => {
  it("uses the project colour when no colour was picked for the scene", () => {
    const s = { id: "1", name: "Interview", createdAt: 0, fixtures: [], master: 1 } as Scene;
    expect(sceneColor(s, project)).toBe(PROJECT_COLORS[0]);
  });

  it("keeps the colour picked for that scene", () => {
    const s = { id: "1", name: "Interview", createdAt: 0, fixtures: [], master: 1, color: PROJECT_COLORS[4] } as Scene;
    expect(sceneColor(s, project)).toBe(PROJECT_COLORS[4]);
  });

  it("only changes the scene that was recoloured", () => {
    const scenes = [
      { id: "a", name: "A", createdAt: 0, fixtures: [], master: 1 },
      { id: "b", name: "B", createdAt: 0, fixtures: [], master: 1 },
    ] as Scene[];
    const next = scenes.map((s) => (s.id === "b" ? { ...s, color: PROJECT_COLORS[6] } : s));
    expect(sceneColor(next[0]!, project)).toBe(PROJECT_COLORS[0]);
    expect(sceneColor(next[1]!, project)).toBe(PROJECT_COLORS[6]);
  });
});
