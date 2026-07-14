import { createSignal, onCleanup } from "solid-js";
import type { BombermanOperation } from "@generale/types";
import { bombermanSettingsSchema } from "@generale/types";
import { useGameSettings } from "~/hooks/useGameSettings";

export function useBombermanInput(onAction: (op: BombermanOperation) => void) {
  const { settings } = useGameSettings(bombermanSettingsSchema);
  const [showVirtualControls, setShowVirtualControls] = createSignal(false);
  setShowVirtualControls(window.matchMedia("(pointer: coarse)").matches);

  const held = new Set<string>();
  let interval: ReturnType<typeof setInterval> | null = null;

  function sendCurrentDirection() {
    const kb = settings().keybindings;
    let dir: "up" | "down" | "left" | "right" | null = null;
    if (held.has(kb.up)) dir = "up";
    else if (held.has(kb.down)) dir = "down";
    else if (held.has(kb.left)) dir = "left";
    else if (held.has(kb.right)) dir = "right";
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
    sendCurrentDirection();
  }

  function onKeyUp(e: KeyboardEvent) {
    const key = e.key === "Spacebar" ? " " : e.key;
    held.delete(key);
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
