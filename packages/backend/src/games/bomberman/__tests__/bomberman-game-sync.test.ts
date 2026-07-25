import { describe, it, expect, vi } from "vitest";
import { BombermanGame } from "../instance/BombermanGame";
import { type BombermanConfig, type TeamId } from "@generale/types";
import { Mulberry32, generateBombermanMap } from "@generale/bomberman-engine";
import type { BombermanGameOptions } from "@generale/bomberman-engine";

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

/** 4 players — p1 gets third spawn (bottom-left corner at (1,9)) for open up and right movement */
const FOUR_WITH_P1_BOTTOM = [
  { id: "x1", name: "X1" },
  { id: "x2", name: "X2" },
  { id: "p1", name: "P1" },
  { id: "p2", name: "P2" },
];

function makeOptions(players: { id: string; name: string }[]): BombermanGameOptions {
  const rng = new Mulberry32(42);
  const map = generateBombermanMap({
    width: MINIMAL_CONFIG.mapWidth,
    height: MINIMAL_CONFIG.mapHeight,
    themeId: "classic",
    softWallDensity: 0,
    random: rng,
  });
  return {
    config: MINIMAL_CONFIG,
    seed: 42,
    map,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      teamId: "team1" as TeamId,
      isBot: false,
      skinId: "classic-blue",
    })),
  };
}

/** Helper to cast game for private member access */
function pvt(game: BombermanGame) {
  return game as unknown as {
    syncData: Record<string, { lastConfirmedOp: number }>;
    queues: Record<string, unknown[]>;
    intents: Record<string, { activeDirection: string | null; pendingDirection: string | null }>;
    state: { players: Record<string, { speed: number }> };
  };
}

describe("handleAction — confirmedOp tracking", () => {
  it("drops stale event when optimisticId <= lastConfirmedOp", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));
    // First event with optimisticId=5 → stored, lastConfirmedOp=5
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 5 });
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(5);

    // Stale event with optimisticId=3 (<=5) → ignored
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 3 });
    // Queue should still have only the first event
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(5);

    game.destroy();
  });

  it("drops stale SET_DIRECTION when optimisticId <= lastConfirmedOp", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));
    // Last confirmedOp = 3 from a prior event
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 3 });
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(3);

    // Stale SET_DIRECTION with id 2 → ignored before intent mutation
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "right", optimisticId: 2 });
    expect(pvt(game).queues["p1"]).toHaveLength(1); // only PLACE_BOMB, SET_DIRECTION was dropped
    // Intents remain null because stale rejection happens before intent mutation
    expect(pvt(game).intents["p1"].activeDirection).toBeNull();
    expect(pvt(game).intents["p1"].pendingDirection).toBeNull();

    game.destroy();
  });

  it("accepts fresh event when optimisticId > lastConfirmedOp", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 1 });
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(1);

    // Newer event with id=5 → accepted
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 5 });
    expect(pvt(game).queues["p1"]).toHaveLength(2);
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(5);

    game.destroy();
  });

  it("accepts fresh SET_DIRECTION and updates confirmedOp", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "down", optimisticId: 7 });
    // SET_DIRECTION sets intents, does NOT enter queue
    expect(pvt(game).queues["p1"]).toHaveLength(0);
    expect(pvt(game).intents["p1"].activeDirection).toBe("down");
    expect(pvt(game).intents["p1"].pendingDirection).toBe("down");
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(7);

    game.destroy();
  });

  it("accepts event without optimisticId (backward compat)", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));
    // No optimisticId — should always be accepted
    game.handleAction("p1", { type: "PLACE_BOMB" });
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    // No optimisticId means no update to confirmedOp
    expect(pvt(game).syncData["p1"]?.lastConfirmedOp).toBe(0); // initialized to 0

    game.destroy();
  });

  it("accepts stale event if no optimisticId even after confirmed events", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 10 });
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(10);

    // Event without optimisticId — bypasses stale check
    game.handleAction("p1", { type: "PLACE_BOMB" });
    expect(pvt(game).queues["p1"]).toHaveLength(2);
    // confirmedOp remains 10 since no optimisticId was provided
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(10);

    game.destroy();
  });

  it("maintains per-player isolation for confirmedOp", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));

    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 5 });
    game.handleAction("p2", { type: "PLACE_BOMB", optimisticId: 1 });

    // p1's stale check independent from p2
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 3 }); // stale for p1
    game.handleAction("p2", { type: "PLACE_BOMB", optimisticId: 3 }); // fresh for p2

    expect(pvt(game).queues["p1"]).toHaveLength(1); // only id=5 accepted
    expect(pvt(game).queues["p2"]).toHaveLength(2); // id=1 and id=3 accepted

    game.destroy();
  });

  it("drops out-of-order event arriving after a higher confirmedOp", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));

    // Events arrive in order 1, 2, 3, 5 → lastConfirmedOp climbs to 5
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 1 });
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 2 });
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 3 });
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 5 });
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(5);

    // Then stale id=4 arrives late → dropped
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 4 });
    expect(pvt(game).queues["p1"]).toHaveLength(4);

    // Even stale id=5 (equal, not greater) → dropped
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 5 });
    expect(pvt(game).queues["p1"]).toHaveLength(4);

    game.destroy();
  });
});

