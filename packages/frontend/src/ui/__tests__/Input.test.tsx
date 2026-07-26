import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { Input } from "../Input";

describe("Input", () => {
  it("renders with placeholder and default pixel border", () => {
    render(() => <Input placeholder="Enter text" />);
    const input = screen.getByPlaceholderText("Enter text");
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass("pixel-border");
  });

  it.each([
    ["small", <Input size="sm" />, "input-sm"],
    ["bordered", <Input bordered />, "input-bordered"],
  ] as const)("%s variant renders its expected class", (_name, element, expectedClass) => {
    render(() => element);
    expect(screen.getByRole("textbox")).toHaveClass(expectedClass);
  });

  it("merges custom class", () => {
    render(() => <Input class="my-input" />);
    expect(screen.getByRole("textbox")).toHaveClass("my-input");
  });

  it("forwards value and onInput", () => {
    const handleInput = vi.fn();
    render(() => <Input value="hello" onInput={handleInput} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("hello");
    fireEvent.input(input, { target: { value: "world" } });
    expect(handleInput).toHaveBeenCalled();
  });

  it("renders disabled input", () => {
    render(() => <Input disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});
