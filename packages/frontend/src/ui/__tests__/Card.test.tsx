import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { Card } from "../Card";

describe("Card", () => {
  it("renders children with pixel border and custom class", () => {
    render(() => <Card class="my-card">Content</Card>);
    const card = screen.getByText("Content");
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass("pixel-border", "my-card");
  });
});
