import { createSignal, onCleanup } from "solid-js";
import type { BombermanOperation } from "@generale/types";

export function useBombermanInput(onAction: (op: BombermanOperation) => void) {
  const [showVirtualControls, setShowVirtualControls] = createSignal(false);
  setShowVirtualControls(window.matchMedia("(pointer: coarse)").matches);

  const held = new Set<string>();
  let lastSent: string | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;

  function sendCurrentDirection() {
    let dir: "up" | "down" | "left" | "right" | null = null;
    if (held.has("ArrowUp") || held.has("w")) dir = "up";
    else if (held.has("ArrowDown") || held.has("s")) dir = "down";
    else if (held.has("ArrowLeft") || held.has("a")) dir = "left";
    else if (held.has("ArrowRight") || held.has("d")) dir = "right";

    const key = dir ?? "none";
    if (key !== lastSent) {
      lastSent = key;
      if (dir) onAction({ type: "MOVE", direction: dir });
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    const key = e.key === "Spacebar" ? " " : e.key;

    if (key === " " || key === "Spacebar") {
      e.preventDefault();
      onAction({ type: "PLACE_BOMB" });
      return;
    }
    if (key === "e" || key === "E") {
      e.preventDefault();
      onAction({ type: "DETONATE" });
      return;
    }
    if (key === "Escape") {
      e.preventDefault();
      onAction({ type: "SURRENDER" } as BombermanOperation);
      return;
    }

    held.add(key);
    sendCurrentDirection();
  }

  function onKeyUp(e: KeyboardEvent) {
    const key = e.key === "Spacebar" ? " " : e.key;
    held.delete(key);
    sendCurrentDirection();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // Poll direction at tick rate to ensure moves aren't missed
  interval = setInterval(sendCurrentDirection, 200);

  onCleanup(() => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    if (interval) clearInterval(interval);
  });

  return { showVirtualControls };
}
