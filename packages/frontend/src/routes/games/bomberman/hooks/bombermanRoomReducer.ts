import type { BombermanMatchState, BombermanPreGameClientDispatch, BombermanRoomState } from "@generale/types";

/**
 * Local optimistic reducer for bomberman room (pregame) state.
 * Pure function — no UI/connection dependencies.
 *
 * Handles client actions and local lifecycle match synchronization.
 */
export type BombermanRoomLifecycleAction =
  | { type: "ROUND_STARTED"; match: BombermanMatchState }
  | { type: "ROUND_ENDED"; match: BombermanMatchState }
  | { type: "MATCH_ENDED"; match: BombermanMatchState };

export function applyBombermanRoomEventLocal(
  state: BombermanRoomState,
  action: BombermanPreGameClientDispatch | BombermanRoomLifecycleAction,
  localPlayerId = "",
): BombermanRoomState {
  const next = JSON.parse(JSON.stringify(state)) as BombermanRoomState;

  switch (action.type) {
    case "ROUND_STARTED":
    case "ROUND_ENDED":
    case "MATCH_ENDED": {
      next.match = structuredClone(action.match);
      break;
    }
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
      if (payload.matchFormat !== undefined) next.config.matchFormat = payload.matchFormat;
      if (payload.items !== undefined) next.config.items = payload.items;
      if (payload.teamMode !== undefined) next.config.teamMode = payload.teamMode;
      break;
    }
    case "CHANGE_TEAM_MODE": {
      next.config.teamMode = action.teamMode;
      break;
    }
    case "CHANGE_TEAM": {
      const p = next.players.find((pl) => pl.id === action.playerId);
      if (p) p.teamId = action.teamId;
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
    case "ENTER_SPECTATE": {
      const p = next.players.find((p) => p.id === localPlayerId);
      if (p) {
        p.status = "spectating";
        p.ready = false;
      }
      break;
    }
    case "LEAVE_SPECTATE": {
      const p = next.players.find((p) => p.id === localPlayerId);
      if (p) {
        p.status = "lobby";
      }
      break;
    }
  }

  return next;
}
