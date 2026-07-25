import { describe, expect, it } from "vitest";
import type { BombermanMatchState, BombermanRoomState } from "@generale/types";
import { applyBombermanRoomEventLocal } from "../bombermanRoomReducer";

const initialMatch: BombermanMatchState = {
  format: "bo3",
  targetWins: 2,
  currentRound: 1,
  currentAttempt: 1,
  scores: [],
  roundResults: [],
  winner: null,
  nextRoundStartsAt: null,
};

const initialState: BombermanRoomState = {
  roomName: "test",
  players: [],
  config: {
    mapWidth: 13,
    mapHeight: 11,
    playerLimit: 4,
    tickRate: 20,
    bombFuse: 60,
    bombLimit: 1,
    blastRadius: 2,
    roundTimeSec: 180,
    shrinkEnabled: false,
    itemDropRate: 0.5,
    items: [],
    matchFormat: "bo3",
    teamMode: "ffa",
    botCount: 0,
    botDifficulty: "normal",
    mapSource: { type: "procedural", themeId: "classic" },
  },
  phase: "playing",
  maxPlayers: 4,
  hostId: "",
  match: initialMatch,
  teams: [],
  spectators: [],
};

describe("applyBombermanRoomEventLocal lifecycle actions", () => {
  it("applies ROUND_ENDED match scores before the game sync is cleared", () => {
    const endedMatch: BombermanMatchState = {
      ...initialMatch,
      currentRound: 2,
      scores: [{ competitor: { kind: "player", id: "p1" }, wins: 1 }],
      roundResults: [
        {
          roundNumber: 1,
          attempt: 1,
          winner: { kind: "player", id: "p1" },
          reason: "last_alive",
          ticks: 100,
        },
      ],
      nextRoundStartsAt: Date.now() + 5_000,
    };

    const next = applyBombermanRoomEventLocal(initialState, {
      type: "ROUND_ENDED",
      match: endedMatch,
    });

    expect(next.match.currentRound).toBe(2);
    expect(next.match.scores).toEqual(endedMatch.scores);
    expect(next.match.roundResults).toEqual(endedMatch.roundResults);
    expect(next.match).not.toBe(initialMatch);
    expect(next.match).not.toBe(endedMatch);
  });
});
