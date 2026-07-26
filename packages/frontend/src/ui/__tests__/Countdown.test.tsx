import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import Countdown from "../Countdown";

vi.mock("../sound", () => ({
  sfx: { countdownBeep: vi.fn(), go: vi.fn() },
}));

describe("Countdown", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders starting number", () => {
    render(() => <Countdown from={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });
  it("calls onDone after countdown completes", () => {
    const onDone = vi.fn();
    render(() => <Countdown from={2} onDone={onDone} />);
    vi.advanceTimersByTime(2800);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
  it("shows 开战 after countdown", () => {
    render(() => <Countdown from={1} />);
    vi.advanceTimersByTime(1000);
    expect(screen.getByText("Go!")).toBeInTheDocument();
  });
});
