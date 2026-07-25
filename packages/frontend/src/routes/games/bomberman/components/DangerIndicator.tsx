import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { useT } from "~/i18n/useT";
import type { Bomb, BombermanPlayer } from "@generale/types";

interface DangerIndicatorProps {
  bombs: Bomb[];
  localPlayer: BombermanPlayer | null | undefined;
  tickRate: number;
  reducedMotion?: boolean;
}

/**
 * Shows a danger warning when a nearby bomb is close to detonating (fuse ≤ 3 ticks).
 * Flashes at 2Hz when fuse ≤ 3 tickRate, 4Hz when fuse ≤ 1 tickRate.
 */
export function DangerIndicator(props: DangerIndicatorProps) {
  const { t } = useT();
  const [visible, setVisible] = createSignal(false);

  // Find the nearest dangerous bomb (at most 2 tiles away, fuse ratio ≤ 3/tickRate)
  const dangerBomb = createMemo(() => {
    const p = props.localPlayer;
    if (!p?.alive) return null;
    const playerX = p.x;
    const playerY = p.y;

    for (const bomb of props.bombs) {
      const dist = Math.abs(bomb.x - playerX) + Math.abs(bomb.y - playerY);
      if (dist <= 2 && bomb.fuse <= Math.min(3, Math.ceil(props.tickRate * 0.6))) {
        return bomb;
      }
    }
    return null;
  });

  // Flash state for visual pulsing
  const [flash, setFlash] = createSignal(false);
  let flashTimer: ReturnType<typeof setInterval> | undefined;

  createEffect(() => {
    const b = dangerBomb();
    if (b) {
      setVisible(true);
      // Flash frequency depends on remaining fuse
      const intervalMs = b.fuse <= 1 ? 125 : 250; // 4Hz or 2Hz
      clearInterval(flashTimer);
      flashTimer = setInterval(() => setFlash((f) => !f), intervalMs);
    } else {
      setVisible(false);
      clearInterval(flashTimer);
      flashTimer = undefined;
      setFlash(false);
    }
  });

  onCleanup(() => clearInterval(flashTimer));

  return (
    <div
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
      style={{ display: visible() ? "block" : "none" }}
    >
      <div
        class="text-2xl font-black text-red-500 select-none"
        style={props.reducedMotion ? { opacity: 0.6 } : { opacity: flash() ? 0.9 : 0.2, transition: "opacity 0.1s" }}
      >
        {t("bomberman.danger")}
      </div>
    </div>
  );
}
