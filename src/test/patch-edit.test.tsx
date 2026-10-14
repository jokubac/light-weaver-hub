import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PatchPage } from "@/components/console/PatchPage";
import { getDef, normalizeFixture } from "@/lib/dmx";

vi.mock("@/lib/patch-pdf", () => ({ buildPatchPdf: vi.fn() }));
afterEach(cleanup);

function editor() {
  const fixture = normalizeFixture({ uid: "a", name: "Test light", address: 1, universe: 1 });
  const update = vi.fn();
  render(<PatchPage title="Test" fixtures={[fixture]} onClose={vi.fn()} onAdd={vi.fn()} onRemove={vi.fn()} onUpdate={update} onReplace={vi.fn()} onReorder={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit Test light" }));
  return { fixture, update };
}

it("edits universe without changing identity or position", () => {
  const { update } = editor();
  const field = screen.getByRole("textbox", { name: "Universe for Test light" });
  fireEvent.change(field, { target: { value: "2" } });
  fireEvent.blur(field);
  expect(update).toHaveBeenCalledWith("a", { universe: 2 });
});

it("edits the DMX address and keeps the full footprint within 512 channels", () => {
  const { fixture, update } = editor();
  const field = screen.getByRole("textbox", { name: "DMX address for Test light" });
  fireEvent.change(field, { target: { value: "512" } });
  fireEvent.blur(field);
  const channels = getDef(fixture.defId).modes[fixture.modeIdx]?.channels ?? 1;
  expect(update).toHaveBeenCalledWith("a", { address: 513 - channels });
});

it("updates the manufacturer mode index without replacing the fixture", () => {
  const { fixture, update } = editor();
  fireEvent.change(screen.getByRole("combobox", { name: "Mode for Test light" }), { target: { value: String(fixture.modeIdx) } });
  expect(update).toHaveBeenCalledWith("a", { modeIdx: fixture.modeIdx, address: 1 });
});