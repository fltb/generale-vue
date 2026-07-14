import type { BombermanState, BombermanOperation } from "@generale/types";

/**
 * Local optimistic reducer for bomberman game state.
 * Pure function — no UI/connection dependencies.
 *
 * Handles:
 *  - SET_DIRECTION: move local player 1 tile (server corrects on collision)
 *  - PLACE_BOMB: decrement bombActive, add a visual bomb at player position
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
    if (player?.alive && player.bombActive < player.bombMax) {
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
    }
  }

  return next;
}
