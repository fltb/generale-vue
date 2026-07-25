import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BombermanService, decodeBombermanOperation } from "../service/BombermanService";
import { BombermanRoom } from "../instance/BombermanRoom";
import { BombermanGame } from "../instance/BombermanGame";
import { defaultBombermanConfig } from "../settings";
import { domainHandlers } from "../../../plugins/websocket";
import { GameStatus } from "@generale/types";

function makeConfig() {
  const cfg = defaultBombermanConfig();
  cfg.mapSource = { type: "preset", id: "classic" };
  return cfg;
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

function getRoom(service: BombermanService): BombermanRoom {
  const candidate: unknown = service;
  if (typeof candidate !== "object" || candidate === null || !("room" in candidate)) {
    throw new Error("BombermanService room is unavailable");
  }
  const room = candidate.room;
  if (!(room instanceof BombermanRoom)) throw new Error("BombermanService room has an invalid type");
  return room;
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

  it("creates a BombermanGame when startGame is called", async () => {
    const room = (service as any).room as BombermanRoom;
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector("p2", "P2"));

    await service.startGame();

    const game = (service as any).game as BombermanGame;
    expect(game).not.toBeNull();
    expect(game.getState().status).toBe(GameStatus.Playing);
  });

  it("does not inject an implicit bot for a solo room", async () => {
    const room = (service as any).room as BombermanRoom;
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));

    await service.startGame();

    const game = (service as any).game as BombermanGame;
    expect(Object.keys(game.getState().players)).toEqual(["host-1"]);
  });

  it("does not add bot when 2+ human players", async () => {
    const room = (service as any).room as BombermanRoom;
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector("p2", "P2"));

    await service.startGame();

    const game = (service as any).game as BombermanGame;
    const state = game.getState();
    const playerIds = Object.keys(state.players);
    expect(playerIds.length).toBe(2);
    expect(playerIds.every((id) => !id.startsWith("bot-"))).toBe(true);
  });


  it("delays startTicking by 3 seconds", async () => {
    vi.useFakeTimers();
    try {
      const room = (service as any).room as BombermanRoom;
      room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));

      await service.startGame();

      const game = (service as any).game as BombermanGame;
      expect(game).not.toBeNull();

      const tickSpy = vi.spyOn(game, "startTicking").mockImplementation(() => {});
      expect(tickSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(3000);
      expect(tickSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  })

  it("fires onEnd callback and cleans up game when all players die", async () => {
    vi.useFakeTimers();
    try {
      const room = (service as any).room as BombermanRoom;
      room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));
      room.addPlayer({ id: "p2", name: "P2" }, mockConnector("p2", "P2"));

      await service.startGame();

      // Advance 3s to trigger startTicking
      vi.advanceTimersByTime(3000);

      const game = (service as any).game as BombermanGame;
      expect(game).not.toBeNull();

      // Queue SURRENDER for every participant.
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
  })

  it("sends state snapshot to game connectors on tick", async () => {
    vi.useFakeTimers();
    try {
      const room = (service as any).room as BombermanRoom;
      room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));
      room.addPlayer({ id: "p2", name: "P2" }, mockConnector("p2", "P2"));

      await service.startGame();

      // Manually add a game connector (simulating a player connecting to game domain)
      // Must be AFTER startGame() since startGame recreates the sync manager
      const gameConnector = mockConnector("host-1", "Host");
      (service as any).sync.addPlayer("host-1", gameConnector);

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
      expect(sentPayload.payload.payload.status).toBe(GameStatus.Playing);
    } finally {
      vi.useRealTimers();
    }
  });

  it("recreates sync on second startGame so new connectors get fresh state (not stale from previous game)", async () => {
    vi.useFakeTimers();
    try {
      const room = (service as any).room as BombermanRoom;
      room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));
      room.addPlayer({ id: "p2", name: "P2" }, mockConnector("p2", "P2"));

      // --- Game 1: play and end ---
      await service.startGame();
      const sync1 = (service as any).sync;
      vi.advanceTimersByTime(3000);
      const game1 = (service as any).game as BombermanGame;
      expect(game1).not.toBeNull();

      // End game: all players surrender
      for (const pid of Object.keys(game1.getState().players)) {
        game1.handleAction(pid, { type: "SURRENDER" });
      }
      vi.advanceTimersByTime(100); // one tick
      expect((service as any).game).toBeNull(); // game cleaned up

      // --- Game 2: new game ---
      await service.startGame();
      const sync2 = (service as any).sync;
      vi.advanceTimersByTime(3000);
      const game2 = (service as any).game as BombermanGame;
      expect(game2).not.toBeNull();

      // A fresh sync manager should have been created (not the destroyed game1 sync)
      expect(sync2).not.toBe(sync1);

      // Add connector to game 2 and verify it receives PLAYING state (not Ended)
      const conn = mockConnector("host-1", "Host");
      (service as any).sync.addPlayer("host-1", conn);
      vi.advanceTimersByTime(100);

      expect(conn.send).toHaveBeenCalled();
      const payload = conn.send.mock.calls[0]?.[0];
      expect(payload.type).toBe("state-update");
      // Must be a fresh game state, NOT the previous game's Ended state
      expect(payload.payload.payload.status).toBe(GameStatus.Playing);
      expect(payload.payload.payload.tick).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  })

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
  it("reconnects a participant during between-rounds through the room snapshot", () => {
    service = new BombermanService("test-between-rounds-reconnect", "Room", makeConfig(), "host-1", "Host");
    service.registerHandlers();
    const room = getRoom(service);
    const host = mockConnector("host-1", "Host");
    const participant = mockConnector("p2", "P2");
    room.addPlayer({ id: "host-1", name: "Host" }, host);
    room.addPlayer({ id: "p2", name: "P2" }, participant);
    room.getState().phase = "between_rounds";

    const roomInternals = room as unknown as {
      handleClose: (id: string, connector: unknown) => void;
    };
    roomInternals.handleClose("p2", participant);

    const prep = service.prepConnectionForPlayer("p2");
    expect(prep.data).toMatchObject({
      phase: "between_rounds",
      role: "player",
      domains: {
        primary: "room-test-between-rounds-reconnect",
      },
    });

    const roomHandler = domainHandlers.get(`room-${service.gameId}`);
    expect(roomHandler).toBeDefined();
    const reconnect = mockConnector("p2", "P2");
    roomHandler?.(reconnect);
    const onOpen = reconnect.onOpen.mock.calls[0]?.[0] as (() => void) | undefined;
    onOpen?.();

    expect(reconnect.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "state-update",
        payload: expect.objectContaining({
          type: "snapshot",
          payload: expect.objectContaining({ phase: "between_rounds" }),
        }),
      }),
    );
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

  it("cleans up game and room", async () => {
    service = new BombermanService("test-5", "Room", makeConfig(), "host-1", "Host");
    const room = (service as any).room as BombermanRoom;
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector("p2", "P2"));

    await service.startGame();
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

describe("decodeBombermanOperation", () => {
  it("SET_DIRECTION null with optimisticId survives", () => {
    const result = decodeBombermanOperation({ type: "SET_DIRECTION", direction: null, optimisticId: 2 });
    expect(result).toEqual({ type: "SET_DIRECTION", direction: null, optimisticId: 2 });
  });

  it("malformed directions return null", () => {
    expect(decodeBombermanOperation({ type: "SET_DIRECTION", direction: "diagonal" })).toBeNull();
    expect(decodeBombermanOperation({ type: "SET_DIRECTION", direction: 123 })).toBeNull();
    expect(decodeBombermanOperation({ type: "SET_DIRECTION", direction: "" })).toBeNull();
  });

  it("absent direction handles as null", () => {
    const result = decodeBombermanOperation({ type: "SET_DIRECTION" });
    expect(result).toEqual({ type: "SET_DIRECTION", direction: null });
  });

  it("unknown type returns null", () => {
    expect(decodeBombermanOperation({ type: "FLY" })).toBeNull();
    expect(decodeBombermanOperation({ type: "" })).toBeNull();
  });

  it("valid one-shot action survives", () => {
    expect(decodeBombermanOperation({ type: "PLACE_BOMB" })).toEqual({ type: "PLACE_BOMB" });
    expect(decodeBombermanOperation({ type: "PLACE_BOMB", optimisticId: 5 })).toEqual({ type: "PLACE_BOMB", optimisticId: 5 });
    expect(decodeBombermanOperation({ type: "ACTION" })).toEqual({ type: "ACTION" });
    expect(decodeBombermanOperation({ type: "DETONATE" })).toEqual({ type: "DETONATE" });
    expect(decodeBombermanOperation({ type: "SURRENDER" })).toEqual({ type: "SURRENDER" });
  });

  it("MOVE with valid direction survives", () => {
    expect(decodeBombermanOperation({ type: "MOVE", direction: "up" })).toEqual({ type: "MOVE", direction: "up" });
    expect(decodeBombermanOperation({ type: "MOVE", direction: "down", optimisticId: 3 })).toEqual({ type: "MOVE", direction: "down", optimisticId: 3 });
  });
  it("non-object value returns null", () => {
    expect(decodeBombermanOperation(null)).toBeNull();
    expect(decodeBombermanOperation(undefined)).toBeNull();
    expect(decodeBombermanOperation("string")).toBeNull();
    expect(decodeBombermanOperation(42)).toBeNull();
    expect(decodeBombermanOperation(true)).toBeNull();
  });

  it("malformed optimisticId returns null", () => {
    expect(decodeBombermanOperation({ type: "MOVE", direction: "up", optimisticId: "abc" })).toBeNull();
    expect(decodeBombermanOperation({ type: "MOVE", direction: "up", optimisticId: null })).toBeNull();
    expect(decodeBombermanOperation({ type: "PLACE_BOMB", optimisticId: true })).toBeNull();
    expect(decodeBombermanOperation({ type: "PLACE_BOMB", optimisticId: [1, 2] })).toBeNull();
  });
  
});

describe("game-domain handler — action forwarding", () => {
  let service: BombermanService;

  afterEach(() => {
    vi.useRealTimers();
    try {
      service?.destroy();
    } catch {
      // ignore cleanup errors
    }
  });

  it("SET_DIRECTION null reaches BombermanGame.handleAction with direction null and ID 2", async () => {
    service = new BombermanService("test-handler-1", "Room", makeConfig(), "host-1", "Host");
    service.registerHandlers();
    const room = (service as any).room as BombermanRoom;
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector("p2", "P2"));
    await service.startGame();

    const gameHandler = domainHandlers.get(`game-${service.gameId}`);
    expect(gameHandler).toBeDefined();

    const game = (service as any).game as BombermanGame;
    const spy = vi.spyOn(game, "handleAction");

    const conn = mockConnector("host-1", "Host");
    gameHandler(conn);

    // Invoke the onClientMessage callback registered by the handler
    const onMsg = conn.onClientMessage.mock.calls[0]?.[0];
    expect(onMsg).toBeDefined();
    onMsg({ type: "SET_DIRECTION", direction: null, optimisticId: 2 });

    expect(spy).toHaveBeenCalledWith("host-1", { type: "SET_DIRECTION", direction: null, optimisticId: 2 });
  });

  it("malformed event does not call handleAction", async () => {
    service = new BombermanService("test-handler-2", "Room", makeConfig(), "host-1", "Host");
    service.registerHandlers();
    const room = (service as any).room as BombermanRoom;
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector("p2", "P2"));
    await service.startGame();

    const gameHandler = domainHandlers.get(`game-${service.gameId}`);
    const game = (service as any).game as BombermanGame;
    const spy = vi.spyOn(game, "handleAction");

    const conn = mockConnector("host-1", "Host");
    gameHandler(conn);

    const onMsg = conn.onClientMessage.mock.calls[0]?.[0];
    expect(onMsg).toBeDefined();

    // Unknown type
    onMsg({ type: "FLY" });
    expect(spy).not.toHaveBeenCalled();

    // Malformed direction
    onMsg({ type: "SET_DIRECTION", direction: "diagonal" });
    expect(spy).not.toHaveBeenCalled();
  });

});

