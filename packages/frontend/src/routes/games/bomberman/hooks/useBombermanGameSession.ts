import type { BombermanState, BombermanOperation } from "@generale/types";
import type { SyncedState } from "./useBombermanRoomSession";

/**
 * Game-level hook that wraps a gameSync handle for use inside BombermanGame.
 *
 * Provides reactive state access and a dispatcher for player actions.
 */
export function useBombermanGameSession(
  gameSync: SyncedState<BombermanState, BombermanOperation>,
  _playerId: () => string,
  spectate?: boolean,
) {
  const state = () => gameSync.state();

  function onAction(op: BombermanOperation) {
    if (spectate) return; // Block all game actions in spectate mode
    gameSync.dispatch(op);
  }

  return {
    /** Reactive game state (same as gameSync.state()). */
    state,
    /** Dispatch a bomberman operation (SET_DIRECTION, PLACE_BOMB, etc.). */
    onAction,
  };
}
