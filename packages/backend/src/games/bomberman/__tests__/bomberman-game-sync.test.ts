import { describe, it, expect } from "vitest";
import { BombermanGame } from "../instance/BombermanGame";
import type { BombermanConfig } from "@generale/types";

/**
 * Minimal config for fast test games — small map, fast ticks, no items.
 * Must meet validator constraints: mapWidth 11-31, mapHeight 11-31, playerLimit 2-4.
 */
const MINIMAL_CONFIG: BombermanConfig = {
  mapWidth: 11,
  mapHeight: 11,
  playerLimit: 4,
  tickRate: 10,
  bombFuse: 3,
  bombLimit: 1,
  blastRadius: 1,
  roundTimeSec: 0,
  shrinkEnabled: false,
  itemDropRate: 0,
  items: [],
};

const TWO_PLAYERS = [
  { id: "p1", name: "P1" },
  { id: "p2", name: "P2" },
];

/** Helper to cast game for private member access */
function pvt(game: BombermanGame) {
  return game as unknown as {
    syncData: Record<string, { lastConfirmedOp: number }>;
    queues: Record<string, unknown[]>;
  };
}

describe("handleAction — confirmedOp tracking", () => {
  it("drops stale event when optimisticId <= lastConfirmedOp", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    // First event with optimisticId=5 → stored, lastConfirmedOp=5
    game.handleAction("p1", { type: "PLACE_BOMB" }, 5);
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(5);

    // Stale event with optimisticId=3 (<=5) → ignored
    game.handleAction("p1", { type: "PLACE_BOMB" }, 3);
    // Queue should still have only the first event
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(5);

    game.destroy();
  });

  it("drops stale SET_DIRECTION when optimisticId <= lastConfirmedOp", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    // Last confirmedOp = 3 from a prior event
    game.handleAction("p1", { type: "PLACE_BOMB" }, 3);
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(3);

    // Stale SET_DIRECTION with id 2 → ignored, NOT added to queue
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "right" }, 2);
    expect(pvt(game).queues["p1"]).toHaveLength(1); // only PLACE_BOMB, SET_DIRECTION was dropped

    game.destroy();
  });

  it("accepts fresh event when optimisticId > lastConfirmedOp", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    game.handleAction("p1", { type: "PLACE_BOMB" }, 1);
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(1);

    // Newer event with id=5 → accepted
    game.handleAction("p1", { type: "PLACE_BOMB" }, 5);
    expect(pvt(game).queues["p1"]).toHaveLength(2);
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(5);

    game.destroy();
  });

  it("accepts fresh SET_DIRECTION and updates confirmedOp", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "down" }, 7);
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).queues["p1"]![0]).toEqual({ type: "SET_DIRECTION", direction: "down" });
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(7);

    game.destroy();
  });

  it("accepts event without optimisticId (backward compat)", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    // No optimisticId — should always be accepted
    game.handleAction("p1", { type: "PLACE_BOMB" });
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    // No optimisticId means no update to confirmedOp
    expect(pvt(game).syncData["p1"]?.lastConfirmedOp).toBe(0); // initialized to 0

    game.destroy();
  });

  it("accepts stale event if no optimisticId even after confirmed events", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    game.handleAction("p1", { type: "PLACE_BOMB" }, 10);
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(10);

    // Event without optimisticId — bypasses stale check
    game.handleAction("p1", { type: "PLACE_BOMB" });
    expect(pvt(game).queues["p1"]).toHaveLength(2);
    // confirmedOp remains 10 since no optimisticId was provided
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(10);

    game.destroy();
  });

  it("maintains per-player isolation for confirmedOp", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);

    game.handleAction("p1", { type: "PLACE_BOMB" }, 5);
    game.handleAction("p2", { type: "PLACE_BOMB" }, 1);

    // p1's stale check independent from p2
    game.handleAction("p1", { type: "PLACE_BOMB" }, 3); // stale for p1
    game.handleAction("p2", { type: "PLACE_BOMB" }, 3); // fresh for p2

    expect(pvt(game).queues["p1"]).toHaveLength(1); // only id=5 accepted
    expect(pvt(game).queues["p2"]).toHaveLength(2); // id=1 and id=3 accepted

    game.destroy();
  });

  it("drops out-of-order event arriving after a higher confirmedOp", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);

    // Events arrive in order 1, 2, 3, 5 → lastConfirmedOp climbs to 5
    game.handleAction("p1", { type: "PLACE_BOMB" }, 1);
    game.handleAction("p1", { type: "PLACE_BOMB" }, 2);
    game.handleAction("p1", { type: "PLACE_BOMB" }, 3);
    game.handleAction("p1", { type: "PLACE_BOMB" }, 5);
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(5);

    // Then stale id=4 arrives late → dropped
    game.handleAction("p1", { type: "PLACE_BOMB" }, 4);
    expect(pvt(game).queues["p1"]).toHaveLength(4);

    // Even stale id=5 (equal, not greater) → dropped
    game.handleAction("p1", { type: "PLACE_BOMB" }, 5);
    expect(pvt(game).queues["p1"]).toHaveLength(4);

    game.destroy();
  });
});

