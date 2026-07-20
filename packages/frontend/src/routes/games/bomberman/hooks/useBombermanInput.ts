import { createSignal, onCleanup } from "solid-js";
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

export function useBombermanInput(onAction: (op: BombermanOperation) => void) {
  const { settings } = useGameSettings(bombermanSettingsSchema);
  const [showVirtualControls, setShowVirtualControls] = createSignal(false);
  setShowVirtualControls(window.matchMedia("(pointer: coarse)").matches);

  // Track held direction sources with press order
  const sources = new Map<string, { direction: BombermanDirection; order: number }>();
  let nextOrder = 0;
  let currentDirection: BombermanDirection | null = null;

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

  function onKeyDown(e: KeyboardEvent) {
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
    if (key === kb.surrender || e.code === kb.surrender) {
      e.preventDefault();
      onAction({ type: "SURRENDER" });
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

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  window.addEventListener("visibilitychange", onVisibilityChange);

  onCleanup(() => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("visibilitychange", onVisibilityChange);
    releaseAllDirections();
  });

  return { showVirtualControls, pressDirection, releaseDirection, releaseAllDirections };
}
