import type {
  BombermanRoomState,
  BombermanPreGameClientDispatch,
} from "@generale/types";

/**
 * Local optimistic reducer for bomberman room (pregame) state.
 * Pure function — no UI/connection dependencies.
 *
 * Handles: CHANGE_CONFIG, READY, UNREADY, KICK_PLAYER, START_GAME, DISBAND_ROOM.
 */
export function applyBombermanRoomEventLocal(
  state: BombermanRoomState,
  action: BombermanPreGameClientDispatch,
  localPlayerId: string,
): BombermanRoomState {
  const next = JSON.parse(JSON.stringify(state)) as BombermanRoomState;

  switch (action.type) {
    case "CHANGE_CONFIG": {
      const payload = action.payload;
      if (payload.playerLimit !== undefined) next.maxPlayers = payload.playerLimit;
      if (payload.roundTimeSec !== undefined) next.config.roundTimeSec = payload.roundTimeSec;
      if (payload.mapWidth !== undefined) next.config.mapWidth = payload.mapWidth;
      if (payload.mapHeight !== undefined) next.config.mapHeight = payload.mapHeight;
      if (payload.bombLimit !== undefined) next.config.bombLimit = payload.bombLimit;
      if (payload.tickRate !== undefined) next.config.tickRate = payload.tickRate;
      if (payload.bombFuse !== undefined) next.config.bombFuse = payload.bombFuse;
      if (payload.blastRadius !== undefined) next.config.blastRadius = payload.blastRadius;
      if (payload.shrinkEnabled !== undefined) next.config.shrinkEnabled = payload.shrinkEnabled;
      if (payload.itemDropRate !== undefined) next.config.itemDropRate = payload.itemDropRate;
      if (payload.items !== undefined) next.config.items = payload.items;
      break;
    }
    case "READY": {
      const player = next.players.find((p) => p.id === localPlayerId);
      if (player && !player.isHost) player.ready = true;
      break;
    }
    case "UNREADY": {
      const player = next.players.find((p) => p.id === localPlayerId);
      if (player && !player.isHost) player.ready = false;
      break;
    }
    case "KICK_PLAYER": {
      next.players = next.players.filter((p) => p.id !== action.targetId);
      break;
    }
    case "START_GAME": {
      next.phase = "playing";
      break;
    }
    case "DISBAND_ROOM": {
      next.phase = "disbanded";
      break;
    }
  }

  return next;
}
