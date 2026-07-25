import type { BombermanRoomState, BombermanState } from "@generale/types";

/** Default empty room state — matches useBombermanRoomSession initialization */
export function makeEmptyBombermanRoom(): BombermanRoomState {
  return {
    roomName: "",
    players: [],
    config: {} as BombermanRoomState["config"],
    phase: "lobby",
    maxPlayers: 4,
    hostId: "",
    match: {
      format: "single",
      targetWins: 1,
      currentRound: 1,
      currentAttempt: 1,
      scores: [],
      roundResults: [],
      winner: null,
      nextRoundStartsAt: null,
    },
    teams: [],
    spectators: [],
  };
}

/** Default game state placeholder — used as initial value before server snapshot arrives */
export function makeEmptyBombermanGameState(): BombermanState {
  return null as unknown as BombermanState;
}
