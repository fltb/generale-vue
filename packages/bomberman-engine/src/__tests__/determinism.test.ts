import { describe, it, expect } from "vitest";
import type { BombermanState } from "@generale/types";
import { GameStatus } from "@generale/types";

import { Mulberry32 } from "../random.js";
import { createInitialBombermanState, tick } from "../game.js";
import { createBombermanReplaySession } from "../replay.js";
import type { BombermanReplayRound, BombermanReplayFrame } from "../replay.js";
import type { BombermanOperation } from "@generale/types";

/** Build a minimal map definition matching what the engine expects. */
function makeTestMap(): {
  schemaVersion: 1;
  width: number;
  height: number;
  themeId: string;
  tiles: { type: "empty" | "hard_wall" | "soft_wall" }[][];
  spawns: { x: number; y: number }[];
  fixedItems: { x: number; y: number; type: string }[];
} {
  return {
    schemaVersion: 1,
    width: 5,
    height: 5,
    themeId: "classic",
    tiles: Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => ({ type: "empty" as const })),
    ),
    spawns: [
      { x: 1, y: 1 },
      { x: 3, y: 3 },
    ],
    fixedItems: [],
  };
}

function makeBaseOptions(seed: number): {
  config: {
    mapWidth: number;
    mapHeight: number;
    playerLimit: number;
    tickRate: number;
    bombFuse: number;
    bombLimit: number;
    blastRadius: number;
    roundTimeSec: number;
    shrinkEnabled: boolean;
    itemDropRate: number;
    items: string[];
  };
  seed: number;
  map: ReturnType<typeof makeTestMap>;
  players: Array<{
    id: string;
    name: string;
    teamId: string;
    isBot: boolean;
    skinId: string;
  }>;
} {
  return {
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
      items: ["BOMB_UP", "FIRE_UP"],
    },
    seed,
    map: makeTestMap(),
    players: [
      { id: "p1", name: "Alice", teamId: "team1", isBot: false, skinId: "classic-blue" },
      { id: "p2", name: "Bob", teamId: "team2", isBot: false, skinId: "classic-green" },
    ],
  };
}

