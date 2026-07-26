import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import Textarea from "../Textarea";

describe("Textarea", () => {
  it.each([
    ["default", false, "textarea"],
    ["bordered", true, "textarea-bordered"],
  ] as const)("%s state renders its expected class", (_name, bordered, expectedClass) => {
    render(() => <Textarea bordered={bordered} />);
    expect(screen.getByRole("textbox")).toHaveClass(expectedClass);
  });

  it("renders with placeholder and forwards value and onInput", () => {
    const handle = vi.fn();
    render(() => <Textarea placeholder="Type here" value="hello" onInput={handle} />);
    const textarea = screen.getByPlaceholderText("Type here") as HTMLTextAreaElement;
    expect(textarea).toHaveValue("hello");
    fireEvent.input(textarea, { target: { value: "world" } });
    expect(handle).toHaveBeenCalled();
  });

  it("renders disabled", () => {
    render(() => <Textarea disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});