describe("handleAction — SET_DIRECTION sets movement intents", () => {
  it("sets activeDirection and pendingDirection, does not add to queue", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "right", optimisticId: 1 });
    expect(pvt(game).intents["p1"].activeDirection).toBe("right");
    expect(pvt(game).intents["p1"].pendingDirection).toBe("right");
    expect(pvt(game).queues["p1"]).toHaveLength(0);
    game.destroy();
  });

  it("second non-null direction replaces pending (latest press wins)", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "right", optimisticId: 1 });
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "up", optimisticId: 2 });
    expect(pvt(game).intents["p1"].activeDirection).toBe("up");
    expect(pvt(game).intents["p1"].pendingDirection).toBe("up");
    expect(pvt(game).queues["p1"]).toHaveLength(0);
    game.destroy();
  });

  it("null only clears active, preserves pending", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "up", optimisticId: 1 });
    game.handleAction("p1", { type: "SET_DIRECTION", direction: null, optimisticId: 2 });
    expect(pvt(game).intents["p1"].activeDirection).toBeNull();
    expect(pvt(game).intents["p1"].pendingDirection).toBe("up");
    game.destroy();
  });

  it("updates confirmedOp when optimisticId provided", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "down", optimisticId: 42 });
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(42);
    game.destroy();
  });

  it("per-player isolation for intents", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "left", optimisticId: 1 });
    game.handleAction("p2", { type: "SET_DIRECTION", direction: "right", optimisticId: 1 });
    expect(pvt(game).intents["p1"].activeDirection).toBe("left");
    expect(pvt(game).intents["p2"].activeDirection).toBe("right");
    expect(pvt(game).queues["p1"]).toHaveLength(0);
    expect(pvt(game).queues["p2"]).toHaveLength(0);
    game.destroy();
  });
});

describe("handleAction — action types push to queue", () => {
  it("PLACE_BOMB pushes to queue and updates confirmedOp", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 10 });
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).queues["p1"]![0]).toEqual({ type: "PLACE_BOMB", optimisticId: 10 });
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(10);
    game.destroy();
  });

  it("DETONATE pushes to queue", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));
    game.handleAction("p1", { type: "DETONATE", optimisticId: 2 });
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).queues["p1"]![0]).toEqual({ type: "DETONATE", optimisticId: 2 });
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(2);
    game.destroy();
  });

  it("SURRENDER pushes to queue", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));
    game.handleAction("p1", { type: "SURRENDER", optimisticId: 3 });
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).queues["p1"]![0]).toEqual({ type: "SURRENDER", optimisticId: 3 });
    game.destroy();
  });

  it("ACTION pushes to queue", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));
    game.handleAction("p1", { type: "ACTION", optimisticId: 4 });
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).queues["p1"]![0]).toEqual({ type: "ACTION", optimisticId: 4 });
    game.destroy();
  });

  it("MOVE pushes to queue (non-directional action)", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));
    game.handleAction("p1", { type: "MOVE", direction: "right", optimisticId: 5 });
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).queues["p1"]![0]).toEqual({ type: "MOVE", direction: "right", optimisticId: 5 });
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(5);
    game.destroy();
  });

  it("multiple action types accumulate in queue in order", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 1 });
    game.handleAction("p1", { type: "DETONATE", optimisticId: 2 });
    game.handleAction("p1", { type: "SURRENDER", optimisticId: 3 });
    const q = pvt(game).queues["p1"];
    expect(q).toHaveLength(3);
    expect(q![0]).toEqual({ type: "PLACE_BOMB", optimisticId: 1 });
    expect(q![1]).toEqual({ type: "DETONATE", optimisticId: 2 });
    expect(q![2]).toEqual({ type: "SURRENDER", optimisticId: 3 });
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(3);
    game.destroy();
  });
});

