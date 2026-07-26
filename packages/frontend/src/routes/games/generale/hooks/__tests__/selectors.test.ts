import { describe, it, expect } from "vitest";
import { playerSummaries, computeEndgameResult, isGameInProgress } from "../selectors";
import {
  GameStatus,
  PlayerColor,
  PlayerStatus,
  PreGamePlayerReadyState,
  PreGamePlayerStatus,
  TileType,
  type GameSettings,
  type PreGamePlayerInfo,
  type SyncedGameState,
  type Tile,
} from "@generale/types";

function tile(owner: string | null): Tile {
  return { type: TileType.Plain, ownerId: owner, army: 0 };
}

function row(...owners: (string | null)[]): Tile[] {
  return owners.map((o) => tile(o));
}

const gameSettings = {
  tileGrow: {
    [TileType.Plain]: { duration: 40, growth: 1 },
    [TileType.Throne]: { duration: 1, growth: 1 },
    [TileType.Barracks]: { duration: 1, growth: 1 },
    [TileType.Mountain]: { duration: 1e10, growth: 0 },
    [TileType.Swamp]: { duration: 1, growth: -1 },
    [TileType.Fog]: { duration: 1e10, growth: 0 },
  },
  afkThreshold: 100,
} satisfies GameSettings;

const mockGameState = (overrides?: Partial<SyncedGameState>): SyncedGameState => ({
  status: GameStatus.Ended,
  tick: 100,
  settings: gameSettings,
  players: {
    p1: { id: "p1", status: PlayerStatus.Won, army: 30, land: 3, lastActiveTick: 100, teamId: "team1" },
    p2: { id: "p2", status: PlayerStatus.Defeated, army: 15, land: 2, lastActiveTick: 100, teamId: "team2" },
  } satisfies SyncedGameState["players"],
  teams: {
    team1: { id: "team1", memberIds: ["p1"], status: PlayerStatus.Won },
    team2: { id: "team2", memberIds: ["p2"], status: PlayerStatus.Defeated },
  } satisfies SyncedGameState["teams"],
  map: {
    width: 5,
    height: 5,
    tiles: [
      row(null, null, null, null, null),
      row(null, "p1", "p2", "p1", null),
      row(null, "p2", null, "p1", null),
      row(null, null, null, null, null),
      row(null, null, null, null, null),
    ],
  },
  playerDisplay: {
    p1: { tileColor: 0xff0000, name: "Alice", displayName: "Alice" },
    p2: { tileColor: 0x0000ff, name: "Bob", displayName: "Bob" },
  },
  playerOperationQueue: [],
  ...overrides,
});

describe("playerSummaries", () => {
  it("returns summaries with correct land counts", () => {
    const result = playerSummaries(mockGameState());
    expect(result).toHaveLength(2);
    const alice = result.find((p) => p.id === "p1")!;
    expect(alice.land).toBe(3);
    expect(alice.army).toBe(30);
    const bob = result.find((p) => p.id === "p2")!;
    expect(bob.land).toBe(2);
  });

  it("sorts by army descending by default", () => {
    const result = playerSummaries(mockGameState());
    expect(result[0].id).toBe("p1");
    expect(result[1].id).toBe("p2");
  });

  it("respects limit option", () => {
    const result = playerSummaries(mockGameState(), { limit: 1 });
    expect(result).toHaveLength(1);
  });

  it("returns empty for undefined state", () => {
    expect(playerSummaries(undefined)).toEqual([]);
  });

  it("handles missing playerDisplay gracefully", () => {
    const state = mockGameState();
    state.playerDisplay = {};
    const result = playerSummaries(state);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBeUndefined();
  });
});

describe("computeEndgameResult", () => {
  it("returns won for winner player", () => {
    const result = computeEndgameResult(mockGameState(), "p1");
    expect(result.selfOutcome).toBe("won");
    expect(result.winnerLabel).toContain("Alice");
  });

  it("returns lost for defeated player", () => {
    const result = computeEndgameResult(mockGameState(), "p2");
    expect(result.selfOutcome).toBe("lost");
  });

  it("returns null selfOutcome for spectator", () => {
    const result = computeEndgameResult(mockGameState(), "spec");
    expect(result.selfOutcome).toBeNull();
  });
});

describe("isGameInProgress", () => {
  it("returns true if at least one player is Playing", () => {
    const players: PreGamePlayerInfo[] = [
      {
        id: "p1",
        status: PreGamePlayerStatus.Playing,
        teamId: "team1",
        isHost: false,
        name: "Alice",
        ready: PreGamePlayerReadyState.NotReady,
        tileColor: PlayerColor.Red,
      } satisfies PreGamePlayerInfo,
    ];
    expect(isGameInProgress(players)).toBe(true);
  });

  it("returns false for empty list", () => {
    expect(isGameInProgress([])).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isGameInProgress(undefined)).toBe(false);
  });
});
