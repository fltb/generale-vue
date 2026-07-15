import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BombermanService } from "../service/BombermanService";
import { BombermanRoom } from "../instance/BombermanRoom";
import { BombermanGame } from "../instance/BombermanGame";
import { defaultBombermanConfig } from "../settings";
import { GameStatus } from "@generale/types";

function makeConfig() {
  return defaultBombermanConfig();
}

function mockConnector(userid?: string, username?: string) {
  return {
    context: { userid: userid ?? "u1", username: username ?? "P1" },
    onOpen: vi.fn(),
    onDisconnect: vi.fn(),
    onReconnect: vi.fn(),
    onClientMessage: vi.fn(),
    onClose: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    getConnectionId: vi.fn(() => "conn-1"),
    getContext: vi.fn(() => ({ userid: userid ?? "u1", username: username ?? "P1" })),
    domain: "test",
    ready: true,
  } as any;
}

describe("BombermanService — startGame", () => {
  let service: BombermanService;

  beforeEach(() => {
    service = new BombermanService("test-1", "TestRoom", makeConfig(), "host-1", "Host");
  });

  afterEach(() => {
    vi.useRealTimers();
    try {
      service.destroy();
    } catch {
      // ignore cleanup errors
    }
  });

  it("creates a BombermanGame when startGame is called", () => {
    const room = (service as any).room as BombermanRoom;
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector("p2", "P2"));

    service.startGame();

    const game = (service as any).game as BombermanGame;
    expect(game).not.toBeNull();
    expect(game.getState().status).toBe(GameStatus.Playing);
  });

  it("adds a bot when only 1 human player", () => {
    const room = (service as any).room as BombermanRoom;
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));

    service.startGame();

    const game = (service as any).game as BombermanGame;
    const state = game.getState();
    const playerIds = Object.keys(state.players);
    expect(playerIds.length).toBe(2);
    expect(playerIds).toContain("host-1");
    expect(playerIds.some((id) => id.startsWith("bot-"))).toBe(true);
  });

  it("does not add bot when 2+ human players", () => {
    const room = (service as any).room as BombermanRoom;
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector("p2", "P2"));

    service.startGame();

    const game = (service as any).game as BombermanGame;
    const state = game.getState();
    const playerIds = Object.keys(state.players);
    expect(playerIds.length).toBe(2);
    expect(playerIds.every((id) => !id.startsWith("bot-"))).toBe(true);
  });

  it("delays startTicking by 3 seconds", () => {
    vi.useFakeTimers();
    try {
      const room = (service as any).room as BombermanRoom;
      room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));

      service.startGame();

      const game = (service as any).game as BombermanGame;
      expect(game).not.toBeNull();

      const tickSpy = vi.spyOn(game, "startTicking").mockImplementation(() => {});
      expect(tickSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(3000);
      expect(tickSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fires onEnd callback and cleans up game when all players die", () => {
    vi.useFakeTimers();
    try {
      const room = (service as any).room as BombermanRoom;
      room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));

      service.startGame();

      // Advance 3s to trigger startTicking
      vi.advanceTimersByTime(3000);

      const game = (service as any).game as BombermanGame;
      expect(game).not.toBeNull();

      // Queue SURRENDER for all players (host + bot)
      const state = game.getState();
      for (const pid of Object.keys(state.players)) {
        game.handleAction(pid, { type: "SURRENDER" });
      }

      // Advance one tick interval (tickRate=10 → 100ms)
      vi.advanceTimersByTime(100);

      // Game should have ended and been cleaned up
      expect((service as any).game).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends state snapshot to game connectors on tick", () => {
    vi.useFakeTimers();
    try {
      const room = (service as any).room as BombermanRoom;
      room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));

      // Manually add a game connector (simulating a player connecting to game domain)
      const gameConnector = mockConnector("host-1", "Host");
      (service as any).sync.addPlayer("host-1", gameConnector);

      service.startGame();

      // Advance 3s to trigger startTicking
      vi.advanceTimersByTime(3000);

      // Advance one tick interval
      vi.advanceTimersByTime(100);

      // Connector should have received a state update
      expect(gameConnector.send).toHaveBeenCalled();
      const sentPayload = gameConnector.send.mock.calls[0]?.[0];
      expect(sentPayload).toBeDefined();
      expect(sentPayload.type).toBe("state-update");
      expect(sentPayload.payload.type).toBe("snapshot");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("BombermanService — prepConnectionForPlayer", () => {
  let service: BombermanService;

  afterEach(() => {
    try {
      service.destroy();
    } catch {
      // ignore cleanup errors
    }
  });

  it("returns game domain when phase is playing and player is in room", () => {
    service = new BombermanService("test-2", "Room", makeConfig(), "host-1", "Host");
    const room = (service as any).room as BombermanRoom;
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector("p2", "P2"));

    // Simulate the full START_GAME flow through the room (sets phase to "playing" and calls onGameStart)
    (room as any).handleClientAction("p2", { type: "READY" } as any);
    (room as any).handleClientAction("host-1", { type: "START_GAME" } as any);

    const result = service.prepConnectionForPlayer("host-1");
    expect(result.success).toBe(true);
    expect(result.data.playerId).toBe("host-1");
    expect(result.data.domains.primary).toBe("game-test-2");
  });

  it("returns room domain when phase is lobby", () => {
    service = new BombermanService("test-3", "Room", makeConfig(), "host-1", "Host");
    const room = (service as any).room as BombermanRoom;
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));

    const result = service.prepConnectionForPlayer("host-1");
    expect(result.success).toBe(true);
    expect(result.data.phase).toBe("lobby");
    expect(result.data.domains.primary).toBe("room-test-3");
  });

  it("returns room domain when player is not in the game", () => {
    service = new BombermanService("test-4", "Room", makeConfig(), "host-1", "Host");
    const room = (service as any).room as BombermanRoom;
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));

    // Non-existent player gets room domain even if phase is playing
    const result = service.prepConnectionForPlayer("stranger");
    expect(result.data.domains.primary).toBe("room-test-4");
  });
});

