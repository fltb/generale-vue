import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { VirtualControls } from "../VirtualControls";

// ─── Tests ───

describe("VirtualControls", () => {
  beforeEach(() => {
    // happy-dom does not implement pointer capture methods natively.
    // Define concrete no-ops before spying so vi.spyOn has something to wrap.
    HTMLButtonElement.prototype.setPointerCapture ??= () => {};
    HTMLButtonElement.prototype.releasePointerCapture ??= () => {};
    HTMLButtonElement.prototype.hasPointerCapture ??= () => false;
    vi.spyOn(HTMLButtonElement.prototype, "setPointerCapture").mockImplementation(vi.fn());
    vi.spyOn(HTMLButtonElement.prototype, "hasPointerCapture").mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });



  // ─── Render smoke tests ───

  it("renders all four direction buttons", () => {
    render(() => (
      <VirtualControls pressDirection={vi.fn()} releaseDirection={vi.fn()} onAction={vi.fn()} />
    ));

    expect(screen.getByText("▲")).toBeInTheDocument();
    expect(screen.getByText("▼")).toBeInTheDocument();
    expect(screen.getByText("◀")).toBeInTheDocument();
    expect(screen.getByText("▶")).toBeInTheDocument();
  });

  it("renders action buttons with i18n labels", () => {
    render(() => (
      <VirtualControls pressDirection={vi.fn()} releaseDirection={vi.fn()} onAction={vi.fn()} />
    ));

    // i18n global mock returns keys as-is; no I18nProvider needed
    expect(screen.getByText("bomberman.action")).toBeInTheDocument();
    expect(screen.getByText("bomberman.detonate")).toBeInTheDocument();
    expect(screen.getByText("bomberman.surrender")).toBeInTheDocument();
  });

  it("renders bomb button with emoji", () => {
    render(() => (
      <VirtualControls pressDirection={vi.fn()} releaseDirection={vi.fn()} onAction={vi.fn()} />
    ));

    expect(screen.getByText("💣")).toBeInTheDocument();
  });

  // ─── Pointer event behavior ───

  it("pointerdown calls setPointerCapture then pressDirection", () => {
    const pressDirection = vi.fn();
    const releaseDirection = vi.fn();

    render(() => (
      <VirtualControls
        pressDirection={pressDirection}
        releaseDirection={releaseDirection}
        onAction={vi.fn()}
      />
    ));

    const upBtn = screen.getByText("▲");
    const pointerId = 777;

    upBtn.dispatchEvent(new PointerEvent("pointerdown", { pointerId, bubbles: true, cancelable: true }));

    expect(HTMLButtonElement.prototype.setPointerCapture).toHaveBeenCalledWith(pointerId);
    expect(pressDirection).toHaveBeenCalledTimes(1);
    expect(pressDirection).toHaveBeenCalledWith(`pointer:${pointerId}`, "up");
  });

  it("pointerdown on each direction button uses correct direction and sourceId per pointerId", () => {
    const pressDirection = vi.fn();
    const releaseDirection = vi.fn();

    render(() => (
      <VirtualControls
        pressDirection={pressDirection}
        releaseDirection={releaseDirection}
        onAction={vi.fn()}
      />
    ));

    screen.getByText("◀").dispatchEvent(
      new PointerEvent("pointerdown", { pointerId: 1, bubbles: true, cancelable: true }),
    );
    expect(pressDirection).toHaveBeenCalledWith("pointer:1", "left");

    screen.getByText("▼").dispatchEvent(
      new PointerEvent("pointerdown", { pointerId: 2, bubbles: true, cancelable: true }),
    );
    expect(pressDirection).toHaveBeenCalledWith("pointer:2", "down");

    screen.getByText("▶").dispatchEvent(
      new PointerEvent("pointerdown", { pointerId: 3, bubbles: true, cancelable: true }),
    );
    expect(pressDirection).toHaveBeenCalledWith("pointer:3", "right");
  });

  it("pointerup dispatched after pointerdown produces exactly one release", () => {
    const pressDirection = vi.fn();
    const releaseDirection = vi.fn();
    const onAction = vi.fn();

    render(() => (
      <VirtualControls
        pressDirection={pressDirection}
        releaseDirection={releaseDirection}
        onAction={onAction}
      />
    ));

    const upBtn = screen.getByText("▲");
    const pointerId = 42;

    upBtn.dispatchEvent(new PointerEvent("pointerdown", { pointerId, bubbles: true, cancelable: true }));
    expect(pressDirection).toHaveBeenCalledTimes(1);

    upBtn.dispatchEvent(new PointerEvent("pointerup", { pointerId, bubbles: true }));
    expect(releaseDirection).toHaveBeenCalledTimes(1);
    expect(releaseDirection).toHaveBeenCalledWith(`pointer:${pointerId}`);

    // Subsequent lostpointercapture must not duplicate
    upBtn.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId, bubbles: true }));
    expect(releaseDirection).toHaveBeenCalledTimes(1);
    expect(onAction).not.toHaveBeenCalled(); // only direction events, no action
  });

  it("pointerup after pointerdown with different pointerId does not trigger release for the original", () => {
    const pressDirection = vi.fn();
    const releaseDirection = vi.fn();

    render(() => (
      <VirtualControls
        pressDirection={pressDirection}
        releaseDirection={releaseDirection}
        onAction={vi.fn()}
      />
    ));

    const upBtn = screen.getByText("▲");

    upBtn.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 10, bubbles: true, cancelable: true }));
    expect(pressDirection).toHaveBeenCalledWith("pointer:10", "up");

    // pointerup with different pointerId — the component guards against mismatch,
    // so releaseDirection is not called at all (pointerId 99 != captured pointerId 10)
    upBtn.dispatchEvent(new PointerEvent("pointerup", { pointerId: 99, bubbles: true }));
    expect(releaseDirection).not.toHaveBeenCalled();
  });

  it("pointercancel does not double release (cancel triggers exactly one release)", () => {
    const pressDirection = vi.fn();
    const releaseDirection = vi.fn();

    render(() => (
      <VirtualControls
        pressDirection={pressDirection}
        releaseDirection={releaseDirection}
        onAction={vi.fn()}
      />
    ));

    const upBtn = screen.getByText("▲");
    const pointerId = 55;

    upBtn.dispatchEvent(new PointerEvent("pointerdown", { pointerId, bubbles: true, cancelable: true }));
    expect(pressDirection).toHaveBeenCalledTimes(1);

    // Cancel instead of pointerup — still one release
    upBtn.dispatchEvent(new PointerEvent("pointercancel", { pointerId, bubbles: true }));
    expect(releaseDirection).toHaveBeenCalledTimes(1);
    expect(releaseDirection).toHaveBeenCalledWith(`pointer:${pointerId}`);

    // Subsequent lostpointercapture must not duplicate
    upBtn.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId, bubbles: true }));
    expect(releaseDirection).toHaveBeenCalledTimes(1);
  });

  it("lostpointercapture does not double release (capture loss triggers exactly one release)", () => {
    const pressDirection = vi.fn();
    const releaseDirection = vi.fn();

    render(() => (
      <VirtualControls
        pressDirection={pressDirection}
        releaseDirection={releaseDirection}
        onAction={vi.fn()}
      />
    ));

    const upBtn = screen.getByText("▲");
    const pointerId = 66;

    upBtn.dispatchEvent(new PointerEvent("pointerdown", { pointerId, bubbles: true, cancelable: true }));
    expect(pressDirection).toHaveBeenCalledTimes(1);

    upBtn.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId, bubbles: true }));
    expect(releaseDirection).toHaveBeenCalledTimes(1);
    expect(releaseDirection).toHaveBeenCalledWith(`pointer:${pointerId}`);

    // Subsequent pointerup must not duplicate
    upBtn.dispatchEvent(new PointerEvent("pointerup", { pointerId, bubbles: true }));
    expect(releaseDirection).toHaveBeenCalledTimes(1);
  });

  it("fake timer advance produces no interval MOVE/direction/action operations", () => {
    vi.useFakeTimers();
    const pressDirection = vi.fn();
    const releaseDirection = vi.fn();
    const onAction = vi.fn();

    render(() => (
      <VirtualControls
        pressDirection={pressDirection}
        releaseDirection={releaseDirection}
        onAction={onAction}
      />
    ));

    // Simulate a full pointer down → up lifecycle first
    const upBtn = screen.getByText("▲");
    upBtn.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 7, bubbles: true, cancelable: true }));
    upBtn.dispatchEvent(new PointerEvent("pointerup", { pointerId: 7, bubbles: true }));

    // Clear the expected calls from the interaction above
    pressDirection.mockClear();
    releaseDirection.mockClear();
    onAction.mockClear();
    // VirtualControls owns no timers; flush any pending work to prove that remains true.
    vi.runOnlyPendingTimers();

    expect(pressDirection).not.toHaveBeenCalled();
    expect(releaseDirection).not.toHaveBeenCalled();
    expect(onAction).not.toHaveBeenCalled();

    // The shared afterEach restores real timers even if assertions fail.
  });

  it("second simultaneous touch on same button does not leak source (regression)", () => {
    const pressDirection = vi.fn();
    const releaseDirection = vi.fn();

    render(() => (
      <VirtualControls
        pressDirection={pressDirection}
        releaseDirection={releaseDirection}
        onAction={vi.fn()}
      />
    ));

    const upBtn = screen.getByText("▲");
    const pointerA = 10;
    const pointerB = 20;

    // First touch down
    upBtn.dispatchEvent(new PointerEvent("pointerdown", { pointerId: pointerA, bubbles: true, cancelable: true }));
    expect(pressDirection).toHaveBeenCalledWith(`pointer:${pointerA}`, "up");
    expect(pressDirection).toHaveBeenCalledTimes(1);

    // Second simultaneous touch down (different pointerId, same button)
    upBtn.dispatchEvent(new PointerEvent("pointerdown", { pointerId: pointerB, bubbles: true, cancelable: true }));
    expect(pressDirection).toHaveBeenCalledWith(`pointer:${pointerB}`, "up");
    expect(pressDirection).toHaveBeenCalledTimes(2);

    // Release first touch — must not be swallowed by id mismatch
    upBtn.dispatchEvent(new PointerEvent("pointerup", { pointerId: pointerA, bubbles: true }));
    expect(releaseDirection).toHaveBeenCalledTimes(1);
    expect(releaseDirection).toHaveBeenCalledWith(`pointer:${pointerA}`);

    // First touch's lostpointercapture must not double-release
    upBtn.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId: pointerA, bubbles: true }));
    expect(releaseDirection).toHaveBeenCalledTimes(1);

    // Release second touch
    upBtn.dispatchEvent(new PointerEvent("pointerup", { pointerId: pointerB, bubbles: true }));
    expect(releaseDirection).toHaveBeenCalledTimes(2);
    expect(releaseDirection).toHaveBeenCalledWith(`pointer:${pointerB}`);

    // Second touch's lostpointercapture must not double-release
    upBtn.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId: pointerB, bubbles: true }));
    expect(releaseDirection).toHaveBeenCalledTimes(2);
  });
});
