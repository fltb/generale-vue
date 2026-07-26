import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { Overlay, TakeoverOverlay } from "../Overlay";

describe("Overlay", () => {
  it.each([
    ["default", undefined, "bg-black/70"],
    ["dimmed", 60, "bg-black/60"],
  ] as const)("%s state renders children and its expected classes", (_name, dim, expectedClass) => {
    render(() => <Overlay dim={dim}>content</Overlay>);
    const content = screen.getByText("content");
    expect(content).toBeInTheDocument();
    expect(content).toHaveClass("fixed", "inset-0", expectedClass);
  });

  it("merges custom class", () => {
    render(() => <Overlay class="z-50">content</Overlay>);
    expect(screen.getByText("content")).toHaveClass("z-50");
  });
});

describe("TakeoverOverlay", () => {
  it.each([
    ["default", undefined, /This page has been taken over/],
    ["game", "game", "Takeover description"],
  ] as const)("%s scope renders takeover content", (_name, scope, expectedText) => {
    render(() => <TakeoverOverlay scope={scope} />);
    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });
});
