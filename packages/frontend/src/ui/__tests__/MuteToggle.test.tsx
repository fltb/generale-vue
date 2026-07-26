import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import MuteToggle from "../MuteToggle";

vi.mock("../sound", () => ({
  isMuted: () => false,
  toggleMuted: vi.fn(),
}));

describe("MuteToggle", () => {
  it("renders speaker button and merges custom class", () => {
    render(() => <MuteToggle class="my-btn" />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("my-btn");
  });
});
