import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GroupsPanel } from "@/components/console/GroupsPanel";
import { normalizeFixture } from "@/lib/dmx";

afterEach(cleanup);

it("adds selected lights to an existing group without removing current members", () => {
  const fixtures = [normalizeFixture({ uid: "a", name: "First", group: "Set" }), normalizeFixture({ uid: "b", name: "Second" })];
  const added = vi.fn();
  render(<GroupsPanel fixtures={fixtures} selected={["b"]} onSelect={vi.fn()} onCreate={added} onRename={vi.fn()} onUngroup={vi.fn()} onUpdate={vi.fn()} onCopy={vi.fn()} onRemoveMember={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Add selected lights to Set" }));
  expect(added).toHaveBeenCalledWith("Set");
  expect(fixtures[0]?.group).toBe("Set");
});

it("does not allow adding when only existing members are selected", () => {
  render(<GroupsPanel fixtures={[normalizeFixture({ uid: "a", group: "Set" })]} selected={["a"]} onSelect={vi.fn()} onCreate={vi.fn()} onRename={vi.fn()} onUngroup={vi.fn()} onUpdate={vi.fn()} onCopy={vi.fn()} onRemoveMember={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Add selected lights to Set" })).toBeDisabled();
});