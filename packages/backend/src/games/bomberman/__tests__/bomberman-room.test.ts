import { describe, it, expect } from "vitest";
import { BombermanRoom } from "../instance/BombermanRoom";
import { defaultBombermanConfig } from "../settings";

function mockConnector() {
  return {
    onOpen: () => {},
    onDisconnect: () => {},
    onReconnect: () => {},
    onClientMessage: () => {},
    onClose: () => {},
    send: () => {},
    close: () => {},
  } as any;
}

describe("BombermanRoom — host auto-ready", () => {
  it("host starts ready when joining", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());
    const state = room.getState();
    expect(state.players[0].isHost).toBe(true);
    expect(state.players[0].ready).toBe(true);
  });

  it("non-host starts not ready", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector());
    const state = room.getState();
    const p2 = state.players.find((p) => p.id === "p2");
    expect(p2?.ready).toBe(false);
    expect(p2?.isHost).toBe(false);
  });

  it("host cannot unready", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());
    room.handleClientAction("host-1", { type: "UNREADY" } as any);
    const state = room.getState();
    expect(state.players[0].ready).toBe(true);
  });

  it("START_GAME fails when non-host not ready", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector());
    room.handleClientAction("host-1", { type: "START_GAME" } as any);
    expect(room.getState().phase).toBe("lobby");
  });

  it("START_GAME succeeds when all non-host ready", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector());
    room.handleClientAction("p2", { type: "READY" } as any);
    room.handleClientAction("host-1", { type: "START_GAME" } as any);
    expect(room.getState().phase).toBe("playing");
  });
});

describe("BombermanRoom — destroy and disband", () => {
  it("sets destroyed flag and prevents new players", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());

    room.destroy();

    expect(room.isDisbanded()).toBe(true);

    const result = room.addPlayer({ id: "p2", name: "P2" }, mockConnector());
    expect(result.success).toBe(false);
    expect((result as { message: string }).message).toBe("Room destroyed");
  });

  it("handleClientAction is no-op on destroyed room", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());

    room.destroy();

    expect(() => room.handleClientAction("host-1", { type: "READY" } as any)).not.toThrow();
  });

  it("calling destroy twice is safe", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());

    room.destroy();
    expect(() => room.destroy()).not.toThrow();
    expect(room.isDisbanded()).toBe(true);
  });
});

describe("BombermanRoom — CHANGE_CONFIG validation", () => {
  it("rejects invalid config (mapWidth too small)", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());

    const configBefore = room.getState().config.mapWidth;
    room.handleClientAction("host-1", { type: "CHANGE_CONFIG", payload: { mapWidth: 3 } } as any);

    expect(room.getState().config.mapWidth).toBe(configBefore);
  });

  it("rejects invalid config (playerLimit too high)", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());

    const configBefore = room.getState().config.playerLimit;
    room.handleClientAction("host-1", { type: "CHANGE_CONFIG", payload: { playerLimit: 10 } } as any);

    expect(room.getState().config.playerLimit).toBe(configBefore);
  });

  it("accepts valid config changes (roundTimeSec)", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());

    room.handleClientAction("host-1", { type: "CHANGE_CONFIG", payload: { roundTimeSec: 120 } } as any);

    expect(room.getState().config.roundTimeSec).toBe(120);
  });

  it("non-host cannot change config", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector());

    const configBefore = room.getState().config.roundTimeSec;
    room.handleClientAction("p2", { type: "CHANGE_CONFIG", payload: { roundTimeSec: 60 } } as any);

    expect(room.getState().config.roundTimeSec).toBe(configBefore);
  });
});

describe("BombermanRoom — handleDisconnect", () => {
  it("removes non-host player from lobby on disconnect", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    const hostConn = mockConnector();
    const p2Conn = mockConnector();
    room.addPlayer({ id: "host-1", name: "Host" }, hostConn);
    room.addPlayer({ id: "p2", name: "P2" }, p2Conn);

    room.handleDisconnect("p2", p2Conn);

    const state = room.getState();
    expect(state.players.find((p) => p.id === "p2")).toBeUndefined();
    expect(state.players.length).toBe(1);
  });

  it("host disconnect in lobby sets reclaim timer (not removed)", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    const hostConn = mockConnector();
    const p2Conn = mockConnector();
    room.addPlayer({ id: "host-1", name: "Host" }, hostConn);
    room.addPlayer({ id: "p2", name: "P2" }, p2Conn);

    room.handleDisconnect("host-1", hostConn);

    const state = room.getState();
    expect(state.players.find((p) => p.id === "host-1")).toBeDefined();
    expect(state.players.length).toBe(2);
  });

  it("handleDisconnect for unknown player is no-op", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    const hostConn = mockConnector();
    room.addPlayer({ id: "host-1", name: "Host" }, hostConn);

    expect(() => room.handleDisconnect("nonexistent", mockConnector())).not.toThrow();
  });

  it("handleDisconnect with wrong connector is no-op", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());

    // wrong connector object
    expect(() => room.handleDisconnect("host-1", mockConnector())).not.toThrow();
  });
});

