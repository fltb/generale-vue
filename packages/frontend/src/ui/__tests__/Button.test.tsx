import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { Button } from "../Button";

vi.mock("../sound", () => ({
  sfx: { click: vi.fn() },
}));

describe("Button", () => {
  it.each([
    ["variant", <Button variant="primary">Button</Button>, "btn-primary"],
    ["size", <Button size="sm">Button</Button>, "btn-sm"],
    ["active", <Button active>Button</Button>, "btn-active"],
    ["outline", <Button outline>Button</Button>, "btn-outline"],
    ["circle", <Button circle>Button</Button>, "btn-circle"],
    ["block", <Button block>Button</Button>, "btn-block"],
  ] as const)("%s state renders its expected class", (_name, element, expectedClass) => {
    render(() => element);
    expect(screen.getByRole("button", { name: "Button" })).toHaveClass(expectedClass);
  });

  it("renders children, default classes, and custom class", () => {
    render(() => <Button class="my-custom">Custom</Button>);
    const button = screen.getByRole("button", { name: "Custom" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("btn", "my-custom");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(() => <Button onClick={onClick}>Clickable</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Clickable" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders disabled button", () => {
    render(() => <Button disabled>Disabled</Button>);
    expect(screen.getByRole("button", { name: "Disabled" })).toBeDisabled();
  });
});