describe("handleAction — SET_DIRECTION goes to queue (discrete model)", () => {
  it('pushes SET_DIRECTION "right" to queue', () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "right" }, 1);
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).queues["p1"]![0]).toEqual({ type: "SET_DIRECTION", direction: "right" });
    game.destroy();
  });

  it('replaces previous SET_DIRECTION when new direction arrives (dedup)', () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "right" }, 1);
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "up" }, 2);
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).queues["p1"]![0]).toEqual({ type: "SET_DIRECTION", direction: "up" });
    game.destroy();
  });

  it("null direction does not push to queue (let pending up process first)", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "up" }, 1);
    game.handleAction("p1", { type: "SET_DIRECTION", direction: null }, 2);
    // Null intent leaves the pending "up" in queue so it still gets processed
    // (guarantees "1 press = 1 tile" even on brief keypresses)
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).queues["p1"]![0]).toEqual({ type: "SET_DIRECTION", direction: "up" });
    game.destroy();
  });

  it("updates confirmedOp for SET_DIRECTION when optimisticId provided", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "down" }, 42);
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(42);
    game.destroy();
  });

  it("per-player isolation for SET_DIRECTION", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "left" }, 1);
    game.handleAction("p2", { type: "SET_DIRECTION", direction: "right" }, 1);
    expect(pvt(game).queues["p1"]![0]).toEqual({ type: "SET_DIRECTION", direction: "left" });
    expect(pvt(game).queues["p2"]![0]).toEqual({ type: "SET_DIRECTION", direction: "right" });
    game.destroy();
  });
});

describe("handleAction — action types push to queue", () => {
  it("PLACE_BOMB pushes to queue and updates confirmedOp", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    game.handleAction("p1", { type: "PLACE_BOMB" }, 10);
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).queues["p1"]![0]).toEqual({ type: "PLACE_BOMB" });
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(10);
    game.destroy();
  });

  it("DETONATE pushes to queue", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    game.handleAction("p1", { type: "DETONATE" }, 2);
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).queues["p1"]![0]).toEqual({ type: "DETONATE" });
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(2);
    game.destroy();
  });

  it("SURRENDER pushes to queue", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    game.handleAction("p1", { type: "SURRENDER" }, 3);
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).queues["p1"]![0]).toEqual({ type: "SURRENDER" });
    game.destroy();
  });

  it("ACTION pushes to queue", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    game.handleAction("p1", { type: "ACTION" }, 4);
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).queues["p1"]![0]).toEqual({ type: "ACTION" });
    game.destroy();
  });

  it("MOVE pushes to queue (non-directional action)", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    game.handleAction("p1", { type: "MOVE", direction: "right" }, 5);
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).queues["p1"]![0]).toEqual({ type: "MOVE", direction: "right" });
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(5);
    game.destroy();
  });

  it("multiple action types accumulate in queue in order", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    game.handleAction("p1", { type: "PLACE_BOMB" }, 1);
    game.handleAction("p1", { type: "DETONATE" }, 2);
    game.handleAction("p1", { type: "SURRENDER" }, 3);
    const q = pvt(game).queues["p1"];
    expect(q).toHaveLength(3);
    expect(q![0]).toEqual({ type: "PLACE_BOMB" });
    expect(q![1]).toEqual({ type: "DETONATE" });
    expect(q![2]).toEqual({ type: "SURRENDER" });
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(3);
    game.destroy();
  });
});

