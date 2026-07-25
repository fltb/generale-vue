import { createSignal, createEffect, onCleanup, type Accessor } from "solid-js";
import type { BombermanOperation, BombermanKeybindings, BombermanDirection } from "@generale/types";
import { bombermanSettingsSchema } from "@generale/types";
import { useGameSettings } from "~/hooks/useGameSettings";

function isDirectionKey(key: string, configured: string, wasd: string): boolean {
  return key === configured || key === wasd || key === wasd.toUpperCase();
}

function keyToDirection(key: string, kb: BombermanKeybindings): BombermanDirection | null {
  if (isDirectionKey(key, kb.up, "w")) return "up";
  if (isDirectionKey(key, kb.down, "s")) return "down";
  if (isDirectionKey(key, kb.left, "a")) return "left";
  if (isDirectionKey(key, kb.right, "d")) return "right";
  return null;
}

/** Map a Gamepad axis pair to a direction, respecting deadzone. */
function axisToDirection(x: number, y: number, deadzone: number): BombermanDirection | null {
  const absX = Math.abs(x);
  const absY = Math.abs(y);
  if (absX < deadzone && absY < deadzone) return null;
  if (absX > absY) {
    return x < 0 ? "left" : "right";
  }
  return y < 0 ? "up" : "down";
}

/**
 * Roadmap phase 9 input hook:
 * - `onAction` — dispatches BombermanOperation values (direction changes + one-shots)
 * - `enabled` — optional accessor; when false, blocks all input and releases held directions
 * - `onMenu` — optional callback invoked when surrender/menu key is pressed; the hook
 *   **does not** send SURRENDER; instead it calls onMenu and releases all directions.
 *
 * Gamepad input is polled via requestAnimationFrame. Disabled, blur, hidden, and
 * onMenu-release are all handled.
 */