describe("tick — per-player confirmedOp broadcast", () => {
  it("syncData tracks per-player confirmedOp after handleAction calls", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));

    // p1 sends 3 events with increasing optimisticIds
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 1 });
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "right", optimisticId: 2 });
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 3 });

    // p2 sends 1 event
    game.handleAction("p2", { type: "DETONATE", optimisticId: 1 });

    // Verify syncData state before tick
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(3);
    expect(pvt(game).syncData["p2"].lastConfirmedOp).toBe(1);

    // Verify queues — SET_DIRECTION does NOT go to queue (goes to intents)
    expect(pvt(game).queues["p1"]).toHaveLength(2); // two PLACE_BOMBs only
    expect(pvt(game).queues["p2"]).toHaveLength(1); // one DETONATE
    expect(pvt(game).intents["p1"].activeDirection).toBe("right");
    expect(pvt(game).intents["p1"].pendingDirection).toBe("right");

    game.destroy();
  });

  it("tick processes queue and preserves per-player syncData", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));

    // Place actions in queue for both players
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "right", optimisticId: 1 });
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 2 });
    game.handleAction("p2", { type: "SET_DIRECTION", direction: "left", optimisticId: 1 });

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
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));

    // Valid events
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 1 });
    game.handleAction("p1", { type: "SET_DIRECTION", direction: "up", optimisticId: 2 });

    // Stale event (id=1 when lastConfirmedOp=2) → dropped
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 1 });

    // Queue has only PLACE_BOMB (id=1) — SET_DIRECTION goes to intents
    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(2);

    game.destroy();
  });

  it("handles per-player isolation with stale checks across tick boundary", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));

    // p1 and p2 advance their confirmedOps independently
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 10 });
    game.handleAction("p2", { type: "PLACE_BOMB", optimisticId: 5 });

    // Stale for p1 (3 < 10), fresh for p2 (7 > 5)
    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 3 }); // dropped
    game.handleAction("p2", { type: "PLACE_BOMB", optimisticId: 7 }); // accepted

    expect(pvt(game).queues["p1"]).toHaveLength(1);
    expect(pvt(game).queues["p2"]).toHaveLength(2);
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(10);
    expect(pvt(game).syncData["p2"].lastConfirmedOp).toBe(7);

    game.destroy();
  });
});