describe("tick — per-player confirmedOp broadcast", () => {
  it("syncData tracks per-player confirmedOp after handleAction calls", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);

    // p1 sends 3 events with increasing optimisticIds
    game.handleAction("p1", { type: "PLACE_BOMB" }, 1);
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "right" }, 2);
    game.handleAction("p1", { type: "PLACE_BOMB" }, 3);

    // p2 sends 1 event
    game.handleAction("p2", { type: "DETONATE" }, 1);

    // Verify syncData state before tick
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(3);
    expect(pvt(game).syncData["p2"].lastConfirmedOp).toBe(1);

    // Verify queues — SET_DIRECTION DOES go to queue in discrete model
    expect(pvt(game).queues["p1"]).toHaveLength(3); // two PLACE_BOMBs + one SET_DIRECTION
    expect(pvt(game).queues["p2"]).toHaveLength(1); // one DETONATE

    game.destroy();
  });

  it("tick processes queue and preserves per-player syncData", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);

    // Place actions in queue for both players
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "right" }, 1);
    game.handleAction("p1", { type: "PLACE_BOMB" }, 2);
    game.handleAction("p2", { type: "SET_DIRECTION", direction: "left" }, 1);

    // Start ticking briefly
    game.startTicking();

    // Wait one tick
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        game.stopTicking();

        const state = game.getState();
        // tick advanced
        expect(state.tick).toBeGreaterThan(0);

        // syncData should be preserved across ticks
        // (tick loop reads syncData but doesn't modify it)
        expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(2);
        expect(pvt(game).syncData["p2"].lastConfirmedOp).toBe(1);

        game.destroy();
        resolve();
      }, 250); // >1 tick at 100ms/tick
    });
  });

  it("stale events are dropped before tick processes actions", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);

    // Valid events
    game.handleAction("p1", { type: "PLACE_BOMB" }, 1);
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "up" }, 2);

    // Stale event (id=1 when lastConfirmedOp=2) → dropped
    game.handleAction("p1", { type: "PLACE_BOMB" }, 1);

    // Queue has PLACE_BOMB (id=1) + SET_DIRECTION (up) = 2 entries
    expect(pvt(game).queues["p1"]).toHaveLength(2);
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(2);

    game.destroy();
  });

  it("handles per-player isolation with stale checks across tick boundary", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);

    // p1 and p2 advance their confirmedOps independently
    game.handleAction("p1", { type: "PLACE_BOMB" }, 10);
    game.handleAction("p2", { type: "PLACE_BOMB" }, 5);

    // Stale for p1 (3 < 10), fresh for p2 (7 > 5)
    game.handleAction("p1", { type: "PLACE_BOMB" }, 3); // dropped
    game.handleAction("p2", { type: "PLACE_BOMB" }, 7); // accepted

    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).queues["p2"]).toHaveLength(2);
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(10);
    expect(pvt(game).syncData["p2"].lastConfirmedOp).toBe(7);

    game.destroy();
  });
});

describe("discrete movement — brief keypress = 1 tile", () => {
  it("pending up is preserved when null keyup arrives before tick", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    // Simulate: user presses W (id=1), releases before next tick (id=2)
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "up" }, 1);
    expect(pvt(game).queues["p1"]).toHaveLength(1);

    // Null keyup arrives — must NOT remove the pending up
    game.handleAction("p1", { type: "SET_DIRECTION", direction: null }, 2);
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).queues["p1"]![0]).toEqual({ type: "SET_DIRECTION", direction: "up" });

    game.destroy();
  });

  it("second non-null direction replaces pending (direction change)", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "up" }, 1);
    // User changes mind: press D before next tick
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "right" }, 2);
    // Only the latest direction is in the queue (up replaced by right)
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).queues["p1"]![0]).toEqual({ type: "SET_DIRECTION", direction: "right" });

    game.destroy();
  });
});

describe("syncData lifecycle — initialization and cleanup", () => {
  it("initializes syncData entry on first handleAction for a player", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    // No syncData before any action
    expect(pvt(game).syncData["p1"]).toBeUndefined();

    game.handleAction("p1", { type: "PLACE_BOMB" }, 1);
    expect(pvt(game).syncData["p1"]).toBeDefined();
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(1);

    game.destroy();
  });

  it("initializes syncData even without optimisticId", () => {
    const game = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    game.handleAction("p1", { type: "PLACE_BOMB" });
    expect(pvt(game).syncData["p1"]).toBeDefined();
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(0);

    game.destroy();
  });

  it("syncData survives destroy and re-create (separate instances)", () => {
    const game1 = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    game1.handleAction("p1", { type: "PLACE_BOMB" }, 99);
    expect(pvt(game1).syncData["p1"].lastConfirmedOp).toBe(99);
    game1.destroy();

    // Fresh instance has no syncData
    const game2 = new BombermanGame(MINIMAL_CONFIG, TWO_PLAYERS);
    expect(pvt(game2).syncData["p1"]).toBeUndefined();
    game2.handleAction("p1", { type: "PLACE_BOMB" }, 1);
    expect(pvt(game2).syncData["p1"].lastConfirmedOp).toBe(1);
    game2.destroy();
  });
});
