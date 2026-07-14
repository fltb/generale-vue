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
