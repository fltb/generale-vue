import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "solid-js";
import { useBombermanInput } from "../useBombermanInput";

// ─── Mocks ───

const { mockSettings } = vi.hoisted(() => ({
  mockSettings: {
    keybindings: {
      up: "ArrowUp",
      down: "ArrowDown",
      left: "ArrowLeft",
      right: "ArrowRight",
      placeBomb: " ",
      action: "q",
      detonate: "e",
      surrender: "Escape",
    },
  },
}));

vi.mock("~/hooks/useGameSettings", () => ({
  useGameSettings: () => ({
    settings: () => mockSettings,
  }),
}));

// ─── Helpers ───

function createHook() {
  const onAction = vi.fn();
  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    useBombermanInput(onAction);
  });
  return { onAction, dispose };
}

function pressKey(key: string, code: string, repeat = false) {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key, code, repeat, bubbles: true, cancelable: true }),
  );
}

function releaseKey(code: string, key = "") {
  window.dispatchEvent(
    new KeyboardEvent("keyup", { key, code, bubbles: true, cancelable: true }),
  );
}

// ─── Tests ───

describe("useBombermanInput", () => {
  beforeEach(() => {
    mockSettings.keybindings = {
      up: "ArrowUp",
      down: "ArrowDown",
      left: "ArrowLeft",
      right: "ArrowRight",
      placeBomb: " ",
      action: "q",
      detonate: "e",
      surrender: "Escape",
    };
    vi.useFakeTimers();
    // happy-dom lacks matchMedia by default
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("quick D tap emits SET_DIRECTION(right) then null, no repeat after 300ms", () => {
    const { onAction } = createHook();

    pressKey("d", "KeyD");
    expect(onAction).toHaveBeenCalledWith({ type: "SET_DIRECTION", direction: "right" });

    releaseKey("KeyD");
    expect(onAction).toHaveBeenCalledWith({ type: "SET_DIRECTION", direction: null });
    expect(onAction).toHaveBeenCalledTimes(2);

    // No spurious calls after advance
    vi.advanceTimersByTime(300);
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it("repeated taps both register", () => {
    const { onAction } = createHook();

    pressKey("d", "KeyD");
    expect(onAction).toHaveBeenLastCalledWith({ type: "SET_DIRECTION", direction: "right" });

    releaseKey("KeyD");
    expect(onAction).toHaveBeenLastCalledWith({ type: "SET_DIRECTION", direction: null });

    // Second press should work (source was released)
    pressKey("d", "KeyD");
    expect(onAction).toHaveBeenLastCalledWith({ type: "SET_DIRECTION", direction: "right" });

    releaseKey("KeyD");
    expect(onAction).toHaveBeenLastCalledWith({ type: "SET_DIRECTION", direction: null });
  });

  it("D/W chord falls back to D after W release", () => {
    const { onAction } = createHook();

    pressKey("d", "KeyD");
    expect(onAction).toHaveBeenLastCalledWith({ type: "SET_DIRECTION", direction: "right" });

    // Press W while D is held — direction switches to up (most recent)
    pressKey("w", "KeyW");
    expect(onAction).toHaveBeenLastCalledWith({ type: "SET_DIRECTION", direction: "up" });

    // Release W — falls back to D (next most recent)
    releaseKey("KeyW");
    expect(onAction).toHaveBeenLastCalledWith({ type: "SET_DIRECTION", direction: "right" });

    // Release D — nothing held
    releaseKey("KeyD");
    expect(onAction).toHaveBeenLastCalledWith({ type: "SET_DIRECTION", direction: null });
  });

  it("Shift+W with Shift released before W leaves direction unchanged until W release", () => {
    const { onAction } = createHook();

    // Press Shift (not a direction key) — no effect
    pressKey("Shift", "ShiftLeft");
    expect(onAction).not.toHaveBeenCalled();

    // Press W while Shift still down
    pressKey("w", "KeyW");
    expect(onAction).toHaveBeenCalledWith({ type: "SET_DIRECTION", direction: "up" });

    // Release Shift first — direction should stay up (W still pressed); Shift was never a source
    releaseKey("ShiftLeft");
    expect(onAction).toHaveBeenCalledTimes(1); // Shift release emits nothing, was never registered

    // Release W — direction goes null
    releaseKey("KeyW");
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onAction).toHaveBeenCalledWith({ type: "SET_DIRECTION", direction: null });
  });

  it("repeat keydown does not trigger additional SET_DIRECTION", () => {
    const { onAction } = createHook();

    pressKey("w", "KeyW");
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({ type: "SET_DIRECTION", direction: "up" });

    // Repeat event from holding W
    pressKey("w", "KeyW", true);
    expect(onAction).toHaveBeenCalledTimes(1); // no extra call
  });

  it("blur stops active input without duplicate null", () => {
    const { onAction } = createHook();

    pressKey("s", "KeyS");
    expect(onAction).toHaveBeenCalledWith({ type: "SET_DIRECTION", direction: "down" });

    window.dispatchEvent(new FocusEvent("blur"));
    expect(onAction).toHaveBeenCalledWith({ type: "SET_DIRECTION", direction: null });
    expect(onAction).toHaveBeenCalledTimes(2);

    // Second blur should not emit duplicate null
    window.dispatchEvent(new FocusEvent("blur"));
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it("visibility hidden stops active input without duplicate null", () => {
    const restoreHidden = () => {
      Object.defineProperty(document, "hidden", { value: false, configurable: true, writable: true });
    };
    Object.defineProperty(document, "hidden", { value: false, configurable: true, writable: true });

    const { onAction } = createHook();

    pressKey("a", "KeyA");
    expect(onAction).toHaveBeenCalledWith({ type: "SET_DIRECTION", direction: "left" });

    // Hide document
    Object.defineProperty(document, "hidden", { value: true, configurable: true, writable: true });
    window.dispatchEvent(new Event("visibilitychange"));
    expect(onAction).toHaveBeenCalledWith({ type: "SET_DIRECTION", direction: null });
    expect(onAction).toHaveBeenCalledTimes(2);

    // Second visibilitychange should not emit duplicate null
    window.dispatchEvent(new Event("visibilitychange"));
    expect(onAction).toHaveBeenCalledTimes(2);

    restoreHidden();
  });

  it("cleanup stops active input without duplicate null", () => {
    const { onAction, dispose } = createHook();

    pressKey("d", "KeyD");
    expect(onAction).toHaveBeenCalledWith({ type: "SET_DIRECTION", direction: "right" });
    expect(onAction).toHaveBeenCalledTimes(1);

    // Cleanup — onCleanup removes listeners and releases direction
    dispose();
    expect(onAction).toHaveBeenCalledWith({ type: "SET_DIRECTION", direction: null });
    expect(onAction).toHaveBeenCalledTimes(2);

    // Second dispose should be a no-op
    dispose();
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it("no spurious null when blur fires with no active direction", () => {
    const { onAction } = createHook();

    expect(onAction).not.toHaveBeenCalled();
    window.dispatchEvent(new FocusEvent("blur"));
    expect(onAction).not.toHaveBeenCalled();
  });

  it("no spurious null when visibility hidden fires with no active direction", () => {
    const restoreHidden = () => {
      Object.defineProperty(document, "hidden", { value: false, configurable: true, writable: true });
    };
    Object.defineProperty(document, "hidden", { value: false, configurable: true, writable: true });

    const { onAction } = createHook();

    Object.defineProperty(document, "hidden", { value: true, configurable: true, writable: true });
    window.dispatchEvent(new Event("visibilitychange"));
    expect(onAction).not.toHaveBeenCalled();

    restoreHidden();
  });

  it("uppercase WASD keys also work", () => {
    const { onAction } = createHook();

    pressKey("D", "KeyD");
    expect(onAction).toHaveBeenCalledWith({ type: "SET_DIRECTION", direction: "right" });

    releaseKey("KeyD");
    expect(onAction).toHaveBeenCalledWith({ type: "SET_DIRECTION", direction: null });

    pressKey("W", "KeyW");
    expect(onAction).toHaveBeenCalledWith({ type: "SET_DIRECTION", direction: "up" });
  });

  it("arrow keys from configured keybindings work", () => {
    const { onAction } = createHook();

    pressKey("ArrowLeft", "ArrowLeft");
    expect(onAction).toHaveBeenCalledWith({ type: "SET_DIRECTION", direction: "left" });

    releaseKey("ArrowLeft");
    expect(onAction).toHaveBeenLastCalledWith({ type: "SET_DIRECTION", direction: null });
  });

  it("action keys (Space/q/e/Escape) trigger one-shot operations", () => {
    const { onAction } = createHook();

    pressKey(" ", "Space");
    expect(onAction).toHaveBeenCalledWith({ type: "PLACE_BOMB" });

    pressKey("q", "KeyQ");
    expect(onAction).toHaveBeenCalledWith({ type: "ACTION" });

    pressKey("e", "KeyE");
    expect(onAction).toHaveBeenCalledWith({ type: "DETONATE" });

    pressKey("Escape", "Escape");
    expect(onAction).toHaveBeenCalledWith({ type: "SURRENDER" });
  });

  it("Spacebar normalization works", () => {
    const { onAction } = createHook();

    // "Spacebar" is legacy IE value — hook normalises it to " "
    pressKey("Spacebar", "Space");
    expect(onAction).toHaveBeenCalledWith({ type: "PLACE_BOMB" });
  });

  it("repeat keydown does not re-dispatch action events", () => {
    const { onAction } = createHook();

    // Initial press
    pressKey("q", "KeyQ");
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({ type: "ACTION" });

    // Auto-repeat events from holding the key — must be ignored
    pressKey("q", "KeyQ", true);
    pressKey("q", "KeyQ", true);
    expect(onAction).toHaveBeenCalledTimes(1);

    // Same for detonate
    pressKey("e", "KeyE");
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onAction).toHaveBeenCalledWith({ type: "DETONATE" });

    pressKey("e", "KeyE", true);
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it("code-based binding value matches via event.code", () => {
    mockSettings.keybindings = {
      ...mockSettings.keybindings,
      action: "KeyQ",
      detonate: "KeyE",
    };

    const { onAction } = createHook();

    // Physical Q press — "KeyQ" is the code, "q" is the key — should match code binding
    pressKey("q", "KeyQ");
    expect(onAction).toHaveBeenCalledWith({ type: "ACTION" });

    pressKey("e", "KeyE");
    expect(onAction).toHaveBeenCalledWith({ type: "DETONATE" });

    // Non-matching key should not fire
    pressKey("x", "KeyX");
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it("non-direction, non-action keys are ignored", () => {
    const { onAction } = createHook();

    pressKey("Enter", "Enter");
    expect(onAction).not.toHaveBeenCalled();
  });
});
