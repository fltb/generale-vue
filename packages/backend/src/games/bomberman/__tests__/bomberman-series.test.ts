import { afterEach, describe, expect, it, vi } from "vitest";
import type { BombermanGameEndResult } from "@generale/types";
import { BombermanRoom } from "../instance/BombermanRoom";
import { BombermanService } from "../service/BombermanService";
import { defaultBombermanConfig } from "../settings";

function connector() {
  return {
    send: vi.fn(),
    close: vi.fn(),
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onDisconnect: vi.fn(),
    onReconnect: vi.fn(),
    onClientMessage: vi.fn(),
  };
}

function createService(format: "single" | "bo3" | "bo5") {
  const config = defaultBombermanConfig();
  config.matchFormat = format;
  const service = new BombermanService("series", "Series", config, "p1", "P1");
  const room = (service as unknown as { room: BombermanRoom }).room;
  const p1Connector = connector();
  const p2Connector = connector();
  room.addPlayer({ id: "p1", name: "P1" }, p1Connector);
  room.addPlayer({ id: "p2", name: "P2" }, p2Connector);
  service.startGame();
  return { service, room, p1Connector, p2Connector };
}


function result(winnerId: string | null, reason: "last_alive" | "timeout" | "draw"): BombermanGameEndResult {
  return {
    winnerId,
    reason,
    state: ({} as BombermanGameEndResult["state"]),
  };
}

describe("Bomberman match lifecycle", () => {
  afterEach(() => vi.useRealTimers());

  it("ends a single match after one decisive round", () => {
    vi.useFakeTimers();
    const { service, room } = createService("single");
    service.handleRoundEnd(result("p1", "last_alive"));

    expect(room.getState().match.winner).toEqual({ kind: "player", id: "p1" });
    expect(room.getState().phase).toBe("lobby");
    service.destroy();
  });

  it("ends BO3 after two wins with completed round and match event state", () => {
    vi.useFakeTimers();
    const { service, room, p1Connector } = createService("bo3");
    service.handleRoundEnd(result("p1", "last_alive"));

    const firstRoundEnded = p1Connector.send.mock.calls
      .map(([message]) => message)
      .find((message) => message.payload?.type === "roundended")?.payload;
    expect(firstRoundEnded).toMatchObject({
      type: "roundended",
      match: {
        currentRound: 2,
        currentAttempt: 1,
        nextRoundStartsAt: expect.any(Number),
        scores: [{ competitor: { kind: "player", id: "p1" }, wins: 1 }],
        winner: null,
      },
    });

    service.handleRoundEnd(result("p1", "last_alive"));

    const matchEnded = p1Connector.send.mock.calls
      .map(([message]) => message)
      .find((message) => message.payload?.type === "matchended")?.payload;
    expect(matchEnded).toMatchObject({
      type: "matchended",
      match: {
        currentRound: 2,
        currentAttempt: 1,
        nextRoundStartsAt: null,
        scores: [{ competitor: { kind: "player", id: "p1" }, wins: 2 }],
        winner: { kind: "player", id: "p1" },
      },
    });
    expect(
      p1Connector.send.mock.calls.filter(([message]) => message.payload?.type === "roundended"),
    ).toHaveLength(1);
    expect(room.getState().match.scores[0]?.wins).toBe(2);
    expect(room.getState().match.winner).toEqual({ kind: "player", id: "p1" });
    service.destroy();
  });

  it("retries a drawn BO5 round without scoring or advancing the round", () => {
    vi.useFakeTimers();
    const { service, room, p1Connector } = createService("bo5");
    service.handleRoundEnd(result(null, "draw"));

    const match = room.getState().match;
    const roundEnded = p1Connector.send.mock.calls
      .map(([message]) => message)
      .find((message) => message.payload?.type === "roundended")?.payload;
    expect(roundEnded).toMatchObject({
      type: "roundended",
      match: {
        currentRound: 1,
        currentAttempt: 2,
        nextRoundStartsAt: expect.any(Number),
        scores: [],
        winner: null,
      },
    });
    expect(roundEnded?.match.nextRoundStartsAt).toBe(match.nextRoundStartsAt);
    expect(match.currentRound).toBe(1);
    expect(match.currentAttempt).toBe(2);
    expect(match.scores.every((score) => score.wins === 0)).toBe(true);
    expect(match.nextRoundStartsAt).not.toBeNull();
    expect(room.getState().phase).toBe("between_rounds");
    service.destroy();
  });
});
