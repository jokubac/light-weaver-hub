import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FIXTURE_ICONS } from "@/lib/fixture-icons";
import { createFixture, getDef, normalizeFixture } from "@/lib/dmx";
import { buildUniverses } from "@/lib/output";
import { copyFixtureSettings } from "@/lib/fixture-settings";
import { FixtureGlyph } from "@/components/console/FixtureGlyph";
import { GroupsPanel } from "@/components/console/GroupsPanel";
import { loadProjects, saveProjects } from "@/lib/store";

describe("Fixture icon persistence", () => {
  const fixture = createFixture(getDef("astera-titan-tube"), 0, 2, 17, "Titan");
  it("retains every icon after project save/load without changing output or copied settings", () => {
    for (const { id } of FIXTURE_ICONS) {
      const changed = { ...fixture, icon: id };
      saveProjects([{ id: "icons", name: "Icons", color: "test", createdAt: 1, scenes: [{ id: "scene", name: "Set", createdAt: 1, master: 1, fixtures: [changed] }] }]);
      expect(loadProjects()[0]?.scenes[0]?.fixtures[0]?.icon).toBe(id);
      expect(buildUniverses([changed], 0, 1, new Map())).toEqual(buildUniverses([fixture], 0, 1, new Map()));
      expect(copyFixtureSettings(changed)).not.toHaveProperty("icon");
    }
  });
  it("keeps legacy model defaults and ignores invalid stored choices", () => {
    expect(normalizeFixture({ ...fixture }).icon).toBeUndefined();
    expect(normalizeFixture({ ...fixture, icon: "invalid" }).icon).toBeUndefined();
  });
  it("renders all distinct bodies", () => {
    const bodies = new Set<string>();
    for (const { id } of FIXTURE_ICONS.filter((x) => x.id !== "auto")) {
      const { container, unmount } = render(<FixtureGlyph model="Titan" icon={id} colour="currentColor" />);
      bodies.add(container.querySelector("g")?.innerHTML ?? "");
      unmount();
    }
    expect(bodies.size).toBe(FIXTURE_ICONS.length - 1);
  });
});

describe("Collapsible named groups", () => {
  it("hides group details while keeping selection and rename available", () => {
    const fixture = { ...createFixture(getDef("astera-titan-tube"), 0, 1, 1, "Titan"), group: "Key" };
    render(<GroupsPanel fixtures={[fixture]} selected={[]} onSelect={() => {}} onCreate={() => {}} onRename={() => {}} onUngroup={() => {}} onUpdate={() => {}} onCopy={() => {}} />);
    expect(screen.getByRole("slider", { name: "Key intensity" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Collapse group Key" }));
    expect(screen.queryByRole("slider", { name: "Key intensity" })).toBeNull();
    expect(screen.getByRole("button", { name: "Rename group Key" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Expand group Key" }));
    expect(screen.getByRole("slider", { name: "Key intensity" })).toBeTruthy();
  });
});