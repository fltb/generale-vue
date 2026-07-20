import { describe, it, expect } from "vitest";
import { applyBombermanEventLocal } from "../hooks/bombermanGameReducer";
import type { BombermanState } from "@generale/types";
import { GameStatus } from "@generale/types";

function makeBaseState(): BombermanState {
  return {
    status: GameStatus.Playing,
    tick: 0,
    map: {
      width: 5,
      height: 5,
      tiles: Array.from({ length: 5 }, () =>
        Array.from({ length: 5 }, () => ({ type: "empty" as const })),
      ),
    },
    players: {
      p1: {
        playerId: "p1", name: "Alice", alive: true, x: 1, y: 1,
        bombMax: 1, bombActive: 0, blastRadius: 2, speed: 1,
        items: [], facing: "down",
      },
    },
    bombs: [],
    explosions: [],
    items: [],
    config: {
      mapWidth: 5, mapHeight: 5, playerLimit: 2, tickRate: 4,
      bombFuse: 3, bombLimit: 1, blastRadius: 2, roundTimeSec: 0,
      shrinkEnabled: false, itemDropRate: 0.6, items: [],
    },
  };
}

describe("applyBombermanEventLocal — PLACE_BOMB", () => {
  it("places a bomb at player position", () => {
    const state = makeBaseState();
    const result = applyBombermanEventLocal(state, { type: "PLACE_BOMB" }, "p1");
    expect(result.bombs).toHaveLength(1);
    expect(result.bombs[0]!.x).toBe(1);
    expect(result.bombs[0]!.y).toBe(1);
    expect(result.players.p1!.bombActive).toBe(1);
  });

  it("prevents double bomb at same position (same-tile dedup)", () => {
    const state = makeBaseState();
    state.players.p1!.bombMax = 2;
    // First PLACE_BOMB: should succeed
    const r1 = applyBombermanEventLocal(state, { type: "PLACE_BOMB" }, "p1");
    expect(r1.bombs).toHaveLength(1);
    // Second PLACE_BOMB at same position: should be blocked by hasBombHere
    const r2 = applyBombermanEventLocal(r1, { type: "PLACE_BOMB" }, "p1");
    expect(r2.bombs).toHaveLength(1);
    expect(r2.players.p1!.bombActive).toBe(1);
  });

  it("prevents double bomb when bombActive already at limit", () => {
    const state = makeBaseState();
    state.players.p1!.bombMax = 1;
    state.players.p1!.bombActive = 1;
    const result = applyBombermanEventLocal(state, { type: "PLACE_BOMB" }, "p1");
    expect(result.bombs).toHaveLength(0);
  });

  it("allows second bomb at different position (with bombMax=2)", () => {
    const state = makeBaseState();
    state.players.p1!.bombMax = 2;
    // First bomb
    const r1 = applyBombermanEventLocal(state, { type: "PLACE_BOMB" }, "p1");
    expect(r1.bombs).toHaveLength(1);
    // Move player
    r1.players.p1!.x = 2;
    // Second bomb at new position
    const r2 = applyBombermanEventLocal(r1, { type: "PLACE_BOMB" }, "p1");
    expect(r2.bombs).toHaveLength(2);
    expect(r2.players.p1!.bombActive).toBe(2);
  });

  // CORNER CASES: optimistic re-application (useVersionedOptimisticState)
  // These test the ACTUAL double-bomb bug:
  //   useVersionedOptimisticState re-applies all pending events from
  //   structuredClone(base) on every server reconciliation. If the player
  //   moved between ticks, hasBombHere checks the NEW position and finds
  //   no bomb → creates a duplicate.

  it("does NOT duplicate PLACE_BOMB when re-applied at a different player position (idempotency)", () => {
    const state = makeBaseState();
    state.players.p1!.bombMax = 2;

    // First application: player at (1,1), place bomb
    const r1 = applyBombermanEventLocal(state, { type: "PLACE_BOMB", optimisticId: 101 }, "p1");
    expect(r1.bombs).toHaveLength(1);
    expect(r1.bombs[0]!.x).toBe(1);
    expect(r1.bombs[0]!.y).toBe(1);

    // Simulate: server state arrives where player moved but bomb wasn't confirmed.
    // This is the useVersionedOptimisticState re-apply: fresh base state, same event.
    const serverState = makeBaseState();
    serverState.players.p1!.x = 5; // player moved 4 tiles right
    serverState.players.p1!.y = 1;
    serverState.players.p1!.bombMax = 2;
    // Server has NO bombs (hasn't confirmed ours yet)

    // Re-apply the SAME optimistic event to the fresh server state
    const r2 = applyBombermanEventLocal(serverState, { type: "PLACE_BOMB", optimisticId: 101 }, "p1");
    // Should NOT create a second bomb — this exact event already placed one
    expect(r2.bombs).toHaveLength(0);
    expect(r2.players.p1!.bombActive).toBe(0);
  });

  it("does NOT duplicate PLACE_BOMB across multiple re-applications", () => {
    const state = makeBaseState();
    state.players.p1!.bombMax = 3;

    // First application
    const r1 = applyBombermanEventLocal(state, { type: "PLACE_BOMB", optimisticId: 201 }, "p1");
    expect(r1.bombs).toHaveLength(1);
    expect(r1.players.p1!.bombActive).toBe(1);

    // Re-apply at position (3,2)
    const server1 = makeBaseState();
    server1.players.p1!.x = 3; server1.players.p1!.y = 2;
    server1.players.p1!.bombMax = 3;
    const r2 = applyBombermanEventLocal(server1, { type: "PLACE_BOMB", optimisticId: 201 }, "p1");
    expect(r2.bombs).toHaveLength(0);

    // Re-apply again at position (7,4)
    const server2 = makeBaseState();
    server2.players.p1!.x = 7; server2.players.p1!.y = 4;
    server2.players.p1!.bombMax = 3;
    const r3 = applyBombermanEventLocal(server2, { type: "PLACE_BOMB", optimisticId: 201 }, "p1");
    expect(r3.bombs).toHaveLength(0);

    // A DIFFERENT second bomb (different optimisticId, different position) SHOULD work
    const r4 = applyBombermanEventLocal(server2, { type: "PLACE_BOMB", optimisticId: 202 }, "p1");
    expect(r4.bombs).toHaveLength(1);
    expect(r4.bombs[0]!.x).toBe(7);
    expect(r4.bombs[0]!.y).toBe(4);
    expect(r4.players.p1!.bombActive).toBe(1);
  });

  it("different optimisticIds produce different bombs (not falsely deduped)", () => {
    const state = makeBaseState();
    state.players.p1!.bombMax = 3;

    // First bomb at (1,1)
    const r1 = applyBombermanEventLocal(state, { type: "PLACE_BOMB", optimisticId: 301 }, "p1");
    expect(r1.bombs).toHaveLength(1);

    // Move player to (2,1) directly (SET_DIRECTION no longer changes x/y)
    r1.players.p1!.x = 2;
    const r2 = applyBombermanEventLocal(r1, { type: "PLACE_BOMB", optimisticId: 302 }, "p1");
    expect(r2.bombs).toHaveLength(2);

    // Move player to (3,1) directly
    r2.players.p1!.x = 3;
    const r3 = applyBombermanEventLocal(r2, { type: "PLACE_BOMB", optimisticId: 303 }, "p1");
    expect(r3.bombs).toHaveLength(3);
  });
});

describe("applyBombermanEventLocal — SET_DIRECTION (facing only)", () => {
  it("non-null direction changes facing without changing x or y", () => {
    const state = makeBaseState();
    const r = applyBombermanEventLocal(state, { type: "SET_DIRECTION", direction: "right" }, "p1");
    expect(r.players.p1!.facing).toBe("right");
    expect(r.players.p1!.x).toBe(1);
    expect(r.players.p1!.y).toBe(1);
  });

  it("null direction changes neither facing nor coordinates", () => {
    const state = makeBaseState();
    const r = applyBombermanEventLocal(state, { type: "SET_DIRECTION", direction: null }, "p1");
    expect(r.players.p1!.facing).toBe("down");
    expect(r.players.p1!.x).toBe(1);
    expect(r.players.p1!.y).toBe(1);
  });
});