export function useBombermanInput(options: {
  onAction: (op: BombermanOperation) => void;
  enabled?: Accessor<boolean>;
  onMenu?: () => void;
}) {
  const { onAction, onMenu } = options;
  const enabled = options.enabled;
  const isEnabled = () => enabled?.() ?? true;
  const { settings } = useGameSettings(bombermanSettingsSchema);
  const [showVirtualControls, setShowVirtualControls] = createSignal(false);
  setShowVirtualControls(window.matchMedia("(pointer: coarse)").matches);

  // Track held direction sources with press order
  const sources = new Map<string, { direction: BombermanDirection; order: number }>();
  let nextOrder = 0;
  let currentDirection: BombermanDirection | null = null;
  let gamepadRafId: number | null = null;
  let menuCallbackPending = false;

  function getMostRecentDirection(): BombermanDirection | null {
    let best: { direction: BombermanDirection; order: number } | null = null;
    for (const entry of sources.values()) {
      if (!best || entry.order > best.order) {
        best = entry;
      }
    }
    return best?.direction ?? null;
  }

  function emitDirection(dir: BombermanDirection | null) {
    if (dir !== currentDirection) {
      currentDirection = dir;
      onAction({ type: "SET_DIRECTION", direction: dir });
    }
  }

  function pressDirection(sourceId: string, direction: BombermanDirection) {
    if (!isEnabled()) return;
    sources.set(sourceId, { direction, order: nextOrder++ });
    emitDirection(getMostRecentDirection());
  }

  function releaseDirection(sourceId: string) {
    if (sources.delete(sourceId)) {
      emitDirection(getMostRecentDirection());
    }
  }

  function releaseAllDirections() {
    if (sources.size > 0) {
      sources.clear();
      emitDirection(null);
    }
  }

  // Release any held direction when controls become disabled
  createEffect(() => {
    if (!isEnabled()) {
      releaseAllDirections();
    }
  });

  // ── Keyboard handlers ──
  function onKeyDown(e: KeyboardEvent) {
    if (!isEnabled()) return;

    const key = e.key === "Spacebar" ? " " : e.key;
    const kb = settings().keybindings;

    // Ignore auto-repeat for all keys — exactly one dispatch per physical press
    if (e.repeat) return;

    // One-shot actions (match against both e.key and e.code for rebind robustness)
    if (key === kb.placeBomb || e.code === kb.placeBomb) {
      e.preventDefault();
      onAction({ type: "PLACE_BOMB" });
      return;
    }
    if (key === kb.action || e.code === kb.action) {
      e.preventDefault();
      onAction({ type: "ACTION" });
      return;
    }
    if (key === kb.detonate || e.code === kb.detonate) {
      e.preventDefault();
      onAction({ type: "DETONATE" });
      return;
    }
    // Surrender key triggers onMenu (local overlay), not SURRENDER
    if (key === kb.surrender || e.code === kb.surrender) {
      e.preventDefault();
      if (onMenu) {
        releaseAllDirections();
        onMenu();
      }
      return;
    }

    // Direction key — ignore duplicate sources
    const sourceId = `keyboard:${e.code}`;
    if (sources.has(sourceId)) return;
    const dir = keyToDirection(key, kb);
    if (dir) {
      pressDirection(sourceId, dir);
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    const sourceId = `keyboard:${e.code}`;
    releaseDirection(sourceId);
  }

  function onBlur() {
    releaseAllDirections();
  }

  function onVisibilityChange() {
    if (document.hidden) {
      releaseAllDirections();
    }
  }

  // ── Gamepad input ──
  function pollGamepad() {
    if (!isEnabled()) {
      gamepadRafId = null;
      return;
    }

    const s = settings();
    const gp = s.gamepad;

    if (gp.enabled) {
      const gamepads = navigator.getGamepads?.() ?? [];
      const pad = gamepads[gp.index];
      if (pad) {
        const axes = pad.axes;
        const buttons = pad.buttons;

        // D-pad from axes (typically axes[0], axes[1])
        const dirX = axes[0] ?? 0;
        const dirY = axes[1] ?? 0;
        const dir = axisToDirection(dirX, dirY, gp.deadzone);

        // D-pad buttons (typically buttons 12-15 on a standard mapping)
        const dpadUp = buttons[12]?.pressed ?? false;
        const dpadDown = buttons[13]?.pressed ?? false;
        const dpadLeft = buttons[14]?.pressed ?? false;
        const dpadRight = buttons[15]?.pressed ?? false;

        let effectiveDir: BombermanDirection | null = dir;
        if (dpadUp) effectiveDir = "up";
        else if (dpadDown) effectiveDir = "down";
        else if (dpadLeft) effectiveDir = "left";
        else if (dpadRight) effectiveDir = "right";

        const sourceId = `gamepad:${gp.index}`;
        if (effectiveDir) {
          // Only press if direction changed (avoids spamming on held)
          const existing = sources.get(sourceId);
          if (!existing || existing.direction !== effectiveDir) {
            sources.set(sourceId, { direction: effectiveDir, order: nextOrder++ });
            emitDirection(getMostRecentDirection());
          }
        } else if (sources.has(sourceId)) {
          // No direction — release gamepad source
          sources.delete(sourceId);
          emitDirection(getMostRecentDirection());
        }

        // Action buttons — use bindings
        const bindings = gp.bindings;
        if (buttons[bindings.placeBomb]?.pressed) {
          onAction({ type: "PLACE_BOMB" });
        }
        if (buttons[bindings.action]?.pressed) {
          onAction({ type: "ACTION" });
        }
        if (buttons[bindings.detonate]?.pressed) {
          onAction({ type: "DETONATE" });
        }
        if (buttons[bindings.menu]?.pressed && !menuCallbackPending) {
          menuCallbackPending = true;
          if (onMenu) {
            releaseAllDirections();
            onMenu();
          }
        } else if (!buttons[bindings.menu]?.pressed) {
          menuCallbackPending = false;
        }
      }
    }

    gamepadRafId = requestAnimationFrame(pollGamepad);
  }

  // Start gamepad polling when enabled and enabled changes
  createEffect(() => {
    if (isEnabled()) {
      if (gamepadRafId === null) {
        gamepadRafId = requestAnimationFrame(pollGamepad);
      }
    } else if (gamepadRafId !== null) {
      cancelAnimationFrame(gamepadRafId);
      gamepadRafId = null;
    }
  });

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  window.addEventListener("visibilitychange", onVisibilityChange);

  onCleanup(() => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("visibilitychange", onVisibilityChange);
    if (gamepadRafId !== null) {
      cancelAnimationFrame(gamepadRafId);
      gamepadRafId = null;
    }
    releaseAllDirections();
  });

  return { showVirtualControls, pressDirection, releaseDirection, releaseAllDirections };
}