describe("game-domain handler — connector close", () => {
  let service: BombermanService;

  afterEach(() => {
    vi.useRealTimers();
    try {
      service?.destroy();
    } catch {
      // ignore cleanup errors
    }
  });

  it("game connector close invokes stopMovement before surrender timeout", async () => {
    vi.useFakeTimers();
    try {
      service = new BombermanService("test-stop-1", "Room", makeConfig(), "host-1", "Host");
      service.registerHandlers();
      const room = (service as any).room as BombermanRoom;
      room.addPlayer({ id: "host-1", name: "Host" }, mockConnector("host-1", "Host"));
      room.addPlayer({ id: "p2", name: "P2" }, mockConnector("p2", "P2"));
      await service.startGame();

      const gameHandler = domainHandlers.get(`game-${service.gameId}`);
      expect(gameHandler).toBeDefined();

      const game = (service as any).game as BombermanGame;
      const stopSpy = vi.spyOn(game, "stopMovement");
      const handleSpy = vi.spyOn(game, "handleAction");

      const conn = mockConnector("host-1", "Host");
      gameHandler(conn);

      // The handler registers two onClose callbacks:
      //   calls[0] = sync.addPlayer's internal cleanup
      //   calls[1] = game handler's stopMovement + surrender timer
      const syncOnClose = conn.onClose.mock.calls[0]?.[0];
      const gameOnClose = conn.onClose.mock.calls[1]?.[0];
      expect(syncOnClose).toBeDefined();
      expect(gameOnClose).toBeDefined();

      stopSpy.mockClear();

      // Simulate full close sequence: sync cleanup first, then game handler
      syncOnClose();
      gameOnClose();

      // stopMovement called immediately (synchronously, before any timer)
      expect(stopSpy).toHaveBeenCalledWith("host-1");

      // Surrender should not have been called yet (30s timer)
      expect(handleSpy).not.toHaveBeenCalled();

      // Advance 30s: surrender timer fires (sync cleanup already removed the
      // connector from the map, so getPlayerConnector returns undefined)
      vi.advanceTimersByTime(30000);
      expect(handleSpy).toHaveBeenCalledWith("host-1", { type: "SURRENDER" });
    } finally {
      vi.useRealTimers();
    }
  });
});
