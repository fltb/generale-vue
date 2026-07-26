import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { Alert } from "../Alert";

describe("Alert", () => {
  it.each([
    ["default", undefined, "pixel-border"],
    ["error", "error", "alert-error"],
  ] as const)("%s variant renders its expected classes", (_name, variant, expectedClass) => {
    render(() => <Alert variant={variant}>Alert</Alert>);
    expect(screen.getByText("Alert")).toHaveClass(expectedClass);
  });

  it("renders children and merges custom class", () => {
    render(() => <Alert class="my-alert">Hello</Alert>);
    expect(screen.getByText("Hello")).toHaveClass("my-alert");
  });
});