describe("BombermanRoom — handleClose", () => {
  it("removes player on close", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    const hostConn = mockConnector();
    const p2Conn = mockConnector();
    room.addPlayer({ id: "host-1", name: "Host" }, hostConn);
    room.addPlayer({ id: "p2", name: "P2" }, p2Conn);

    room.handleClose("p2", p2Conn);

    const state = room.getState();
    expect(state.players.find((p) => p.id === "p2")).toBeUndefined();
    expect(state.players.length).toBe(1);
  });
  it("keeps participants reconnectable during between-rounds but rejects new players", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    const hostConn = mockConnector();
    const p2Conn = mockConnector();
    room.addPlayer({ id: "host-1", name: "Host" }, hostConn);
    room.addPlayer({ id: "p2", name: "P2" }, p2Conn);
    room.getState().phase = "between_rounds";

    const internals = room as unknown as {
      handleDisconnect: (id: string, connector: unknown) => void;
      handleClose: (id: string, connector: unknown) => void;
    };
    internals.handleDisconnect("p2", p2Conn);
    internals.handleClose("p2", p2Conn);

    expect(room.getPlayers().some((player) => player.id === "p2")).toBe(true);
    expect(room.canJoin("new-player").success).toBe(false);
    expect(room.addPlayer({ id: "p2", name: "P2" }, mockConnector()).success).toBe(true);
  });

  it("last player close disbands the room", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    const hostConn = mockConnector();
    room.addPlayer({ id: "host-1", name: "Host" }, hostConn);

    room.handleClose("host-1", hostConn);

    expect(room.isDisbanded()).toBe(true);
    expect(room.getState().phase).toBe("disbanded");
  });
});

describe("BombermanRoom — password protection", () => {
  it("rejects wrong password", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host", "secret");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());

    const result = room.canJoin("p2", "wrong");
    expect(result.success).toBe(false);
    expect((result as { message: string }).message).toBe("Wrong password");
  });

  it("allows correct password", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host", "secret");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());

    const result = room.canJoin("p2", "secret");
    expect(result.success).toBe(true);
  });

  it("first player skips password check", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host", "secret");
    const result = room.canJoin("host-1");
    expect(result.success).toBe(true);
  });

  it("existing player skips password check on reconnect", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host", "secret");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());
    room.addPlayer({ id: "p2", name: "P2", password: "secret" }, mockConnector());

    // existing player rejoining with wrong password should still work
    const result = room.canJoin("p2", "wrong");
    expect(result.success).toBe(true);
  });

  it("getPassword returns stored password", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host", "secret");
    expect(room.getPassword()).toBe("secret");

    const room2 = new BombermanRoom("Test2", defaultBombermanConfig(), "host-1", "Host");
    expect(room2.getPassword()).toBeUndefined();
  });

  it("canJoin returns correct messages for full room and in-progress", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());

    // Simulate in-progress
    const state = room.getState();
    state.phase = "playing";
    const result = room.canJoin("p2");
    expect(result.success).toBe(false);
    expect((result as { message: string }).message).toBe("Game already in progress");
  });
});

