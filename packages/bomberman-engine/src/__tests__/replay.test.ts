import { describe, it, expect } from "vitest";

import { createInitialBombermanState, tick } from "../game.js";
import { createBombermanReplaySession } from "../replay.js";
import type { BombermanReplayRound, BombermanReplayFrame } from "../replay.js";
import type { BombermanOperation } from "@generale/types";

function makeTestMap() {
  return {
    schemaVersion: 1 as const,
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
    fixedItems: [] as any[],
  };
}

function makeBaseOptions(seed: number) {
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

describe("BombermanReplaySession", () => {
  it("starts at tick 0", () => {
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

    const session = createBombermanReplaySession(round);
    expect(session.getTick()).toBe(0);
    expect(session.getState().tick).toBe(0);
  });

  it("step() advances one tick", () => {
    const opts = makeBaseOptions(42);
    const initialState = createInitialBombermanState(opts as any);

    const frames: BombermanReplayFrame[] = [
      {
        tick: 0,
        operations: [
          { playerId: "p1", operation: { type: "MOVE", direction: "right" } },
          { playerId: "p2", operation: { type: "NOOP" } },
        ],
      },
    ];

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
        ticks: 1,
      },
    };

    const session = createBombermanReplaySession(round);
    const state1 = session.step();

    expect(session.getTick()).toBe(1);
    expect(state1.tick).toBe(1);
    expect(state1.players.p1?.x).toBe(2); // moved right
    expect(state1.players.p1?.y).toBe(1);
  });

  it("step() past end returns last state", () => {
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

    const session = createBombermanReplaySession(round);
    const state1 = session.step(); // past end
    expect(session.getTick()).toBe(0);
    expect(state1.tick).toBe(0); // unchanged
  });

  it("seek forward to checkpoint boundary", () => {
    const opts = makeBaseOptions(42);
    const initialState = createInitialBombermanState(opts as any);

    // Build consistent frames for 25 ticks
    const frames: BombermanReplayFrame[] = [];
    for (let t = 0; t < 25; t++) {
      frames.push({
        tick: t,
        operations: [
          { playerId: "p1", operation: { type: "NOOP" } as const },
          { playerId: "p2", operation: { type: "NOOP" } as const },
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
        ticks: 25,
      },
    };

    const session = createBombermanReplaySession(round, 10);
    const state = session.seek(20);
    expect(state.tick).toBe(20);
    // Tick count: 25 frames starting at tick 0 → totalTicks = 25
    // Total ticks the session tracks = initialState.tick + frames.length
    // initialState starts at tick 0, seek to 20 → tick 20
  });

  it("step after seek is consistent", () => {
    const opts = makeBaseOptions(42);
    const initialState = createInitialBombermanState(opts as any);

    const frames: BombermanReplayFrame[] = [];
    for (let t = 0; t < 15; t++) {
      frames.push({
        tick: t,
        operations: [
          {
            playerId: "p1",
            operation: t < 5
              ? ({ type: "MOVE", direction: "right" } as const)
              : ({ type: "PLACE_BOMB" } as const),
          },
          { playerId: "p2", operation: { type: "NOOP" } as const },
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
        ticks: 15,
      },
    };

    const session = createBombermanReplaySession(round, 10);
    session.seek(10);
    expect(session.getTick()).toBe(10);

    const state11 = session.step();
    expect(state11.tick).toBe(11);
  });

  it("sequential step reaches same final state as seek", () => {
    const opts = makeBaseOptions(42);
    const initialState = createInitialBombermanState(opts as any);

    const frames: BombermanReplayFrame[] = [];
    for (let t = 0; t < 12; t++) {
      frames.push({
        tick: t,
        operations: [
          { playerId: "p1", operation: { type: "MOVE", direction: t % 2 === 0 ? "right" : "down" } },
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
        ticks: 12,
      },
    };

    // Sequential stepping
    const seqSession = createBombermanReplaySession(round, 10);
    for (let i = 0; i < 12; i++) {
      seqSession.step();
    }
    const seqState = seqSession.getState();

    // Seek to final
    const seekSession = createBombermanReplaySession(round, 10);
    const seekState = seekSession.seek(12);

    expect(seqState.tick).toBe(seekState.tick);
    expect(seqState.players.p1?.x).toBe(seekState.players.p1?.x);
    expect(seqState.players.p1?.y).toBe(seekState.players.p1?.y);
    expect(seqState.players.p2?.x).toBe(seekState.players.p2?.x);
    expect(seqState.players.p2?.y).toBe(seekState.players.p2?.y);
  });
});
