import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import Select from "../Select";

describe("Select", () => {
  it.each([
    ["default", undefined, "select"],
    ["small", "sm", "select-sm"],
    ["bordered", undefined, "select-bordered"],
  ] as const)("%s state renders its expected class", (_name, size, expectedClass) => {
    render(() => <Select size={size} bordered={expectedClass === "select-bordered"}><option>a</option></Select>);
    expect(screen.getByRole("combobox")).toHaveClass(expectedClass);
  });

  it("forwards onChange and renders children options", () => {
    const handle = vi.fn();
    render(() => <Select onChange={handle}><option value="a">A</option><option value="b">B</option></Select>);
    const select = screen.getByRole("combobox");
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "a" } });
    expect(handle).toHaveBeenCalled();
  });
});
