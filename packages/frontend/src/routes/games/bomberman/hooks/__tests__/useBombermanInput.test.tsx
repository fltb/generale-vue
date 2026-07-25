import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, createSignal } from "solid-js";
import { useBombermanInput } from "../useBombermanInput";
import type { BombermanDirection } from "@generale/types";

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
    gamepad: {
      enabled: true,
      index: 0,
      deadzone: 0.55,
      bindings: { placeBomb: 0, action: 2, detonate: 1, menu: 9 },
    },
    highContrast: false,
    colorVision: "default",
    touchLayout: "compact",
    haptics: false,
    showInputOverlay: false,
    selectedSkinId: "classic-blue",
  },
}));

vi.mock("~/hooks/useGameSettings", () => ({
  useGameSettings: () => ({
    settings: () => mockSettings,
  }),
}));

// ─── Helpers ───

function createHook(enabled?: () => boolean) {
  const onAction = vi.fn();
  const onMenu = vi.fn();
  let dispose!: () => void;
  let hook: ReturnType<typeof useBombermanInput>;
  createRoot((d) => {
    dispose = d;
    hook = useBombermanInput({ onAction, enabled, onMenu });
  });
  return { onAction, onMenu, dispose, ...hook! };
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
    mockSettings.gamepad = {
      enabled: true,
      index: 0,
      deadzone: 0.55,
      bindings: { placeBomb: 0, action: 2, detonate: 1, menu: 9 },
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
    // Mock getGamepads for gamepad tests
    (navigator as any).getGamepads = () => [];
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
  });

  it("Escape surrender key triggers onMenu not SURRENDER", () => {
    const { onAction, onMenu } = createHook();

    pressKey("Escape", "Escape");
    // No SURRENDER dispatched
    expect(onAction).not.toHaveBeenCalled();
    // onMenu called instead
    expect(onMenu).toHaveBeenCalledTimes(1);
  });

  it("surrender key releases directions when onMenu is present", () => {
    const { onAction, onMenu, pressDirection } = createHook();

    // Press a direction
    pressDirection("touch:0", "up");
    expect(onAction).toHaveBeenCalledWith({ type: "SET_DIRECTION", direction: "up" });

    onAction.mockClear();

    // Press Escape — triggers onMenu and releases direction
    pressKey("Escape", "Escape");
    expect(onMenu).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({ type: "SET_DIRECTION", direction: null });
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

  describe("enabled gate", () => {
    it("blocks keyboard directions when disabled", () => {
      const { onAction } = createHook(() => false);

      pressKey("ArrowUp", "ArrowUp");
      expect(onAction).not.toHaveBeenCalled();

      pressKey("ArrowDown", "ArrowDown");
      expect(onAction).not.toHaveBeenCalled();

      pressKey("ArrowLeft", "ArrowLeft");
      expect(onAction).not.toHaveBeenCalled();

      pressKey("ArrowRight", "ArrowRight");
      expect(onAction).not.toHaveBeenCalled();
    });

    it("blocks keyboard action keys when disabled", () => {
      const { onAction } = createHook(() => false);

      pressKey(" ", "Space");
      expect(onAction).not.toHaveBeenCalled();

      pressKey("q", "KeyQ");
      expect(onAction).not.toHaveBeenCalled();

      pressKey("e", "KeyE");
      expect(onAction).not.toHaveBeenCalled();

      pressKey("Escape", "Escape");
      expect(onAction).not.toHaveBeenCalled();
    });

    it("blocks virtual direction presses when disabled", () => {
      const { onAction, pressDirection } = createHook(() => false);

      pressDirection("touch:0", "up");
      expect(onAction).not.toHaveBeenCalled();

      pressDirection("touch:1", "down");
      expect(onAction).not.toHaveBeenCalled();
    });

    it("transitions from disabled to enabled", () => {
      let enabled = false;
      const { onAction } = createHook(() => enabled);

      // Disabled — nothing gets through
      pressKey("ArrowUp", "ArrowUp");
      expect(onAction).not.toHaveBeenCalled();

      // Enable
      enabled = true;

      // Now direction press works
      pressKey("ArrowDown", "ArrowDown");
      expect(onAction).toHaveBeenCalledWith({ type: "SET_DIRECTION", direction: "down" });

      // Action keys also work
      pressKey(" ", "Space");
      expect(onAction).toHaveBeenCalledWith({ type: "PLACE_BOMB" });
    });

    it("releases held direction on disable transition", () => {
      const onAction = vi.fn();
      let dispose!: () => void;
      let pressDir!: (sourceId: string, direction: BombermanDirection) => void;
      let setEnabled!: (v: boolean) => void;

      createRoot((d) => {
        dispose = d;
        const [enabled, set] = createSignal(true);
        setEnabled = set;
        const result = useBombermanInput({ onAction, enabled });
        pressDir = result.pressDirection;
      });

      // Press and hold up
      pressDir("touch:0", "up");
      expect(onAction).toHaveBeenCalledWith({ type: "SET_DIRECTION", direction: "up" });
      onAction.mockClear();

      // Disable — createEffect should release held direction
      setEnabled(false);

      expect(onAction).toHaveBeenCalledWith({ type: "SET_DIRECTION", direction: null });

      dispose();
    });
  });

  describe("gamepad input", () => {
    it("does not crash when getGamepads is undefined", () => {
      // Simulate no Gamepad API
      (navigator as any).getGamepads = undefined;

      const { onAction } = createHook();
      // Should not throw when mounted
      expect(onAction).not.toHaveBeenCalled();
    });

    it("disconnected/null gamepads produce no operation", () => {
      (navigator as any).getGamepads = () => [null, null];
      const { onAction } = createHook();

      // Advance timers enough for gamepad polling to run
      vi.advanceTimersByTime(100);
      expect(onAction).not.toHaveBeenCalled();
    });

    it("does not fire actions when gamepad is disabled in settings", () => {
      mockSettings.gamepad = { ...mockSettings.gamepad, enabled: false };

      (navigator as any).getGamepads = () => [
        {
          axes: [0, 0],
          buttons: Array.from({ length: 18 }, () => ({ pressed: false })),
        },
      ];

      const { onAction } = createHook();
      vi.advanceTimersByTime(100);
      expect(onAction).not.toHaveBeenCalled();
    });

    it("disabled gate cancels gamepad polling", () => {
      const { onAction } = createHook(() => false);

      (navigator as any).getGamepads = () => [
        {
          axes: [-1, 0], // Left
          buttons: Array.from({ length: 18 }, () => ({ pressed: false })),
        },
      ];

      vi.advanceTimersByTime(100);
      expect(onAction).not.toHaveBeenCalled();
    });
  });
});
