import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Keypad } from "@/components/console/Keypad";

afterEach(cleanup);

describe("Keypad CLEAR", () => {
  const mount = () => {
    const onDeselect = vi.fn();
    render(<Keypad count={12} selectedNums={[6, 9]} onDeselect={onDeselect} onRun={vi.fn()} onStep={vi.fn()} onFlash={vi.fn()} onClose={vi.fn()} />);
    return onDeselect;
  };
  it("clears command text on one click without deselecting fixtures", () => {
    const deselect = mount();
    const input = screen.getByRole("textbox", { name: "Command line" });
    fireEvent.change(input, { target: { value: "6 + 9 @ 80" } });
    fireEvent.click(screen.getByRole("button", { name: "CLEAR" }));
    expect(input).toHaveValue("");
    expect(deselect).not.toHaveBeenCalled();
  });
  it("deselects fixtures on a double click", () => {
    const deselect = mount();
    fireEvent.doubleClick(screen.getByRole("button", { name: "CLEAR" }));
    expect(deselect).toHaveBeenCalledTimes(1);
  });
});