import { createSignal, createEffect, onCleanup, type Accessor } from "solid-js";

interface InterpolationTarget {
  x: number;
  y: number;
  speed: number;
  tickRate: number;
  alive: boolean;
}

/**
 * Drives smooth pixel-position interpolation between authoritative tile-center
 * positions received from the game server. Uses requestAnimationFrame to decouple
 * rendering from the server tick cadence.
 *
 * - First state or respawn (alive transitions from false to true) → snap to center.
 * - Axial authoritative change within max(1, speed) → animate from current rendered
 *   position to the new center over `distance * (1000 / tickRate) / max(1, speed)` ms.
 * - Mid-animation arrival of a newer target → cancel prior RAF and continue from
 *   current rendered position using the new target's speed/tickRate.
 * - Speed/tick-rate change with unchanged coordinates → no animation.
 * - Diagonal jump, distance > expected, or alive: false → cancel frame and snap.
 * - onCleanup cancels any pending RAF.
 */
export function useInterpolatedBombermanPosition(target: Accessor<InterpolationTarget>): {
  x: Accessor<number>;
  y: Accessor<number>;
  moving: Accessor<boolean>;
} {
  const [x, setX] = createSignal(0);
  const [y, setY] = createSignal(0);
  const [moving, setMoving] = createSignal(false);

  let rafId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let lastAlive = false;
  let initialized = false;

  function cancelRAF() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  onCleanup(() => cancelRAF());

  createEffect(() => {
    const t = target();
    const { x: tx, y: ty, speed, tickRate, alive } = t;

    // ── First state or respawn: snap to tile center ──
    if (!initialized || (!lastAlive && alive)) {
      initialized = true;
      lastAlive = alive;
      lastX = tx;
      lastY = ty;
      cancelRAF();
      setX(tx);
      setY(ty);
      setMoving(false);
      return;
    }

    lastAlive = alive;

    // ── Not alive: snap to authoritative position ──
    if (!alive) {
      lastX = tx;
      lastY = ty;
      cancelRAF();
      setX(tx);
      setY(ty);
      setMoving(false);
      return;
    }

    // ── No coordinate change (e.g. speed/tickRate-only update) ──
    if (tx === lastX && ty === lastY) {
      return;
    }

    const dx = tx - lastX;
    const dy = ty - lastY;
    const distance = Math.abs(dx) + Math.abs(dy);
    const maxStep = Math.max(1, speed);

    // ── Non-axial change or distance > expected speed: snap ──
    if ((dx !== 0 && dy !== 0) || distance > maxStep) {
      lastX = tx;
      lastY = ty;
      cancelRAF();
      setX(tx);
      setY(ty);
      setMoving(false);
      return;
    }

    // ── Axial, within expected step: animate ──
    cancelRAF();

    const duration = (distance * (1000 / tickRate)) / maxStep;
    const startX = x();
    const startY = y();
    const dxAnim = tx - startX;
    const dyAnim = ty - startY;
    const startTime = performance.now();

    // Update authoritative anchor for next comparison
    lastX = tx;
    lastY = ty;

    setMoving(true);

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      setX(startX + dxAnim * progress);
      setY(startY + dyAnim * progress);

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        setMoving(false);
        rafId = null;
      }
    }

    rafId = requestAnimationFrame(animate);
  });

  return { x, y, moving };
}
