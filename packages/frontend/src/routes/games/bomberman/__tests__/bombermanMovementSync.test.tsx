import { describe, it, expect } from "vitest";
import { createRoot } from "solid-js";
import { useVersionedOptimisticState } from "~/hooks/useVersionedOptimisticState";
import { applyBombermanEventLocal } from "../hooks/bombermanGameReducer";
import type { BombermanState, BombermanOperation, BombermanDirection } from "@generale/types";
import { GameStatus, SyncedStateServerStateUpdatePayloadType } from "@generale/types";

// ─── Helpers ───

function makeTiles(width: number, height: number) {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ type: "empty" as const })),
  );
}

function makeState(x: number, y: number, facing: BombermanDirection): BombermanState {
  return {
    status: GameStatus.Playing,
    tick: 0,
    map: { width: 5, height: 5, tiles: makeTiles(5, 5) },
    players: {
      p1: {
        playerId: "p1",
        name: "Alice",
        alive: true,
        x,
        y,
        bombMax: 1,
        bombActive: 0,
        blastRadius: 2,
        speed: 1,
        items: [],
        facing,
      },
    },
    bombs: [],
    explosions: [],
    items: [],
    config: {
      mapWidth: 5,
      mapHeight: 5,
      playerLimit: 2,
      tickRate: 4,
      bombFuse: 3,
      bombLimit: 1,
      blastRadius: 2,
      roundTimeSec: 0,
      shrinkEnabled: false,
      itemDropRate: 0.6,
      items: [],
    },
  };
}

// The hook requires E with a required readonly optimisticId.
// BombermanOperation uses optional optimisticId, so we intersect to satisfy the constraint.
type TestOp = BombermanOperation & { readonly optimisticId: number };

/** Named interface matching the shape useVersionedOptimisticState returns. */
interface SyncStateHandle {
  mergedState(): BombermanState;
  getPendingEvents(): TestOp[];
  dispatchOptimisticEvent(event: Omit<TestOp, "optimisticId">): number;
  reconcileFromServer(payload: {
    type: string;
    version: number;
    confirmedOp: number;
    payload: BombermanState;
  }): void;
}

describe("useVersionedOptimisticState + applyBombermanEventLocal (SET_DIRECTION)", () => {
  it("optimistic SET_DIRECTION changes facing only; coordinate stays at authoritative start", () => {
    let state!: SyncStateHandle;
    createRoot(() => {
      state = useVersionedOptimisticState<BombermanState, TestOp>(
        makeState(3, 3, "down"),
        0,
        (s, op) => applyBombermanEventLocal(s, op, "p1"),
      );
    });

    state.dispatchOptimisticEvent({ type: "SET_DIRECTION", direction: "right" });

    expect(state.mergedState().players.p1!.facing).toBe("right");
    expect(state.mergedState().players.p1!.x).toBe(3);
    expect(state.mergedState().players.p1!.y).toBe(3);
  });

  it("matching-confirmed snapshot one right tile later empties pending queue and shows exactly server coordinate", () => {
    let state!: SyncStateHandle;
    createRoot(() => {
      state = useVersionedOptimisticState<BombermanState, TestOp>(
        makeState(3, 3, "down"),
        0,
        (s, op) => applyBombermanEventLocal(s, op, "p1"),
      );
    });

    const opId = state.dispatchOptimisticEvent({ type: "SET_DIRECTION", direction: "right" });

    // Pending queue has the optimistic event
    expect(state.getPendingEvents()).toHaveLength(1);
    // mergedState reflects the optimistic facing change
    expect(state.mergedState().players.p1!.facing).toBe("right");
    // Coordinate still authoritative
    expect(state.mergedState().players.p1!.x).toBe(3);

    // Server confirms movement: player moved one tile right, matched by confirmedOp
    const serverState = makeState(4, 3, "right");
    state.reconcileFromServer({
      type: SyncedStateServerStateUpdatePayloadType.SNAPSHOT,
      version: 1,
      confirmedOp: opId,
      payload: serverState,
    });

    // Pending queue emptied — optimistic event confirmed
    expect(state.getPendingEvents()).toHaveLength(0);
    // mergedState equals server state exactly: no double move, no rollback
    expect(state.mergedState().players.p1!.x).toBe(4);
    expect(state.mergedState().players.p1!.y).toBe(3);
    expect(state.mergedState().players.p1!.facing).toBe("right");
  });
});
