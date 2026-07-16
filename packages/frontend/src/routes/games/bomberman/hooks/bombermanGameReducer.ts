import type { BombermanState, BombermanOperation } from "@generale/types";

/**
 * Tracks which optimistic event IDs have already placed a bomb.
 * Prevents duplicate bombs when useVersionedOptimisticState re-applies
 * pending optimistic events from a fresh structuredClone(base) on every
 * server reconciliation — if the player moved between ticks, hasBombHere
 * would check the NEW position, find no bomb, and create a duplicate.
 *
 * This Map is module-level because the optimistic queue is shared across
 * the component's lifetime (useVersionedOptimisticState's optimisticQueue signal).
 * Clearing it on unmount is unnecessary — IDs are monotonically increasing
 * and collisions across component remounts are harmless (worst case: a bomb
 * that should appear doesn't on the very first render of a new session).
 */
const placedBombs = new Map<number, boolean>();

/**
 * Local optimistic reducer for bomberman game state.
 * Pure function — no UI/connection dependencies.
 *
 * Handles:
 *  - SET_DIRECTION: move local player 1 tile (server corrects on collision)
 *  - PLACE_BOMB: decrement bombActive, add a visual bomb at player position
 *  - DETONATE: trigger oldest remote bomb to explode next tick (approximate)
 *  - ACTION: pick up adjacent bomb with GLOVE (server will correct if wrong)
 *  - SURRENDER: mark local player as dead immediately
 */
export function applyBombermanEventLocal(
  state: BombermanState,
  op: BombermanOperation,
  localPlayerId: string,
): BombermanState {
  const next = JSON.parse(JSON.stringify(state)) as BombermanState;

  if (op.type === "SET_DIRECTION") {
    const player = next.players?.[localPlayerId];
    if (player?.alive) {
      player.facing = op.direction ?? player.facing;
      // Optimistic: move 1 tile in direction (server corrects on collision)
      if (op.direction) {
        if (op.direction === "up") player.y = Math.max(0, player.y - 1);
        else if (op.direction === "down") player.y = Math.min(state.config.mapHeight - 1, player.y + 1);
        else if (op.direction === "left") player.x = Math.max(0, player.x - 1);
        else if (op.direction === "right") player.x = Math.min(state.config.mapWidth - 1, player.x + 1);
      }
    }
  }

  if (op.type === "PLACE_BOMB") {
    const player = next.players?.[localPlayerId];
    // Idempotency guard: if this optimisticId already placed a bomb, skip.
    // Prevents duplicates when useVersionedOptimisticState re-applies
    // pending events from structuredClone(base) on each reconciliation.
    if (op.optimisticId !== undefined && placedBombs.has(op.optimisticId)) {
      return next;
    }
    if (player?.alive && player.bombActive < player.bombMax) {
      // Also check: don't place if a bomb already exists at this tile
      const hasBombHere = (next.bombs ?? []).some((b) => b.x === player.x && b.y === player.y);
      if (hasBombHere) return next;

      player.bombActive++;
      const bomb = {
        id: `bomb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        playerId: localPlayerId,
        x: player.x,
        y: player.y,
        fuse: state.config.bombFuse ?? 20,
        blastRadius: player.blastRadius,
      };
      next.bombs = [...(next.bombs ?? []), bomb];
      // Record that this optimisticId has been consumed, so re-applications
      // by useVersionedOptimisticState don't create duplicate bombs.
      if (op.optimisticId !== undefined) placedBombs.set(op.optimisticId, true);
    }
  }

  if (op.type === "DETONATE") {
    const player = next.players?.[localPlayerId];
    // DETONATE requires REMOTE item — optimistically apply anyway (server corrects)
    if (player?.alive) {
      // Local: trigger the oldest placed bomb immediately (approximate)
      const remoteBombs = next.bombs.filter((b) => b.playerId === localPlayerId).sort((a, b) => b.fuse - a.fuse); // oldest first = highest remaining fuse
      if (remoteBombs.length > 0) {
        remoteBombs[0].fuse = 1; // explode next tick
      }
    }
  }

  if (op.type === "ACTION") {
    const player = next.players?.[localPlayerId];
    if (player?.alive) {
      // Local: optimistic GLOVE pickup — server will correct if wrong
      const adjBombs = next.bombs.filter((b) => Math.abs(b.x - player.x) + Math.abs(b.y - player.y) <= 1);
      if (adjBombs.length > 0 && player.items.includes("GLOVE")) {
        // Optimistic: pick up adjacent bomb (server confirms via carriedBomb)
        player.carriedBomb = adjBombs[0].id;
      }
    }
  }

  if (op.type === "SURRENDER") {
    const player = next.players?.[localPlayerId];
    if (player) {
      player.alive = false;
    }
  }

  return next;
}
