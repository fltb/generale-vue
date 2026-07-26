import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import Range from "../Range";

describe("Range", () => {
  it.each([
    ["default", undefined, "range"],
    ["primary", "primary", "range-primary"],
  ] as const)("%s variant renders its expected class", (_name, variant, expectedClass) => {
    render(() => <Range variant={variant} />);
    expect(screen.getByRole("slider")).toHaveClass(expectedClass);
  });

  it("forwards value and onInput", () => {
    const handle = vi.fn();
    render(() => <Range value={5} onInput={handle} />);
    const input = screen.getByRole("slider") as HTMLInputElement;
    expect(input.value).toBe("5");
    fireEvent.input(input, { target: { value: "7" } });
    expect(handle).toHaveBeenCalled();
  });
});