describe("BombermanRoom — getters and callbacks", () => {
  it("getPhase returns current phase", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    expect(room.getPhase()).toBe("lobby");
  });

  it("getPlayers returns player list", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector());

    const players = room.getPlayers();
    expect(players).toHaveLength(2);
    expect(players[0]?.id).toBe("host-1");
    expect(players[1]?.id).toBe("p2");
  });

  it("getPlayerIds returns array of player ids", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector());

    const ids = room.getPlayerIds();
    expect(ids).toEqual(["host-1", "p2"]);
  });

  it("getConfig returns current config", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    const config = room.getConfig();
    expect(config.mapWidth).toBe(15);
    expect(config.mapHeight).toBe(13);
  });

  it("onGameStart callback fires when game starts", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector());

    let callbackFired = false;
    let callbackPlayerIds: string[] | undefined;
    room.onGameStart((ids) => {
      callbackFired = true;
      callbackPlayerIds = ids;
    });

    room.handleClientAction("p2", { type: "READY" } as any);
    room.handleClientAction("host-1", { type: "START_GAME" } as any);

    expect(callbackFired).toBe(true);
    expect(callbackPlayerIds).toEqual(["host-1", "p2"]);
  });

  it("onDisbanded callback fires when room empties via handleClose", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    const hostConn = mockConnector();
    room.addPlayer({ id: "host-1", name: "Host" }, hostConn);

    let callbackFired = false;
    room.onDisbanded(() => {
      callbackFired = true;
    });

    room.handleClose("host-1", hostConn);

    expect(callbackFired).toBe(true);
  });
});

describe("BombermanRoom — resumeGame", () => {
  it("resets phase to lobby and unreadies non-hosts", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector());

    // Start game first
    room.handleClientAction("p2", { type: "READY" } as any);
    room.handleClientAction("host-1", { type: "START_GAME" } as any);
    expect(room.getPhase()).toBe("playing");

    // Resume
    room.resumeGame();
    expect(room.getPhase()).toBe("lobby");

    const p2 = room.getState().players.find((p) => p.id === "p2");
    expect(p2?.ready).toBe(false);
    const host = room.getState().players.find((p) => p.id === "host-1");
    expect(host?.ready).toBe(true);
  });
});

describe("BombermanRoom — KICK_PLAYER", () => {
  it("host can kick another player", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector());

    room.handleClientAction("host-1", { type: "KICK_PLAYER", targetId: "p2" } as any);

    const state = room.getState();
    expect(state.players.find((p) => p.id === "p2")).toBeUndefined();
    expect(state.players.length).toBe(1);
  });

  it("non-host cannot kick", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector());

    room.handleClientAction("p2", { type: "KICK_PLAYER", targetId: "host-1" } as any);

    const state = room.getState();
    expect(state.players.find((p) => p.id === "host-1")).toBeDefined();
    expect(state.players.length).toBe(2);
  });

  it("host cannot kick self", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector());

    room.handleClientAction("host-1", { type: "KICK_PLAYER", targetId: "host-1" } as any);

    // Host should still be present (can't kick self)
    const state = room.getState();
    expect(state.players.find((p) => p.id === "host-1")).toBeDefined();
    expect(state.players.length).toBe(2);
  });
});

describe("BombermanRoom — existing player rejoin", () => {
  it("existing player can rejoin with wrong password", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host", "secret");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());
    room.addPlayer({ id: "p2", name: "P2", password: "secret" }, mockConnector());

    // Rejoining with wrong password should still work (existing player)
    const result = room.canJoin("p2", "wrong");
    expect(result.success).toBe(true);
  });

  it("addPlayer updates connector for existing player", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());

    const newConnector = mockConnector();
    const result = room.addPlayer({ id: "host-1", name: "Host" }, newConnector);
    expect(result.success).toBe(true);
  });
});

describe("BombermanRoom — room full rejection", () => {
  it("rejects join when room is full", () => {
    const room = new BombermanRoom("Test", { ...defaultBombermanConfig(), playerLimit: 2 }, "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector());

    const result = room.addPlayer({ id: "p3", name: "P3" }, mockConnector());
    expect(result.success).toBe(false);
    expect((result as { message: string }).message).toBe("Room is full");
  });
});

describe("BombermanRoom — START_GAME edge cases", () => {
  it("non-host cannot start game", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());
    room.addPlayer({ id: "p2", name: "P2" }, mockConnector());

    room.handleClientAction("p2", { type: "START_GAME" } as any);

    expect(room.getState().phase).toBe("lobby");
  });

  it("cannot start game with only one player", () => {
    const room = new BombermanRoom("Test", defaultBombermanConfig(), "host-1", "Host");
    room.addPlayer({ id: "host-1", name: "Host" }, mockConnector());

    room.handleClientAction("host-1", { type: "START_GAME" } as any);

    expect(room.getState().phase).toBe("lobby");
  });
});
