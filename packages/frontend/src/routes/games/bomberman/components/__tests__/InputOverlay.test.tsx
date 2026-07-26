import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { InputOverlay } from "../InputOverlay";

describe("InputOverlay", () => {
  it("renders with direction=left shows ◀ chip as active", () => {
    render(() => <InputOverlay direction="left" action={null} />);

    const leftChip = screen.getByText("◀");
    expect(leftChip).toBeInTheDocument();
    expect(leftChip).toHaveClass("bg-yellow-400", "text-black");
  });

  it("renders with action=PLACE_BOMB shows bomberman.placeBomb text", () => {
    render(() => <InputOverlay direction={null} action="PLACE_BOMB" />);

    // i18n global mock returns keys as-is
    expect(screen.getByText("bomberman.placeBomb")).toBeInTheDocument();
  });

  it("renders all four direction chips inactive when both are null", () => {
    render(() => <InputOverlay direction={null} action={null} />);

    const upChip = screen.getByText("▲");
    const downChip = screen.getByText("▼");
    const leftChip = screen.getByText("◀");
    const rightChip = screen.getByText("▶");

    for (const chip of [upChip, downChip, leftChip, rightChip]) {
      expect(chip).toHaveClass("bg-black/50", "text-white/40");
      expect(chip).not.toHaveClass("bg-yellow-400");
    }
  });

  it("renders with action=ACTION shows bomberman.action text", () => {
    render(() => <InputOverlay direction={null} action="ACTION" />);
    expect(screen.getByText("bomberman.action")).toBeInTheDocument();
  });

  it("renders with action=DETONATE shows bomberman.detonate text", () => {
    render(() => <InputOverlay direction={null} action="DETONATE" />);
    expect(screen.getByText("bomberman.detonate")).toBeInTheDocument();
  });

  it("hides action chip when action is null", () => {
    render(() => <InputOverlay direction={null} action={null} />);

    // Only direction chips should be visible, no action text
    expect(screen.queryByText("bomberman.placeBomb")).not.toBeInTheDocument();
    expect(screen.queryByText("bomberman.action")).not.toBeInTheDocument();
    expect(screen.queryByText("bomberman.detonate")).not.toBeInTheDocument();
  });

  it("shows different directions as active when changed", () => {
    const { unmount } = render(() => <InputOverlay direction="up" action={null} />);

    let upChip = screen.getByText("▲");
    expect(upChip).toHaveClass("bg-yellow-400", "text-black");

    unmount();

    render(() => <InputOverlay direction="down" action={null} />);

    let downChip = screen.getByText("▼");
    expect(downChip).toHaveClass("bg-yellow-400", "text-black");
  });
});
