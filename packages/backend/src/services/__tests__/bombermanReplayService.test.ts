import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db/client";
import { bombermanReplayService } from "../bombermanReplayService";
import type {
  BombermanReplayHeader,
  BombermanReplayRound,
  BombermanMatchState,
  BombermanWinner,
  BombermanReplayFrame,
  BombermanState,
} from "@generale/types";
import { BOMBERMAN_REPLAY_ENGINE_VERSION } from "@generale/types";

// ─── Mock DB — each method is a self-contained spy (no mockReturnThis chains) ───

let mockAll = vi.fn();
let mockInsertValuesRun = vi.fn();
let mockUpdateSetWhereRun = vi.fn();
let mockDeleteWhereRun = vi.fn();

function resetMocks() {
  mockAll = vi.fn();
  mockInsertValuesRun = vi.fn();
  mockUpdateSetWhereRun = vi.fn();
  mockDeleteWhereRun = vi.fn();
}

vi.mock("../../db/client", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              offset: vi.fn(() => ({ all: mockAll })),
            })),
            all: mockAll,
          })),
          all: mockAll,
        })),
        all: mockAll,
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ run: mockInsertValuesRun })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ run: mockUpdateSetWhereRun })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({ run: mockDeleteWhereRun })),
    })),
  },
}));

// ─── Helpers ───

function makeHeader(matchId: string): BombermanReplayHeader {
  return {
    schemaVersion: 1,
    engineVersion: 1,
    matchId,
    config: {
      matchFormat: "single",
      teamMode: "ffa",
      botCount: 0,
      botDifficulty: "easy",
      mapSource: { type: "procedural", themeId: "classic" },
      playerLimit: 4,
      roundTimeSec: 120,
      bombLimit: 2,
      mapWidth: 15,
      mapHeight: 13,
      suddenDeath: true,
      dropRate: 0.6,
      tickRate: 3,
      mapTheme: "classic",
    },
    participants: [],
  };
}

function makeRound(roundNumber: number, attempt: number): BombermanReplayRound {
  return {
    roundNumber,
    attempt,
    seed: 12345 + roundNumber * 100 + attempt,
    initialState: null as unknown as BombermanState,
    frames: [] as BombermanReplayFrame[],
    result: {
      roundNumber,
      attempt,
      winner: { kind: "player", id: "p1" },
      reason: "last_alive",
      ticks: 100,
    },
  };
}

function makeMatchState(): BombermanMatchState {
  return {
    format: "single",
    targetWins: 1,
    currentRound: 1,
    currentAttempt: 1,
    scores: [{ competitor: { kind: "player", id: "p1" }, wins: 1 }],
    roundResults: [
      { roundNumber: 1, attempt: 1, winner: { kind: "player", id: "p1" }, reason: "last_alive", ticks: 100 },
    ],
    winner: { kind: "player", id: "p1" },
    nextRoundStartsAt: null,
  };
}

// ─── Tests ───