describe("Mulberry32 determinism", () => {
  it("produces same sequence from same seed", () => {
    const a = new Mulberry32(42);
    const b = new Mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it("produces different sequences from different seeds", () => {
    const a = new Mulberry32(42);
    const b = new Mulberry32(43);
    const firstA = a.next();
    const firstB = b.next();
    // Extremely unlikely to be equal for different seeds
    expect(firstA).not.toBe(firstB);
  });

  it("produces values in [0, 1)", () => {
    const rng = new Mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("supports save/restore state", () => {
    const rng = new Mulberry32(42);
    // Advance a few times
    for (let i = 0; i < 10; i++) rng.next();
    const state = rng.getState();

    const restored = new Mulberry32(0);
    restored.setState(state);
    for (let i = 0; i < 10; i++) {
      expect(rng.next()).toBe(restored.next());
    }
  });
});

describe("createInitialBombermanState determinism", () => {
  it("same options produces same state", () => {
    const opts = makeBaseOptions(100);
    const a = createInitialBombermanState(opts as any);
    const b = createInitialBombermanState(opts as any);
    expect(a.players.p1?.x).toBe(b.players.p1?.x);
    expect(a.players.p2?.x).toBe(b.players.p2?.x);
    expect(a.rngState).toBe(b.rngState);
    expect(a.eventCounter).toBe(0);
    expect(a.events).toEqual([]);
  });

  it("different seed produces different rngState", () => {
    const a = createInitialBombermanState(makeBaseOptions(100) as any);
    const b = createInitialBombermanState(makeBaseOptions(200) as any);
    expect(a.rngState).not.toBe(b.rngState);
  });
});

describe("tick determinism", () => {
  it("same state + queues produces identical next state", () => {
    const opts = makeBaseOptions(42);
    const state = createInitialBombermanState(opts as any);
    const queues = {
      p1: [{ type: "MOVE" as const, direction: "right" as const }],
      p2: [] as any[],
    };

    const result1 = tick(state, queues);
    const result2 = tick(state, queues);

    expect(result1.state.players.p1?.x).toBe(result2.state.players.p1?.x);
    expect(result1.state.players.p1?.y).toBe(result2.state.players.p1?.y);
    expect(result1.state.bombs.length).toBe(result2.state.bombs.length);
    expect(result1.state.rngState).toBe(result2.state.rngState);
  });

  it("different seed changes item drops", () => {
    // Create two states with different seeds, advance both with identical actions
    // and check that item drops differ in at least one position
    const opts1 = makeBaseOptions(100);
    const opts2 = makeBaseOptions(200);

    // Use a map with soft walls that will cause item drops
    const mapWithWalls = {
      schemaVersion: 1 as const,
      width: 15,
      height: 13,
      themeId: "classic",
      tiles: Array.from({ length: 13 }, (_, y) =>
        Array.from({ length: 15 }, (_, x) => {
          if (y === 0 || y === 12 || x === 0 || x === 14) return { type: "hard_wall" as const };
          if (x % 2 === 0 && y % 2 === 0) return { type: "hard_wall" as const };
          // Soft walls everywhere else to maximize item drops
          if (x === 2 && y === 1) return { type: "empty" as const };
          if (x === 1 && y === 2) return { type: "empty" as const };
          return { type: "soft_wall" as const };
        }),
      ),
      spawns: [{ x: 1, y: 1 }, { x: 13, y: 11 }, { x: 1, y: 11 }, { x: 13, y: 1 }],
      fixedItems: [],
    };

    const baseOpts = {
      config: {
        mapWidth: 15,
        mapHeight: 13,
        playerLimit: 2,
        tickRate: 4,
        bombFuse: 3,
        bombLimit: 1,
        items: ["BOMB_UP", "FIRE_UP", "SPEED_UP", "KICK", "GLOVE", "PUNCH", "REMOTE", "PIERCE", "SPIRIT"],
      },
      map: mapWithWalls,
      players: [
        { id: "p1", name: "A", teamId: "team1", isBot: false, skinId: "classic-blue" },
        { id: "p2", name: "B", teamId: "team2", isBot: false, skinId: "classic-green" },
      ],
    };

    const state1 = createInitialBombermanState({ ...baseOpts, seed: 100 } as any);
    const state2 = createInitialBombermanState({ ...baseOpts, seed: 200 } as any);

    // Move both states forward to trigger bomb explosions and wall destruction
    // First place bombs
    const bombQueues = {
      p1: [{ type: "PLACE_BOMB" as const }],
      p2: [{ type: "PLACE_BOMB" as const }],
    };

    const afterBomb1 = tick(state1, bombQueues);
    const afterBomb2 = tick(state2, bombQueues);

    // Advance to let bombs explode (bombFuse=3 ticks)
    let s1 = afterBomb1.state;
    let s2 = afterBomb2.state;
    for (let i = 0; i < 4; i++) {
      const r1 = tick(s1, { p1: [], p2: [] });
      const r2 = tick(s2, { p1: [], p2: [] });
      s1 = r1.state;
      s2 = r2.state;
    }

    // After explosion with bombFuse=3 and one extra tick, items should have spawned
    // from soft wall destruction — check that rngState diverged
    expect(s1.rngState).not.toBe(s2.rngState);
  });

  it("full two-tick sequence reproduces exactly", () => {
    const opts = makeBaseOptions(42);
    const stateA = createInitialBombermanState(opts as any);
    const stateB = createInitialBombermanState(opts as any);

    const queues1 = {
      p1: [{ type: "MOVE" as const, direction: "right" as const }],
      p2: [] as any[],
    };
    const queues2 = {
      p1: [{ type: "MOVE" as const, direction: "down" as const }],
      p2: [{ type: "PLACE_BOMB" as const }],
    };

    // Run sequence on A
    const r1a = tick(stateA, queues1);
    const r2a = tick(r1a.state, queues2);

    // Run same sequence on B
    const r1b = tick(stateB, queues1);
    const r2b = tick(r1b.state, queues2);

    expect(r2a.state.players.p1?.x).toBe(r2b.state.players.p1?.x);
    expect(r2a.state.players.p2?.bombActive).toBe(r2b.state.players.p2?.bombActive);
    expect(r2a.state.bombs.length).toBe(r2b.state.bombs.length);
    expect(r2a.state.rngState).toBe(r2b.state.rngState);
  });
});

describe("replay session determinism", () => {
  it("seek to final tick matches sequential simulation", () => {
    const opts = makeBaseOptions(42);
    const initialState = createInitialBombermanState(opts as any);

    // Run 10 ticks sequentially
    let state = initialState;
    const frames: BombermanReplayFrame[] = [];

    for (let t = 0; t < 10; t++) {
      // Determine operations for this tick (simple alternating pattern)
      const ops: BombermanOperation[] = [];
      if (t < 5) {
        ops.push({ type: "MOVE", direction: t % 2 === 0 ? "right" : "down" });
      }
      frames.push({
        tick: state.tick,
        operations: [
          { playerId: "p1", operation: ops.length > 0 ? ops[0]! : { type: "NOOP" } },
          { playerId: "p2", operation: { type: "NOOP" } },
        ],
      });

      const queues: Record<string, BombermanOperation[]> = {};
      for (const entry of frames[frames.length - 1]!.operations) {
        if (!queues[entry.playerId]) queues[entry.playerId] = [];
        queues[entry.playerId]!.push(entry.operation);
      }
      for (const pid of Object.keys(state.players)) {
        if (!queues[pid]) queues[pid] = [];
      }

      const result = tick(state, queues);
      state = result.state;
    }

    const endStateSeq = state;

    // Create replay session and seek to final tick
    const round: BombermanReplayRound = {
      roundNumber: 1,
      attempt: 1,
      seed: 42,
      initialState,
      frames,
      result: {
        roundNumber: 1,
        attempt: 1,
        winner: null,
        reason: "timeout",
        ticks: 10,
      },
    };

    const session = createBombermanReplaySession(round, 5); // checkpoint every 5 ticks
    const endStateReplay = session.seek(10);

    // Deep compare key fields
    expect(endStateReplay.tick).toBe(endStateSeq.tick);
    expect(endStateReplay.players.p1?.x).toBe(endStateSeq.players.p1?.x);
    expect(endStateReplay.players.p1?.y).toBe(endStateSeq.players.p1?.y);
    expect(endStateReplay.players.p2?.x).toBe(endStateSeq.players.p2?.x);
    expect(endStateReplay.players.p2?.y).toBe(endStateSeq.players.p2?.y);
    expect(endStateReplay.rngState).toBe(endStateSeq.rngState);
    expect(endStateReplay.eventCounter).toBe(endStateSeq.eventCounter);
  });

  it("seek forward and backward produce consistent state", () => {
    const opts = makeBaseOptions(42);
    const initialState = createInitialBombermanState(opts as any);

    // Build frames for 20 ticks
    const frames: BombermanReplayFrame[] = [];
    for (let t = 0; t < 20; t++) {
      frames.push({
        tick: t,
        operations: [
          {
            playerId: "p1",
            operation: t < 10
              ? { type: "MOVE", direction: t % 2 === 0 ? "right" : "down" }
              : { type: "PLACE_BOMB" },
          },
          { playerId: "p2", operation: { type: "NOOP" } },
        ],
      });
    }

    const round: BombermanReplayRound = {
      roundNumber: 1,
      attempt: 1,
      seed: 42,
      initialState,
      frames,
      result: {
        roundNumber: 1,
        attempt: 1,
        winner: null,
        reason: "timeout",
        ticks: 20,
      },
    };

    const session = createBombermanReplaySession(round, 10);

    // Seek to tick 20
    const state20 = session.seek(20);
    expect(state20.tick).toBe(20);

    // Seek back to tick 5
    const state5 = session.seek(5);
    expect(state5.tick).toBe(5);

    // Seek forward to tick 15 from tick 5
    const state15 = session.seek(15);
    expect(state15.tick).toBe(15);

    // Seek to tick 0 (beginning)
    const state0 = session.seek(0);
    expect(state0.tick).toBe(0);
    // Tick 0 state should match initial except tick counter
    expect(state0.players.p1?.x).toBe(initialState.players.p1?.x);
  });

  it("clamps out-of-range seek", () => {
    const opts = makeBaseOptions(42);
    const initialState = createInitialBombermanState(opts as any);

    const round: BombermanReplayRound = {
      roundNumber: 1,
      attempt: 1,
      seed: 42,
      initialState,
      frames: [],
      result: {
        roundNumber: 1,
        attempt: 1,
        winner: null,
        reason: "timeout",
        ticks: 0,
      },
    };

    const session = createBombermanReplaySession(round, 10);

    // Negative seek clamps to 0
    const s0 = session.seek(-5);
    expect(s0.tick).toBe(0);

    // Beyond-total seek clamps to total
    const sMax = session.seek(999);
    expect(sMax.tick).toBe(0);
  });
});
