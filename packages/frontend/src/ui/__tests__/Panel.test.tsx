import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import Panel from "../Panel";

describe("Panel", () => {
  it.each([
    ["default", undefined, "bg-base-200"],
    ["custom tone", "base-300", "bg-base-300"],
  ] as const)("%s tone renders its expected class and children", (_name, tone, expectedClass) => {
    render(() => <Panel tone={tone}>body</Panel>);
    expect(screen.getByText("body")).toHaveClass(expectedClass);
  });

  it("renders title and applies title and panel classes", () => {
    render(() => <Panel title="Title" titleClass="text-lg" class="my-panel">body</Panel>);
    expect(screen.getByText("Title")).toHaveClass("text-lg");
    expect(screen.getByText("body")).toHaveClass("my-panel");
  });
});