describe("bombermanReplayService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("startRecording", () => {
    it("creates a replay record and inserts participant rows", () => {
      const header = makeHeader("match-1");
      header.participants = [
        { playerId: "p1", name: "Player 1", teamId: "team1", skinId: "classic-blue", isBot: false },
      ];
      const id = bombermanReplayService.startRecording(header, ["p1", "p2"]);

      expect(id).toEqual(expect.any(String));
      expect(mockInsertValuesRun).toHaveBeenCalled();
    });

    it("skips participant insert when none provided (empty human list)", () => {
      const header = makeHeader("match-1");
      const id = bombermanReplayService.startRecording(header, []);

      expect(id).toEqual(expect.any(String));
      // Only one insert call (replay row, no participants)
      // Since the mock uses mockInsertValuesRun for all inserts, it was called once
      expect(mockInsertValuesRun).toHaveBeenCalledTimes(1);
    });
  });

  describe("appendRound", () => {
    it("appends a compressed round payload", () => {
      const round = makeRound(1, 1);
      bombermanReplayService.appendRound("replay-1", round);
      expect(mockInsertValuesRun).toHaveBeenCalled();
    });
  });

  describe("complete", () => {
    it("marks the replay as complete with result and winner", () => {
      const result = makeMatchState();
      const winner: BombermanWinner = { kind: "player", id: "p1" };
      bombermanReplayService.complete("replay-1", result, winner);
      expect(mockUpdateSetWhereRun).toHaveBeenCalled();
    });

    it("marks as complete with null winner for draw", () => {
      const result = makeMatchState();
      result.winner = null;
      bombermanReplayService.complete("replay-1", result, null);
      expect(mockUpdateSetWhereRun).toHaveBeenCalled();
    });
  });

  describe("discard", () => {
    it("deletes the replay row (cascade deletes rounds/participants)", () => {
      bombermanReplayService.discard("replay-1");
      expect(mockDeleteWhereRun).toHaveBeenCalled();
    });
  });

  describe("listForUser", () => {
    it("returns empty array when user has no participants", () => {
      mockAll.mockReturnValue([]);

      const result = bombermanReplayService.listForUser("user-1", 20, 0);

      expect(result).toEqual([]);
    });
    it("returns formatted summaries for completed non-expired replays", () => {
      // Three all() calls: participant query, replays query, getRoundCount
      mockAll
        .mockReturnValueOnce([{ replayId: "r1" }, { replayId: "r2" }])
        .mockReturnValueOnce([
          {
            id: "r1",
            createdAt: new Date("2025-01-01"),
            expiresAt: new Date("3025-01-01"),
            format: "single",
            winnerJson: JSON.stringify({ kind: "player", id: "p1" }),
            status: "complete",
          },
        ])
        .mockReturnValue([{ count: 1 }]);

      const result = bombermanReplayService.listForUser("user-1", 20, 0);

      expect(result.length).toBe(1);
      expect(result[0]!.id).toBe("r1");
      expect(result[0]!.format).toBe("single");
      expect(result[0]!.winner).toEqual({ kind: "player", id: "p1" });
      expect(result[0]!.roundCount).toBe(1);
    });
  });

  describe("getForUser", () => {
    it("returns null when user is not a participant", () => {
      mockAll.mockReturnValue([]);

      const result = bombermanReplayService.getForUser("unauthorized-user", "r1");

      expect(result).toBeNull();
    });

    it("returns null when replay is expired", () => {
      mockAll
        .mockReturnValueOnce([{ userId: "user-1" }])
        .mockReturnValueOnce([
          {
            id: "r1",
            matchId: "match-1",
            status: "complete",
            engineVersion: 1,
            format: "single",
            configJson: JSON.stringify(makeHeader("match-1").config),
            winnerJson: JSON.stringify({ kind: "player", id: "p1" }),
            resultJson: JSON.stringify(makeMatchState()),
            expiresAt: new Date("2020-01-01"),
          },
        ]);

      const result = bombermanReplayService.getForUser("user-1", "r1");

      expect(result).toBeNull();
    });
    it("throws REPLAY_CORRUPT on corrupted result JSON", () => {
      mockAll
        .mockReturnValueOnce([{ userId: "user-1" }])
        .mockReturnValueOnce([
          {
            id: "r1",
            matchId: "match-1",
            status: "complete",
            engineVersion: 1,
            format: "single",
            configJson: "not-json",
            winnerJson: null,
            resultJson: "{{{corrupted",
            expiresAt: new Date("3025-01-01"),
          },
        ])
        .mockReturnValueOnce([]); // rounds query – will parse, but config/result parse will fail

      expect(() => bombermanReplayService.getForUser("user-1", "r1")).toThrow("REPLAY_CORRUPT");
    });

    it("returns full replay for authorized user with valid data", () => {
      mockAll
        .mockReturnValueOnce([{ userId: "user-1" }])
        .mockReturnValueOnce([
          {
            id: "r1",
            matchId: "match-1",
            status: "complete",
            engineVersion: 1,
            format: "single",
            configJson: JSON.stringify(makeHeader("match-1").config),
            winnerJson: JSON.stringify({ kind: "player", id: "p1" }),
            resultJson: JSON.stringify(makeMatchState()),
            expiresAt: new Date("3025-01-01"),
          },
        ])
        .mockReturnValueOnce([]);

      const result = bombermanReplayService.getForUser("user-1", "r1");

      expect(result).not.toBeNull();
      expect(result!.matchId).toBe("match-1");
      expect(result!.rounds).toEqual([]);
    });
  });

  describe("cleanupExpired", () => {
    it("removes expired replays and returns count", () => {
      mockAll.mockReturnValueOnce([{ id: "old-1" }, { id: "old-2" }]);

      const count = bombermanReplayService.cleanupExpired(Date.now() + 100000);

      expect(count).toBe(2);
    });

    it("returns 0 when no expired replays exist", () => {
      mockAll.mockReturnValue([]);

      const count = bombermanReplayService.cleanupExpired(Date.now());

      expect(count).toBe(0);
    });
  });
});
