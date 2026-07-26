import { describe, it, expect } from "vitest";
import { render } from "@solidjs/testing-library";
import Spinner from "../Spinner";

describe("Spinner", () => {
  it.each([
    ["default", undefined, "loading-md"],
    ["large", "lg", "loading-lg"],
  ] as const)("%s size renders spinner classes", (_name, size, expectedSizeClass) => {
    const { container } = render(() => <Spinner size={size} />);
    const spinner = container.firstElementChild;
    expect(spinner).toHaveClass("loading", "loading-spinner", expectedSizeClass);
  });

  it("merges custom class", () => {
    const { container } = render(() => <Spinner class="my-spinner" />);
    expect(container.firstElementChild).toHaveClass("my-spinner");
  });
});
