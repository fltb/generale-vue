import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { Checkbox } from "../Checkbox";

describe("Checkbox", () => {
  it.each([
    ["default", undefined],
    ["small", "sm"],
  ] as const)("%s checkbox renders", (_name, size) => {
    render(() => <Checkbox size={size} />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("applies size and custom classes", () => {
    render(() => <Checkbox size="sm" class="my-cb" />);
    expect(screen.getByRole("checkbox")).toHaveClass("checkbox-sm", "my-cb");
  });

  it("renders checked and disabled states", () => {
    render(() => <Checkbox checked disabled />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();
  });

  it("triggers onChange", () => {
    let changed = false;
    render(() => <Checkbox onChange={() => { changed = true; }} />);
    screen.getByRole("checkbox").click();
    expect(changed).toBe(true);
  });
});
