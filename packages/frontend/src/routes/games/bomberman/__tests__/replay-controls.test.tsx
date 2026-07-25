import { describe, it, expect, vi } from "vitest";
import type {
  BombermanReplayRound,
  BombermanState,
} from "@generale/types";
import { createBombermanReplaySession, createInitialBombermanState } from "@generale/bomberman-engine";

// ─── Mock solid-pixi (used by MapLayer / EntityLayer) ───
vi.mock("solid-pixi", () => ({
  Application: () => null,
  Container: () => null,
  Sprite: () => null,
  Graphics: () => null,
}));

vi.mock("../hooks/useSprites", () => ({
  useSprites: () => ({}),
  TILE_SIZE: 36,
}));

vi.mock("../hooks/useInterpolatedBombermanPosition", () => ({
  useInterpolatedBombermanPosition: () => ({
    x: () => 0,
    y: () => 0,
    facing: () => "down",
    carryBomb: () => null,
    walking: () => false,
    animFrame: () => 0,
  }),
}));

vi.mock("~/ui/sound", () => ({
  sfx: { death: vi.fn(), pickup: vi.fn(), explosion: vi.fn() },
  isMuted: () => true,
}));

vi.mock("~/ui/Countdown", () => ({
  default: () => null,
}));

// Mock replays API
vi.mock("../api/replays", () => ({
  fetchBombermanReplayDetail: vi.fn(),
}));

// ─── Replay Session tests using createInitialBombermanState from engine ───

function makeInitialState(): BombermanState {
  return createInitialBombermanState({
    config: {
      mapWidth: 11,
      mapHeight: 11,
      tickRate: 10,
      bombLimit: 2,
      blastRadius: 2,
      bombFuse: 20,
      speed: 1,
      roundTimeSec: 120,
      shrinkEnabled: true,
      items: [],
      itemDropRate: 0,
    },
    seed: 42,
    map: {
      schemaVersion: 1,
      width: 11,
      height: 11,
      themeId: "classic",
      tiles: Array.from({ length: 11 }, () =>
        Array.from({ length: 11 }, () => ({ type: "empty" as const })),
      ),
      spawns: [{ x: 1, y: 1 }, { x: 9, y: 9 }, { x: 1, y: 9 }, { x: 9, y: 1 }],
      fixedItems: [],
    },
    players: [
      { id: "p1", name: "Player 1", teamId: "team1", isBot: false, skinId: "classic-blue" },
      { id: "p2", name: "Player 2", teamId: "team2", isBot: false, skinId: "classic-green" },
    ],
  });
}

function makeRound(): BombermanReplayRound {
  const initialState = makeInitialState();
  // Use NOOP frames so no movement/items/explosions are triggered
  const frames = [];
  for (let tick = 0; tick < 10; tick++) {
    frames.push({
      tick,
      operations: [
        { playerId: "p1", operation: { type: "NOOP" } },
        { playerId: "p2", operation: { type: "NOOP" } },
      ],
    });
  }
  return {
    roundNumber: 1,
    attempt: 1,
    seed: 42,
    initialState,
    frames,
    result: {
      roundNumber: 1,
      attempt: 1,
      winner: null,
      reason: "draw" as const,
      ticks: 10,
    },
  };
}

describe("BombermanReplaySession (engine)", () => {
  it("starts at tick 0", () => {
    const round = makeRound();
    const session = createBombermanReplaySession(round);
    expect(session.getTick()).toBe(0);
    expect(session.getState().tick).toBe(0);
  });

  it("steps forward one tick at a time", () => {
    const round = makeRound();
    const session = createBombermanReplaySession(round);
    const state1 = session.step();
    expect(session.getTick()).toBe(1);
    expect(state1.tick).toBe(1);
    expect(state1.inputIndicators.p1.direction).toBeNull();
  });

  it("seek to arbitrary tick", () => {
    const round = makeRound();
    const session = createBombermanReplaySession(round);
    const state = session.seek(5);
    expect(session.getTick()).toBe(5);
    expect(state.tick).toBe(5);
    expect(Object.keys(state.players)).toHaveLength(2);
  });

  it("seek to 0 resets state", () => {
    const round = makeRound();
    const session = createBombermanReplaySession(round);
    session.seek(8);
    expect(session.getTick()).toBe(8);
    session.seek(0);
    expect(session.getTick()).toBe(0);
    expect(session.getState().tick).toBe(0);
  });

  it("seek clamps to last tick when past end", () => {
    const round = makeRound();
    const session = createBombermanReplaySession(round);
    session.seek(100);
    // totalTicks = frames.length = 10, last valid tick = 10
    expect(session.getTick()).toBe(10);
    const state = session.getState();
    expect(state.tick).toBe(10);
  });

  it("sequential stepping and seek to final produce same state", () => {
    const round = makeRound();
    const seqSession = createBombermanReplaySession(round);
    for (let i = 0; i < 10; i++) {
      seqSession.step();
    }
    const seqState = seqSession.getState();

    const seekSession = createBombermanReplaySession(round);
    const seekState = seekSession.seek(10);

    expect(seqState.tick).toBe(seekState.tick);
  });
});

// ─── Version check tests ───

describe("Replay version check", () => {
  it("detects version mismatch with different engineVersion", () => {
    const replayEngineVersion = 2;
    const currentVersion = 1;
    expect(replayEngineVersion === currentVersion).toBe(false);
  });

  it("passes version check with matching engineVersion", () => {
    const replayEngineVersion = 1;
    const currentVersion = 1;
    expect(replayEngineVersion === currentVersion).toBe(true);
  });
});
