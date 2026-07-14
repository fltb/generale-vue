import { createSignal, onCleanup } from "solid-js";
import type { BombermanOperation, BombermanKeybindings } from "@generale/types";
import { bombermanSettingsSchema } from "@generale/types";
import { useGameSettings } from "~/hooks/useGameSettings";

type Direction = "up" | "down" | "left" | "right";

function isDirectionKey(key: string, configured: string, wasd: string): boolean {
  return key === configured || key === wasd || key === wasd.toUpperCase();
}

function keyToDirection(key: string, kb: BombermanKeybindings): Direction | null {
  if (isDirectionKey(key, kb.up, "w")) return "up";
  if (isDirectionKey(key, kb.down, "s")) return "down";
  if (isDirectionKey(key, kb.left, "a")) return "left";
  if (isDirectionKey(key, kb.right, "d")) return "right";
  return null;
}

export function useBombermanInput(onAction: (op: BombermanOperation) => void) {
  const { settings } = useGameSettings(bombermanSettingsSchema);
  const [showVirtualControls, setShowVirtualControls] = createSignal(false);
  setShowVirtualControls(window.matchMedia("(pointer: coarse)").matches);

  const held = new Set<string>();
  // Track press order: last element is most-recently-pressed direction key
  const pressOrder: string[] = [];
  let interval: ReturnType<typeof setInterval> | null = null;

  function getLastPressedDirection(): Direction | null {
    const kb = settings().keybindings;
    // Walk pressOrder from back to front — first still-held direction key wins
    for (let i = pressOrder.length - 1; i >= 0; i--) {
      const key = pressOrder[i]!;
      if (held.has(key)) {
        const dir = keyToDirection(key, kb);
        if (dir) return dir;
      }
    }
    return null;
  }

  function sendCurrentDirection() {
    const dir = getLastPressedDirection();
    if (dir) onAction({ type: "MOVE", direction: dir });
  }

  function onKeyDown(e: KeyboardEvent) {
    const key = e.key === "Spacebar" ? " " : e.key;
    const kb = settings().keybindings;

    if (key === kb.placeBomb) {
      e.preventDefault();
      onAction({ type: "PLACE_BOMB" });
      return;
    }
    if (key === kb.action) {
      e.preventDefault();
      onAction({ type: "ACTION" });
      return;
    }
    if (key === kb.detonate) {
      e.preventDefault();
      onAction({ type: "DETONATE" });
      return;
    }
    if (key === kb.surrender) {
      e.preventDefault();
      onAction({ type: "SURRENDER" });
      return;
    }

    held.add(key);
    // Track press order for direction keys
    if (keyToDirection(key, kb)) {
      pressOrder.push(key);
    }
    sendCurrentDirection();
  }

  function onKeyUp(e: KeyboardEvent) {
    const key = e.key === "Spacebar" ? " " : e.key;
    held.delete(key);
    // If we're releasing a direction key, immediately switch to the next held direction
    if (keyToDirection(key, settings().keybindings)) {
      sendCurrentDirection();
    }
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // Poll direction at tick rate to ensure moves aren't missed
  interval = setInterval(sendCurrentDirection, 50);

  onCleanup(() => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    if (interval) clearInterval(interval);
  });

  return { showVirtualControls };
}