describe("BombermanService — destroy", () => {
  let service: BombermanService;

  afterEach(() => {
    try {
      service.destroy();
    } catch {
      // ignore cleanup errors
    }
  });

  it("cleans up game and room", () => {
    service = new BombermanService("test-5", "Room", makeConfig(), "host-1", "Host");
    const room = (service as any).room as BombermanRoom;
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector("p2", "P2"));

    service.startGame();
    expect((service as any).game).not.toBeNull();

    service.destroy();
    expect((service as any).destroyed).toBe(true);
    // The game instance is destroyed but not set to null (onEnd callback sets it to null)
    expect((service as any).game?.destroyed).toBe(true);
  });

  it("does not throw on double destroy", () => {
    service = new BombermanService("test-6", "Room", makeConfig(), "host-1", "Host");
    service.destroy();
    expect(() => service.destroy()).not.toThrow();
  });

  it("cleans up even when game was not started", () => {
    service = new BombermanService("test-7", "Room", makeConfig(), "host-1", "Host");
    expect(() => service.destroy()).not.toThrow();
  });
});

describe("BombermanService — getSummary / getPlayerCount", () => {
  let service: BombermanService;

  afterEach(() => {
    try {
      service.destroy();
    } catch {
      // ignore cleanup errors
    }
  });

  it("getSummary returns room info", () => {
    service = new BombermanService("test-8", "MyRoom", makeConfig(), "host-1", "Host");
    const room = (service as any).room as BombermanRoom;
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector("p2", "P2"));

    const summary = service.getSummary();
    expect(summary.roomName).toBe("MyRoom");
    expect(summary.playerCount).toBe(2);
    expect(summary.hostName).toBe("Host");
    expect(summary.hasPassword).toBe(false);
  });

  it("getPlayerCount returns player count in room", () => {
    service = new BombermanService("test-9", "Room", makeConfig(), "host-1", "Host");
    const room = (service as any).room as BombermanRoom;
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector("p2", "P2"));

    expect(service.getPlayerCount()).toBe(2);
  });
});
