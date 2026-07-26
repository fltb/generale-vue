import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { Badge } from "../Badge";

describe("Badge", () => {
  it.each([
    ["success", "success", "badge-success"],
    ["outline", "outline", "badge-outline"],
  ] as const)("%s variant renders its expected class", (_name, variant, expectedClass) => {
    render(() => <Badge variant={variant}>Badge</Badge>);
    expect(screen.getByText("Badge")).toHaveClass(expectedClass);
  });

  it("renders children, pixel border, and custom class", () => {
    render(() => <Badge class="my-badge">Content</Badge>);
    const badge = screen.getByText("Content");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("pixel-border", "my-badge");
  });
});
