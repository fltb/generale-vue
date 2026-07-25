import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchBombermanReplays, fetchBombermanReplayDetail } from "../replays";
import type { BombermanReplay, BombermanReplaySummary } from "@generale/types";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("fetchBombermanReplays", () => {
  it("sends correct query params (limit, offset)", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    await fetchBombermanReplays(10, 0);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/bomberman/replays");
    expect(calledUrl).toContain("limit=10");
    expect(calledUrl).toContain("offset=0");
  });

  it("clamps limit between 1 and 50", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    await fetchBombermanReplays(999, 0);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("limit=50");
  });

  it("throws on error response", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false, error: "DENIED" }),
    });

    await expect(fetchBombermanReplays(20, 0)).rejects.toThrow("DENIED");
  });

  it("returns parsed data on success", async () => {
    const summaries: BombermanReplaySummary[] = [
      {
        id: "r1",
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000 * 90,
        format: "single",
        winner: null,
        roundCount: 1,
      },
    ];
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, data: summaries }),
    });

    const result = await fetchBombermanReplays(20, 0);
    expect(result).toEqual(summaries);
    expect(result).toHaveLength(1);
  });
});

describe("fetchBombermanReplayDetail", () => {
  it("encodes the replay id in the URL", async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, data: null }),
    });

    await fetchBombermanReplayDetail("my-replay-1");
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toBe("/api/bomberman/replays/my-replay-1");
  });

  it("returns null for 404", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 404,
      json: () => Promise.resolve({ success: false, error: "REPLAY_NOT_FOUND" }),
    });

    const result = await fetchBombermanReplayDetail("nonexistent");
    expect(result).toBeNull();
  });

  it("throws REPLAY_CORRUPT for corrupt data", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 500,
      json: () => Promise.resolve({ success: false, error: "REPLAY_CORRUPT" }),
    });

    await expect(fetchBombermanReplayDetail("corrupt-id")).rejects.toThrow("REPLAY_CORRUPT");
  });

  it("returns parsed replay data on success", async () => {
    const replay: BombermanReplay = {
      schemaVersion: 1,
      engineVersion: 1,
      matchId: "match-1",
      config: {} as any,
      participants: [],
      rounds: [],
      result: {
        format: "single",
        targetWins: 1,
        currentRound: 1,
        currentAttempt: 1,
        scores: [],
        roundResults: [],
        winner: null,
        nextRoundStartsAt: null,
      },
    };
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, data: replay }),
    });

    const result = await fetchBombermanReplayDetail("replay-1");
    expect(result).toEqual(replay);
    expect(result?.matchId).toBe("match-1");
  });
});