describe("movement intent materialization", () => {
  it("tap right optimistic IDs 1 then null 2 before tick: after tick x +1/y unchanged, confirmed ID 2, both intents null, then stationary", () => {
    vi.useFakeTimers();
    let game: BombermanGame | undefined;
    try {
      game = new BombermanGame(makeOptions(FOUR_WITH_P1_BOTTOM));
      const startX = game.getState().players["p1"].x;
      const startY = game.getState().players["p1"].y;

      game.handleAction("p1", { type: "SET_DIRECTION", direction: "right", optimisticId: 1 });
      game.handleAction("p1", { type: "SET_DIRECTION", direction: null, optimisticId: 2 });

      game.startTicking();
      vi.advanceTimersByTime(100);

      expect(game.getState().players["p1"].x).toBe(startX + 1);
      expect(game.getState().players["p1"].y).toBe(startY);
      expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(2);
      expect(pvt(game).intents["p1"].activeDirection).toBeNull();
      expect(pvt(game).intents["p1"].pendingDirection).toBeNull();

      // Three additional ticks: coordinate unchanged (stopped after release)
      vi.advanceTimersByTime(300);
      expect(game.getState().players["p1"].x).toBe(startX + 1);
      expect(game.getState().players["p1"].y).toBe(startY);
    } finally {
      game?.destroy();
      vi.useRealTimers();
    }
  });

  it("hold right: first tick x+1, speed=2 makes second tick +2, release stops further movement", () => {
    vi.useFakeTimers();
    let game: BombermanGame | undefined;
    try {
      game = new BombermanGame(makeOptions(FOUR_WITH_P1_BOTTOM));
      const startX = game.getState().players["p1"].x;
      const startY = game.getState().players["p1"].y;

      game.handleAction("p1", { type: "SET_DIRECTION", direction: "right", optimisticId: 1 });

      game.startTicking();
      vi.advanceTimersByTime(100);

      expect(game.getState().players["p1"].x).toBe(startX + 1);
      expect(game.getState().players["p1"].y).toBe(startY);

      // Override speed via private test accessor
      pvt(game).state.players["p1"].speed = 2;

      vi.advanceTimersByTime(100);

      expect(game.getState().players["p1"].x).toBe(startX + 3); // 1 + 2 = 3
      expect(game.getState().players["p1"].y).toBe(startY);

      // Release before next tick
      game.handleAction("p1", { type: "SET_DIRECTION", direction: null, optimisticId: 2 });

      vi.advanceTimersByTime(300); // 3 ticks, no movement
      expect(game.getState().players["p1"].x).toBe(startX + 3);
      expect(game.getState().players["p1"].y).toBe(startY);
    } finally {
      game?.destroy();
      vi.useRealTimers();
    }
  });

  it("right one tick, then up + null: second tick y -1/x unchanged, later stationary, right does not resume", () => {
    vi.useFakeTimers();
    let game: BombermanGame | undefined;
    try {
      game = new BombermanGame(makeOptions(FOUR_WITH_P1_BOTTOM));
      // Clear pillar at (2,8) — right move targets (2,9), then up targets (2,8);
      // without this the up move would collide with the hard-wall pillar at (even, even).
      game.getState().map.tiles[8][2] = { type: "empty" };
      const startX = game.getState().players["p1"].x;
      const startY = game.getState().players["p1"].y;

      game.handleAction("p1", { type: "SET_DIRECTION", direction: "right", optimisticId: 1 });

      game.startTicking();
      vi.advanceTimersByTime(100);

      expect(game.getState().players["p1"].x).toBe(startX + 1);
      expect(game.getState().players["p1"].y).toBe(startY);

      // Change to up then release
      game.handleAction("p1", { type: "SET_DIRECTION", direction: "up", optimisticId: 2 });
      game.handleAction("p1", { type: "SET_DIRECTION", direction: null, optimisticId: 3 });

      vi.advanceTimersByTime(100);

      expect(game.getState().players["p1"].x).toBe(startX + 1);
      expect(game.getState().players["p1"].y).toBe(startY - 1);

      // Later ticks: stationary, right never resumes
      vi.advanceTimersByTime(300);
      expect(game.getState().players["p1"].x).toBe(startX + 1);
      expect(game.getState().players["p1"].y).toBe(startY - 1);
      expect(pvt(game).intents["p1"].activeDirection).toBeNull();
      expect(pvt(game).intents["p1"].pendingDirection).toBeNull();
    } finally {
      game?.destroy();
      vi.useRealTimers();
    }
  });

  it("right + null + up before first tick: only up segment commits, x unchanged/y -1, later stationary", () => {
    vi.useFakeTimers();
    let game: BombermanGame | undefined;
    try {
      game = new BombermanGame(makeOptions(FOUR_WITH_P1_BOTTOM));
      const startX = game.getState().players["p1"].x;
      const startY = game.getState().players["p1"].y;

      // right, release, up — all before first tick
      game.handleAction("p1", { type: "SET_DIRECTION", direction: "right", optimisticId: 1 });
      game.handleAction("p1", { type: "SET_DIRECTION", direction: null, optimisticId: 2 });
      game.handleAction("p1", { type: "SET_DIRECTION", direction: "up", optimisticId: 3 });

      game.startTicking();
      vi.advanceTimersByTime(100);

      // Only up moved exactly one tile from pending; right never did
      expect(game.getState().players["p1"].y).toBe(startY - 1);
      expect(game.getState().players["p1"].x).toBe(startX);

      // Release the held up so subsequent ticks are stationary
      game.handleAction("p1", { type: "SET_DIRECTION", direction: null, optimisticId: 4 });

      // Later ticks stationary (up also consumed via max(1,speed) from held active)
      vi.advanceTimersByTime(300);
      expect(game.getState().players["p1"].y).toBe(startY - 1);
      expect(game.getState().players["p1"].x).toBe(startX);
    } finally {
      game?.destroy();
      vi.useRealTimers();
    }
  });
});

describe("syncData lifecycle — initialization and cleanup", () => {
  it("initializes syncData entry on first handleAction for a player", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));
    // No syncData before any action
    expect(pvt(game).syncData["p1"]).toBeUndefined();

    game.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 1 });
    expect(pvt(game).syncData["p1"]).toBeDefined();
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(1);

    game.destroy();
  });

  it("initializes syncData even without optimisticId", () => {
    const game = new BombermanGame(makeOptions(TWO_PLAYERS));
    game.handleAction("p1", { type: "PLACE_BOMB" });
    expect(pvt(game).syncData["p1"]).toBeDefined();
    expect(pvt(game).syncData["p1"].lastConfirmedOp).toBe(0);

    game.destroy();
  });

  it("syncData survives destroy and re-create (separate instances)", () => {
    const game1 = new BombermanGame(makeOptions(TWO_PLAYERS));
    game1.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 99 });
    expect(pvt(game1).syncData["p1"].lastConfirmedOp).toBe(99);
    game1.destroy();

    // Fresh instance has no syncData
    const game2 = new BombermanGame(makeOptions(TWO_PLAYERS));
    expect(pvt(game2).syncData["p1"]).toBeUndefined();
    game2.handleAction("p1", { type: "PLACE_BOMB", optimisticId: 1 });
    expect(pvt(game2).syncData["p1"].lastConfirmedOp).toBe(1);
    game2.destroy();
  });
});
